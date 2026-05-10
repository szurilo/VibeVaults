import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, isRateLimited, authenticateWidgetRequest } from "@/lib/widget-helpers";
import { getTierLimits } from "@/lib/tier-config";
import { sendFeedbackNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { shouldSendFeedbackImmediately, recordEmailSent, queueDigestEmail } from "@/lib/email-digest";

export async function OPTIONS() {
    return optionsResponse();
}

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:config")) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    const { project, ownerTier, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) {
        return corsError(error ?? "Unauthorized", status);
    }

    // Notification preference for the authenticated identity (replaces the
    // legacy `?sender=` lookup — the bearer token is now the source of truth).
    let notifyReplies = true;
    const adminSupabase = createAdminClient();
    const { data: pref } = await adminSupabase
        .from('email_preferences')
        .select('notify_replies')
        .eq('email', identity.email)
        .single();
    if (pref) {
        notifyReplies = pref.notify_replies;
    }

    const limits = getTierLimits(ownerTier ?? null);
    return corsSuccess({
        project: { name: project.name },
        identity: { email: identity.email },
        notifyReplies,
        showBranding: limits.showBranding,
    });
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:submit")) return corsError("Too many requests. Please try again later.", 429);

    const { apiKey, content, type, metadata, notifyReplies } = await request.json();

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
        return corsError("Feedback content is required.", 400);
    }

    if (content.length > 5000) {
        return corsError("Feedback content is too long (max 5000 characters).", 400);
    }

    const { project, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) {
        return corsError(error ?? "Unauthorized", status);
    }

    // Identity email is server-authoritative — clients can no longer claim
    // an arbitrary sender by passing it in the body.
    const sender = identity.email;

    // Generate the ID upfront so we don't need .select() after insert.
    const feedbackId = crypto.randomUUID();

    // Save email preferences if notifyReplies is defined
    if (notifyReplies !== undefined) {
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

    // Notify all workspace members (digest-aware: immediate for first, queue for subsequent)
    try {
        const adminSupabase = createAdminClient();

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
                const emailPayload = { content, sender, metadata, projectName: project.name, workspaceId: project.workspace_id, projectId: project.id, feedbackId };

                for (const p of profiles) {
                    const email = p.email;
                    if (!email || email === sender) continue;

                    const prefs = await getNotificationPrefs(email, 'new_feedback');
                    if (!prefs.shouldNotify) continue;

                    const sendNow = await shouldSendFeedbackImmediately(email, project.id);

                    if (sendNow) {
                        await sendFeedbackNotification({
                            to: email,
                            projectName: project.name,
                            content,
                            sender,
                            metadata,
                            unsubscribeToken: prefs.unsubscribeToken,
                            workspaceId: project.workspace_id,
                            projectId: project.id,
                            feedbackId
                        });
                        await recordEmailSent({
                            recipientEmail: email,
                            notificationType: 'new_feedback',
                            projectId: project.id,
                            feedbackId,
                            payload: emailPayload
                        });
                    } else {
                        await queueDigestEmail({
                            recipientEmail: email,
                            notificationType: 'new_feedback',
                            projectId: project.id,
                            feedbackId,
                            payload: emailPayload
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
