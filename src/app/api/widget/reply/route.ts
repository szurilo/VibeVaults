import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited, verifyWidgetEmail } from "@/lib/widget-helpers";
import { sendAgencyReplyNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { shouldSendReplyImmediately, recordEmailSent, queueDigestEmail } from "@/lib/email-digest";

export async function OPTIONS() {
    return optionsResponse();
}

// Verify that the API key is valid and the feedback belongs to the project
async function verifyApiKeyForFeedback(apiKey: string, feedbackId: string) {
    const { project, error } = await validateApiKey(apiKey);

    if (error || !project) {
        return { error: "Invalid API Key" };
    }

    const adminSupabase = createAdminClient();
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select('id, project_id')
        .eq('id', feedbackId)
        .eq('project_id', project.id)
        .single();

    if (feedbackError || !feedback) {
        return { error: "Feedback not found for this project" };
    }

    return { projectId: project.id, workspaceId: project.workspace_id };
}

// --- POST: Send a reply (API key + email auth) ---

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:reply")) return corsError("Too many requests. Please try again later.", 429);

    const { feedbackId, content, apiKey, senderEmail, hasAttachments } = await request.json();

    if (!feedbackId || !apiKey || !senderEmail) {
        return corsError("Missing required fields", 400);
    }
    const replyContent = typeof content === "string" ? content.trim() : "";

    if (!replyContent && !hasAttachments) {
        return corsError("Reply must include text or attachments.", 400);
    }

    if (replyContent.length > 5000) {
        return corsError("Reply content is too long (max 5000 characters).", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
        return corsError("Invalid email address", 400);
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return corsError(apiKeyResult.error, 401);
    }

    // Verify the sender still has access to this workspace
    const isAuthorized = await verifyWidgetEmail(senderEmail, apiKeyResult.workspaceId!);
    if (!isAuthorized) {
        return corsError("Unauthorized email address. Access may have been revoked.", 403);
    }

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
                    const replyPayload = { replyContent, sender: senderEmail, projectName: projectData.name };

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
                                unsubscribeToken: prefs.unsubscribeToken
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

// --- GET: Fetch replies for a feedback (API key auth) ---

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:replies")) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const apiKey = searchParams.get('key');
    const email = searchParams.get('email');

    if (!feedbackId || !apiKey) {
        return corsError("Missing feedbackId or key", 400);
    }

    if (!email) {
        return corsError("Missing email", 400);
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return corsError(apiKeyResult.error, 401);
    }

    // Verify the requesting user still has access to this workspace
    const isEmailAuthorized = await verifyWidgetEmail(email, apiKeyResult.workspaceId!);
    if (!isEmailAuthorized) {
        return corsError("Access revoked. You no longer have access to this workspace.", 403);
    }

    const adminSupabase = createAdminClient();
    const { data: replies, error } = await adminSupabase
        .from('feedback_replies')
        .select('*, feedback_attachments(id, file_name, file_url, file_size, mime_type)')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

    if (error) {
        return corsError(error.message, 500);
    }

    // Flatten attachment join into an `attachments` property for each reply
    const repliesWithAttachments = (replies || []).map(r => ({
        ...r,
        attachments: r.feedback_attachments || [],
        feedback_attachments: undefined,
    }));

    return corsSuccess({ replies: repliesWithAttachments });
}
