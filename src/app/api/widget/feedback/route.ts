import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, isRateLimited, authenticateWidgetRequest } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:feedback")) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    const { project, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) {
        return corsError(error ?? "Unauthorized", status);
    }

    const adminSupabase = createAdminClient();

    // Fetch all feedback for the project with reply counts and attachments
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select(`
            id,
            content,
            sender,
            status,
            created_at,
            feedback_replies(id),
            feedback_attachments!feedback_attachments_feedback_id_fkey(id, file_name, file_url, file_size, mime_type)
        `)
        .eq('project_id', project.id)
        .neq('status', 'completed')
        .is('feedback_attachments.reply_id', null)
        .order('created_at', { ascending: false });

    if (feedbackError) {
        return corsError(feedbackError.message, 500);
    }

    const result = (feedback || []).map(f => ({
        id: f.id,
        content: f.content,
        sender: f.sender,
        status: f.status || 'open',
        created_at: f.created_at,
        reply_count: Array.isArray(f.feedback_replies) ? f.feedback_replies.length : 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attachments: (f as any).feedback_attachments || [],
    }));

    return corsSuccess({ feedback: result });
}
