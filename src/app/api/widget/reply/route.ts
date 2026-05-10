import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, isRateLimited, authenticateWidgetRequest } from "@/lib/widget-helpers";
import { sendAgencyReplyNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { shouldSendReplyImmediately, recordEmailSent, queueDigestEmail } from "@/lib/email-digest";

export async function OPTIONS() {
    return optionsResponse();
}

// Returns the error message string if the feedback isn't part of the project,
// or `null` on success. Callers map non-null to a 404 response.
async function verifyFeedbackForProject(projectId: string, feedbackId: string): Promise<string | null> {
    const adminSupabase = createAdminClient();
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select('id, project_id')
        .eq('id', feedbackId)
        .eq('project_id', projectId)
        .single();

    if (feedbackError || !feedback) {
        return "Feedback not found for this project";
    }
    return null;
}

// --- POST: Send a reply (Bearer-token auth) ---

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:reply")) return corsError("Too many requests. Please try again later.", 429);

    const body = await request.json() as { feedbackId?: string; content?: string; apiKey?: string; hasAttachments?: boolean };
    const { feedbackId, content, apiKey, hasAttachments } = body;

    if (!feedbackId || !apiKey) {
        return corsError("Missing required fields", 400);
    }
    const replyContent = typeof content === "string" ? content.trim() : "";

    if (!replyContent && !hasAttachments) {
        return corsError("Reply must include text or attachments.", 400);
    }

    if (replyContent.length > 5000) {
        return corsError("Reply content is too long (max 5000 characters).", 400);
    }

    const { project, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) {
        return corsError(error ?? "Unauthorized", status);
    }

    const feedbackCheckError = await verifyFeedbackForProject(project.id, feedbackId);
    if (feedbackCheckError) {
        return corsError(feedbackCheckError, 404);
    }

    const senderEmail = identity.email;
    const adminSupabase = createAdminClient();

    // 1. Get Feedback & Project ID
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select('id, sender, project_id')
        .eq('id', feedbackId)
        .single();

    if (feedbackError || !feedback) {
        console.error("VibeVaults: Feedback not found", feedbackError);
        return corsError("Feedback not found", 404);
    }

    // 2. Insert the reply
    const { data: newReply, error: replyError } = await adminSupabase
        .from('feedback_replies')
        .insert({
            feedback_id: feedbackId,
            content: replyContent,
            author_role: 'client',
            author_name: senderEmail
        })
        .select('id')
        .single();

    if (replyError || !newReply) {
        console.error("VibeVaults: Reply insert error", replyError);
        return corsError(replyError?.message || "Failed to create reply", 500);
    }

    // 3. Notify all workspace members (with reply cooldown per thread)
    try {
        const { data: projectData } = await adminSupabase
            .from('projects')
            .select('name, workspace_id')
            .eq('id', feedback.project_id)
            .single();

        if (projectData && projectData.workspace_id) {
            const { data: memberRows } = await adminSupabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', projectData.workspace_id);

            if (memberRows && memberRows.length > 0) {
                const memberIds = memberRows.map(m => m.user_id);
                const { data: profiles } = await adminSupabase
                    .from('profiles')
                    .select('email')
                    .in('id', memberIds);

                if (profiles) {
                    const replyPayload = { replyContent, sender: senderEmail, projectName: projectData.name, workspaceId: projectData.workspace_id, projectId: feedback.project_id, feedbackId };

                    for (const p of profiles) {
                        const email = p.email;
                        if (!email || email === senderEmail) continue;

                        const prefs = await getNotificationPrefs(email, 'replies');
                        if (!prefs.shouldNotify) continue;

                        const sendNow = await shouldSendReplyImmediately(email, feedbackId);

                        if (sendNow) {
                            await sendAgencyReplyNotification({
                                to: email,
                                projectName: projectData.name,
                                replyContent: replyContent,
                                sender: senderEmail,
                                unsubscribeToken: prefs.unsubscribeToken,
                                workspaceId: projectData.workspace_id,
                                projectId: feedback.project_id,
                                feedbackId
                            });
                            await recordEmailSent({
                                recipientEmail: email,
                                notificationType: 'agency_reply',
                                projectId: feedback.project_id,
                                feedbackId,
                                payload: replyPayload
                            });
                        } else {
                            await queueDigestEmail({
                                recipientEmail: email,
                                notificationType: 'agency_reply',
                                projectId: feedback.project_id,
                                feedbackId,
                                payload: replyPayload
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Reply email notification error", e);
    }

    return corsSuccess({ success: true, replyId: newReply.id });
}

// --- GET: Fetch replies for a feedback (Bearer-token auth) ---

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:replies")) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const apiKey = searchParams.get('key');

    if (!feedbackId || !apiKey) {
        return corsError("Missing feedbackId or key", 400);
    }

    const { project, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) {
        return corsError(error ?? "Unauthorized", status);
    }

    const feedbackCheckError = await verifyFeedbackForProject(project.id, feedbackId);
    if (feedbackCheckError) {
        return corsError(feedbackCheckError, 404);
    }

    const adminSupabase = createAdminClient();
    const { data: replies, error: queryError } = await adminSupabase
        .from('feedback_replies')
        .select('*, feedback_attachments(id, file_name, file_url, file_size, mime_type)')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

    if (queryError) {
        return corsError(queryError.message, 500);
    }

    // Flatten attachment join into an `attachments` property for each reply
    const repliesWithAttachments = (replies || []).map(r => ({
        ...r,
        attachments: r.feedback_attachments || [],
        feedback_attachments: undefined,
    }));

    return corsSuccess({ replies: repliesWithAttachments });
}
