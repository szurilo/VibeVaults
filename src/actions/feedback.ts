/**
 * Main Responsibility: Handles server-side operations for feedback management including status updates, 
 * deletion, and creating manual feedback or agency replies. Enforces RLS permissions on the backend.
 * 
 * Sensitive Dependencies: 
 * - Supabase Server Client (@/lib/supabase/server) for authenticated operations.
 * - Supabase Admin Client (@/lib/supabase/admin) for overriding RLS during email preference fetching.
 * - Next.js Cache (revalidatePath) for updating customized UI endpoints after mutation.
 * - Notifications library (@/lib/notifications) to orchestrate Resend replies.
 */
'use server';

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendReplyNotification, sendAgencyReplyNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { shouldSendReplyImmediately, shouldSendFeedbackImmediately, recordEmailSent, queueDigestEmail } from "@/lib/email-digest";


export async function updateFeedbackStatus(id: string, status: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('feedbacks')
        .update({ status })
        .eq('id', id)
        .select('id');

    if (error) {
        return { error: 'Failed to update feedback status.' };
    }

    if (!data || data.length === 0) {
        return { error: 'Feedback not found or you no longer have access.' };
    }

    // Mark associated notifications as read
    await supabase.from('notifications').update({ is_read: true }).eq('feedback_id', id);

    revalidatePath('/dashboard/feedback');
    return { error: null };
}

export async function deleteFeedback(id: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', id)
        .select('id');

    if (error) {
        return { error: 'Failed to delete feedback.' };
    }

    if (!data || data.length === 0) {
        return { error: 'Feedback not found or you no longer have access.' };
    }

    revalidatePath('/dashboard/feedback');
    return { error: null };
}

