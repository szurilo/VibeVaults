import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, validateApiKey } from "@/lib/widget-helpers";
import { sendAgencyReplyNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";

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
    const { feedbackId, content, apiKey, senderEmail } = await request.json();

    if (!feedbackId || !content || !apiKey || !senderEmail) {
        return corsError("Missing required fields", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
        return corsError("Invalid email address", 400);
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return corsError(apiKeyResult.error, 401);
    }

    const adminSupabase = createAdminClient();

    // Verify sender is in workspace_invites
    const { data: invite, error: inviteError } = await adminSupabase
        .from('workspace_invites')
        .select('id')
        .eq('workspace_id', apiKeyResult.workspaceId)
        .eq('email', senderEmail)
        .single();

    if (inviteError || !invite) {
        return corsError("Unauthorized email address. Access may have been revoked.", 403);
    }

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
    const { error: replyError } = await adminSupabase
        .from('feedback_replies')
        .insert({
            feedback_id: feedbackId,
            content,
            author_role: 'client',
            author_name: senderEmail
        });

    if (replyError) {
        console.error("VibeVaults: Reply insert error", replyError);
        return corsError(replyError.message, 500);
    }

    // 3. Notify agency owner
    try {
        const { data: projectData } = await adminSupabase
            .from('projects')
            .select('name, user_id')
            .eq('id', feedback.project_id)
            .single();

        if (projectData) {
            const { data: profileData } = await adminSupabase
                .from('profiles')
                .select('email')
                .eq('id', projectData.user_id)
                .single();

            const targetEmail = profileData?.email;

            if (targetEmail) {
                const prefs = await getNotificationPrefs(targetEmail, 'replies');

                if (prefs.shouldNotify) {
                    await sendAgencyReplyNotification({
                        to: targetEmail,
                        projectName: projectData.name,
                        replyContent: content,
                        senderName: senderEmail,
                        unsubscribeToken: prefs.unsubscribeToken
                    });
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Email notification error", e);
    }

    return corsSuccess({ success: true });
}

// --- GET: Fetch replies for a feedback (API key auth) ---

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const apiKey = searchParams.get('key');

    if (!feedbackId || !apiKey) {
        return corsError("Missing feedbackId or key", 400);
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return corsError(apiKeyResult.error, 401);
    }

    const adminSupabase = createAdminClient();
    const { data: replies, error } = await adminSupabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

    if (error) {
        return corsError(error.message, 500);
    }

    return corsSuccess({ replies });
}
