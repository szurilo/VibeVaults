import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();

    // Validate API key and get project
    const { data: projects, error: projectError } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (projectError || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });
    }

    const project = projects[0];
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
        .order('created_at', { ascending: false });

    if (feedbackError) {
        return NextResponse.json({ error: feedbackError.message }, { status: 500, headers: corsHeaders });
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

    return NextResponse.json({ feedbacks: result }, { headers: corsHeaders });
}
