import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendFeedbackNotification } from "@/lib/notifications";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const { data: projects, error } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (error || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });
    }

    const project = projects[0];

    return NextResponse.json({ project: { name: project.name } }, { headers: corsHeaders });
}

export async function POST(request: Request) {
    const { apiKey, content, type, sender, metadata } = await request.json();

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();
    const { data: projects, error: projectError } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (projectError || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });
    }

    const project = projects[0];

    // Email validation for client email provided by the widget
    if (sender) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
            return NextResponse.json({ error: "Invalid email format." }, { status: 400, headers: corsHeaders });
        }
    }

    // Generate the ID upfront so we don't need .select() after insert.
    // Using .select('id').single() would require the RETURNING row to pass
    // the SELECT RLS policy, which fails for anonymous widget users.
    const feedbackId = crypto.randomUUID();

    const { error: insertError } = await supabase.from('feedbacks').insert({
        id: feedbackId,
        content,
        type: type || 'Feature',
        sender,
        project_id: project.id,
        metadata: metadata || {}
    });

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500, headers: corsHeaders });
    }

    // Notify the agency owner
    if (project.owner_email) {
        await sendFeedbackNotification({
            to: project.owner_email,
            projectName: project.name,
            content,
            sender,
            metadata
        });
    }

    return NextResponse.json({ success: true, feedback_id: feedbackId }, { headers: corsHeaders });
}
