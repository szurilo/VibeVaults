import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendFeedbackNotification } from "@/lib/notifications";
import { SignJWT } from "jose";

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

    if (!sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
        return NextResponse.json({ error: "Please provide a valid email address so we can reply to you." }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();
    const { data: projects, error: projectError } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (projectError || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });
    }

    const project = projects[0];

    const { data: inserted, error: insertError } = await supabase.from('feedbacks').insert({
        content,
        type: type || 'Feature',
        sender,
        project_id: project.id,
        metadata: metadata || {}
    }).select('id').single();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500, headers: corsHeaders });
    }

    if (project.owner_email) {
        // Send notification asynchronously
        sendFeedbackNotification({
            to: project.owner_email,
            projectName: project.name,
            content,
            sender,
            metadata
        }).catch(err => console.error("Error sending notification:", err));
    }

    const secretKey = new TextEncoder().encode(process.env.SUPABASE_SECRET_KEY || 'default-secret');
    const token = await new SignJWT({ feedbackId: inserted.id, email: sender, projectId: project.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secretKey);

    return NextResponse.json({ success: true, feedback_id: inserted.id, token }, { headers: corsHeaders });
}
