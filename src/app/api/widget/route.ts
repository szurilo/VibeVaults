import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited } from "@/lib/widget-helpers";
import { sendFeedbackNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";

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

    return corsSuccess({ project: { name: project.name }, notifyReplies });
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return corsError("Too many requests. Please try again later.", 429);

    const { apiKey, content, type, sender, metadata, notifyReplies } = await request.json();

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    const { project, error, status } = await validateApiKey(apiKey);
    if (error) {
        return corsError(error, status);
    }

    // Email validation for client email provided by the widget
    if (sender) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
            return corsError("Invalid email format.", 400);
        }

        const adminSupabase = createAdminClient();

        const { data: invite, error: inviteError } = await adminSupabase
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', project.workspace_id)
            .eq('email', sender)
            .single();

        if (inviteError || !invite) {
            return corsError("Unauthorized email address. Access may have been revoked.", 403);
        }
    } else {
        return corsError("Missing sender email.", 400);
    }

    // Generate the ID upfront so we don't need .select() after insert.
    const feedbackId = crypto.randomUUID();

    // Save email preferences if notifyReplies is defined
    if (sender && notifyReplies !== undefined) {
        const adminSupabase = createAdminClient();
        await adminSupabase.from('email_preferences').upsert({
            email: sender,
            notify_replies: notifyReplies
        }, { onConflict: 'email' });
    }

    const supabase = await createClient();
    const { error: insertError } = await supabase.from('feedbacks').insert({
        id: feedbackId,
        content,
        type: type || 'Feature',
        sender,
        project_id: project.id,
        metadata: metadata || {}
    });

    if (insertError) {
        return corsError(insertError.message, 500);
    }

    // Notify all workspace members
    try {
        const adminSupabase = createAdminClient();

        // Fetch workspace members separately from profiles for maximum query reliability
        const { data: memberRows } = await adminSupabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', project.workspace_id);

        if (memberRows && memberRows.length > 0) {
            const memberIds = memberRows.map(m => m.user_id);
            const { data: profiles } = await adminSupabase
                .from('profiles')
                .select('email')
                .in('id', memberIds);

            if (profiles) {
                for (const p of profiles) {
                    const email = p.email;
                    if (!email) continue;

                    const prefs = await getNotificationPrefs(email, 'new_feedback');
                    if (prefs.shouldNotify) {
                        await sendFeedbackNotification({
                            to: email,
                            projectName: project.name,
                            content,
                            sender,
                            metadata,
                            unsubscribeToken: prefs.unsubscribeToken
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Email notification error", e);
    }

    return corsSuccess({ success: true, feedback_id: feedbackId });
}
