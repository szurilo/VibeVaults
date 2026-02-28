import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    let notifyReplies = true; // default
    const sender = searchParams.get("sender");
    if (sender) {
        const adminSupabase = createAdminClient();
        const { data: pref } = await adminSupabase
            .from('email_preferences')
            .select('notify_replies')
            .eq('email', sender)
            .single();
        if (pref) {
            notifyReplies = pref.notify_replies;
        }
    }

    return NextResponse.json({ project: { name: project.name }, notifyReplies }, { headers: corsHeaders });
}

export async function POST(request: Request) {
    const { apiKey, content, type, sender, metadata, notifyReplies } = await request.json();

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

        const adminSupabase = createAdminClient();
        const { data: invite, error: inviteError } = await adminSupabase
            .from('project_invites')
            .select('id')
            .eq('project_id', project.id)
            .eq('email', sender)
            .single();

        if (inviteError || !invite) {
            return NextResponse.json({ error: "Unauthorized email address. Access may have been revoked." }, { status: 403, headers: corsHeaders });
        }
    } else {
        return NextResponse.json({ error: "Missing sender email." }, { status: 400, headers: corsHeaders });
    }

    // Generate the ID upfront so we don't need .select() after insert.
    // Using .select('id').single() would require the RETURNING row to pass
    // the SELECT RLS policy, which fails for anonymous widget users.
    const feedbackId = crypto.randomUUID();

    // Save email preferences if notifyReplies is defined
    if (sender && notifyReplies !== undefined) {
        // Use admin client here if not already defined
        const adminSupabaseLocal = createAdminClient();
        await adminSupabaseLocal.from('email_preferences').upsert({
            email: sender,
            notify_replies: notifyReplies
        }, { onConflict: 'email' });
    }

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
        const adminSupabase = createAdminClient();
        const { data: prefData } = await adminSupabase
            .from('email_preferences')
            .select('notify_new_feedback, unsubscribe_token')
            .eq('email', project.owner_email)
            .single();

        let shouldNotify = true;
        let unsubscribeToken = prefData?.unsubscribe_token;

        if (!prefData) {
            const { data: newPref } = await adminSupabase
                .from('email_preferences')
                .upsert({ email: project.owner_email }, { onConflict: 'email' })
                .select('unsubscribe_token')
                .single();
            if (newPref) {
                unsubscribeToken = newPref.unsubscribe_token;
            }
        } else {
            shouldNotify = prefData.notify_new_feedback;
        }

        if (shouldNotify) {
            await sendFeedbackNotification({
                to: project.owner_email,
                projectName: project.name,
                content,
                sender,
                metadata,
                unsubscribeToken
            });
        }
    }

    return NextResponse.json({ success: true, feedback_id: feedbackId }, { headers: corsHeaders });
}
