import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    const { project, error, status } = await validateApiKey(apiKey);
    if (error) {
        return corsError(error, status);
    }

    const adminSupabase = createAdminClient();

    // Fetch all feedbacks for the project with reply counts
    const { data: feedbacks, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select(`
            id,
            content,
            sender,
            status,
            created_at,
            feedback_replies(id)
        `)
        .eq('project_id', project.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

    if (feedbackError) {
        return corsError(feedbackError.message, 500);
    }

    // Transform to include reply_count
    const result = (feedbacks || []).map(f => ({
        id: f.id,
        content: f.content,
        sender: f.sender,
        status: f.status || 'open',
        created_at: f.created_at,
        reply_count: Array.isArray(f.feedback_replies) ? f.feedback_replies.length : 0,
    }));

    return corsSuccess({ feedbacks: result });
}
