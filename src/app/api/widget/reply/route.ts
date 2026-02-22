import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendAgencyReplyNotification } from "@/lib/notifications";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// Verify that the API key is valid and the feedback belongs to the project
async function verifyApiKeyForFeedback(apiKey: string, feedbackId: string) {
    const supabase = await createClient();
    const { data: projects, error: projectError } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (projectError || !projects || projects.length === 0) {
        return { error: "Invalid API Key" };
    }

    const project = projects[0];

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

    return { projectId: project.id };
}

// --- POST: Send a reply (API key + email auth) ---

export async function POST(request: Request) {
    const { feedbackId, content, apiKey, senderEmail } = await request.json();

    if (!feedbackId || !content || !apiKey || !senderEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400, headers: corsHeaders });
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return NextResponse.json({ error: apiKeyResult.error }, { status: 401, headers: corsHeaders });
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
        return NextResponse.json({ error: "Feedback not found" }, { status: 404, headers: corsHeaders });
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
        return NextResponse.json({ error: replyError.message }, { status: 500, headers: corsHeaders });
    }

    // 3. Notify agency owner (background)
    (async () => {
        try {
            const { data: projectData } = await adminSupabase
                .from('projects')
                .select('name, user_id, mode, support_email')
                .eq('id', feedback.project_id)
                .single();

            if (projectData) {
                let targetEmail = null;

                if (projectData.mode === 'live' && projectData.support_email) {
                    targetEmail = projectData.support_email;
                } else {
                    const { data: profileData } = await adminSupabase
                        .from('profiles')
                        .select('email')
                        .eq('id', projectData.user_id)
                        .single();
                    targetEmail = profileData?.email;
                }

                if (targetEmail) {
                    await sendAgencyReplyNotification({
                        to: targetEmail,
                        projectName: projectData.name,
                        replyContent: content,
                        senderName: senderEmail
                    });
                }
            }
        } catch (e) {
            console.error("VibeVaults: Async notification error", e);
        }
    })();

    return NextResponse.json({ success: true }, { headers: corsHeaders });
}

// --- GET: Fetch replies for a feedback (API key auth) ---

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const apiKey = searchParams.get('key');

    if (!feedbackId || !apiKey) {
        return NextResponse.json({ error: "Missing feedbackId or key" }, { status: 400, headers: corsHeaders });
    }

    const apiKeyResult = await verifyApiKeyForFeedback(apiKey, feedbackId);
    if (apiKeyResult.error) {
        return NextResponse.json({ error: apiKeyResult.error }, { status: 401, headers: corsHeaders });
    }

    const adminSupabase = createAdminClient();
    const { data: replies, error } = await adminSupabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ replies }, { headers: corsHeaders });
}