export async function sendAgencyReplyAction(feedbackId: string, content: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in to reply.", replyId: null };

    // Verify ownership via RLS
    const { data: feedback, error: checkError } = await supabase
        .from('feedbacks')
        .select('*, projects!inner(id, name)')
        .eq('id', feedbackId)
        .single();

    if (checkError || !feedback) return { error: "Feedback not found or you no longer have access.", replyId: null };
    const project = feedback.projects as unknown as { id: string; name: string };

    const { data: replyData, error: replyError } = await supabase
        .from('feedback_replies')
        .insert({
            feedback_id: feedbackId,
            content,
            user_id: user.id,
            author_role: 'agency',
            author_name: user.email || 'Support'
        })
        .select('id')
        .single();

    if (replyError || !replyData) return { error: "Failed to send reply. Your access may have been revoked.", replyId: null };

    // Mark associated notifications as read
    await supabase.from('notifications').update({ is_read: true }).eq('feedback_id', feedbackId);

    // Send notification to feedback sender (skip if replier IS the sender)
    const senderEmail = user.email || 'Someone';
    const alreadyNotified = new Set<string>([user.email || '']);

    if (feedback.sender && feedback.sender.includes('@') && feedback.sender !== user.email) {
        alreadyNotified.add(feedback.sender);
        const prefs = await getNotificationPrefs(feedback.sender, 'replies');

        if (prefs.shouldNotify) {
            const replyPayload = { replyContent: content, sender: senderEmail, projectName: project.name, originalFeedback: feedback.content };
            const sendNow = await shouldSendReplyImmediately(feedback.sender, feedbackId);

            if (sendNow) {
                await sendReplyNotification({
                    to: feedback.sender,
                    projectName: project.name,
                    replyContent: content,
                    originalFeedback: feedback.content,
                    sender: senderEmail,
                    unsubscribeToken: prefs.unsubscribeToken
                });
                await recordEmailSent({
                    recipientEmail: feedback.sender,
                    notificationType: 'reply',
                    projectId: project.id,
                    feedbackId,
                    payload: replyPayload
                });
            } else {
                await queueDigestEmail({
                    recipientEmail: feedback.sender,
                    notificationType: 'reply',
                    projectId: project.id,
                    feedbackId,
                    payload: replyPayload
                });
            }
        }
    }

    // Notify other thread participants (workspace members who previously replied)
    try {
        const adminSupabase = createAdminClient();
        const { data: threadReplies } = await adminSupabase
            .from('feedback_replies')
            .select('author_name')
            .eq('feedback_id', feedbackId)
            .neq('id', replyData.id);

        if (threadReplies) {
            const participantEmails = [...new Set(
                threadReplies
                    .map(r => r.author_name)
                    .filter((email): email is string => !!email && email.includes('@') && !alreadyNotified.has(email))
            )];

            for (const email of participantEmails) {
                const prefs = await getNotificationPrefs(email, 'replies');
                if (!prefs.shouldNotify) continue;

                const replyPayload = { replyContent: content, sender: senderEmail, projectName: project.name };
                const sendNow = await shouldSendReplyImmediately(email, feedbackId);

                if (sendNow) {
                    await sendAgencyReplyNotification({
                        to: email,
                        projectName: project.name,
                        replyContent: content,
                        sender: senderEmail,
                        unsubscribeToken: prefs.unsubscribeToken
                    });
                    await recordEmailSent({
                        recipientEmail: email,
                        notificationType: 'reply',
                        projectId: project.id,
                        feedbackId,
                        payload: replyPayload
                    });
                } else {
                    await queueDigestEmail({
                        recipientEmail: email,
                        notificationType: 'reply',
                        projectId: project.id,
                        feedbackId,
                        payload: replyPayload
                    });
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Thread participant notification error", e);
    }

    revalidatePath('/dashboard/feedback');
    return { error: null, replyId: replyData.id };
}


export async function addManualFeedbackAction(projectId: string, content: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in to add feedback.", success: false, feedback_id: null };

    // Verify ownership via RLS
    const { data: project, error: checkError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

    if (checkError || !project) return { error: "You no longer have access to this project. Your access may have been revoked.", success: false, feedback_id: null };

    const feedbackId = crypto.randomUUID();

    const { error: insertError } = await supabase.from('feedbacks').insert({
        id: feedbackId,
        content,
        type: 'Bug', // or 'Feature', default value
        sender: user.email || 'Agency Member',
        project_id: projectId,
        status: 'open',
        metadata: {
            is_manual: true
        }
    });

    if (insertError) return { error: "Failed to add feedback. Your access may have been revoked.", success: false, feedback_id: null };

    // Notify all workspace members via email (digest-aware)
    try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { sendFeedbackNotification } = await import("@/lib/notifications");

        const adminSupabase = createAdminClient();

        const { data: projectData } = await adminSupabase
            .from('projects')
            .select('name, workspace_id')
            .eq('id', projectId)
            .single();

        if (projectData && projectData.workspace_id) {
            const { data: memberRows } = await adminSupabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', projectData.workspace_id);

            if (memberRows && memberRows.length > 0) {
                const memberIds = memberRows.filter(m => m.user_id !== user.id).map(m => m.user_id);

                const { data: profiles } = await adminSupabase
                    .from('profiles')
                    .select('email')
                    .in('id', memberIds);

                if (profiles) {
                    const emailPayload = { content, sender: user.email || 'Agency Member', metadata: { is_manual: true }, projectName: projectData.name };

                    for (const p of profiles) {
                        const email = p.email;
                        if (!email) continue;

                        const prefs = await getNotificationPrefs(email, 'new_feedback');
                        if (!prefs.shouldNotify) continue;

                        const sendNow = await shouldSendFeedbackImmediately(email, projectId);

                        if (sendNow) {
                            await sendFeedbackNotification({
                                to: email,
                                projectName: projectData.name,
                                content,
                                sender: user.email || 'Agency Member',
                                metadata: { is_manual: true },
                                unsubscribeToken: prefs.unsubscribeToken
                            });
                            await recordEmailSent({
                                recipientEmail: email,
                                notificationType: 'new_feedback',
                                projectId,
                                payload: emailPayload
                            });
                        } else {
                            await queueDigestEmail({
                                recipientEmail: email,
                                notificationType: 'new_feedback',
                                projectId,
                                payload: emailPayload
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Manual feedback email error", e);
    }

    revalidatePath('/dashboard/feedback');
    return { error: null, success: true, feedback_id: feedbackId };
}
