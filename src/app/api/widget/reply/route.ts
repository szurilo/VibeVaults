import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendAgencyReplyNotification } from "@/lib/notifications";
import { jwtVerify } from "jose";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

async function verifyToken(request: Request, feedbackId: string) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { error: "Missing or invalid authorization token" };
    }

    const token = authHeader.split(" ")[1];
    const secretKey = new TextEncoder().encode(process.env.SUPABASE_SECRET_KEY || 'default-secret');

    try {
        const { payload } = await jwtVerify(token, secretKey);

        if (payload.feedbackId !== feedbackId) {
            return { error: "Token does not match feedback ID" };
        }

        return { payload };
    } catch (e) {
        return { error: "Invalid or expired token" };
    }
}

export async function POST(request: Request) {
    const { feedbackId, content } = await request.json();

    if (!feedbackId || !content) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const verification = await verifyToken(request, feedbackId);
    if (verification.error || !verification.payload) {
        return NextResponse.json({ error: verification.error }, { status: 401, headers: corsHeaders });
    }

    const clientEmail = verification.payload.email as string;
    const adminSupabase = createAdminClient();

    // 1. Get Feedback & Project ID (essential)
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from('feedbacks')
        .select('id, sender, project_id')
        .eq('id', feedbackId)
        .single();

    if (feedbackError || !feedback) {
        console.error("VibeVaults: Feedback not found", feedbackError);
        return NextResponse.json({ error: "Feedback not found" }, { status: 404, headers: corsHeaders });
    }

    // 2. Insert the reply securely using admin client
    const { error: replyError } = await adminSupabase
        .from('feedback_replies')
        .insert({
            feedback_id: feedbackId,
            content,
            author_role: 'client',
            author_name: clientEmail
        });

    if (replyError) {
        console.error("VibeVaults: Reply insert error", replyError);
        return NextResponse.json({ error: replyError.message }, { status: 500, headers: corsHeaders });
    }

    // 3. Attempt to fetch owner email for notification (background)
    (async () => {
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

                if (profileData?.email) {
                    await sendAgencyReplyNotification({
                        to: profileData.email,
                        projectName: projectData.name,
                        replyContent: content,
                        senderName: clientEmail
                    });
                }
            }
        } catch (e) {
            console.error("VibeVaults: Async notification error", e);
        }
    })();

    return NextResponse.json({ success: true }, { headers: corsHeaders });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');

    if (!feedbackId) {
        return NextResponse.json({ error: "Missing feedbackId" }, { status: 400, headers: corsHeaders });
    }

    const verification = await verifyToken(request, feedbackId);
    if (verification.error) {
        return NextResponse.json({ error: verification.error }, { status: 401, headers: corsHeaders });
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
