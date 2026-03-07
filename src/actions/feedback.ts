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
import { revalidatePath } from "next/cache";
import { sendReplyNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";


export async function updateFeedbackStatus(id: string, status: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('feedbacks')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error('Failed to update feedback status');
    }

    // Mark associated notifications as read
    await supabase.from('notifications').update({ is_read: true }).eq('feedback_id', id);

    revalidatePath('/dashboard/feedback');
}

export async function deleteFeedback(id: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error('Failed to delete feedback');
    }

    revalidatePath('/dashboard/feedback');
}

export async function sendAgencyReplyAction(feedbackId: string, content: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Verify ownership via RLS
    const { data: feedback, error: checkError } = await supabase
        .from('feedbacks')
        .select('*, projects!inner(id, name)')
        .eq('id', feedbackId)
        .single();

    if (checkError || !feedback) throw new Error("Feedback not found");
    const project = feedback.projects as unknown as { id: string; name: string };

    const { error: replyError } = await supabase
        .from('feedback_replies')
        .insert({
            feedback_id: feedbackId,
            content,
            user_id: user.id,
            author_role: 'agency',
            author_name: 'Agency Support'
        });

    if (replyError) throw replyError;

    // Mark associated notifications as read
    await supabase.from('notifications').update({ is_read: true }).eq('feedback_id', feedbackId);

    // Send notification to client if they provided an email
    if (feedback.sender && feedback.sender.includes('@')) {
        const prefs = await getNotificationPrefs(feedback.sender, 'replies');

        if (prefs.shouldNotify) {
            await sendReplyNotification({
                to: feedback.sender,
                projectName: project.name,
                replyContent: content,
                originalFeedback: feedback.content,
                unsubscribeToken: prefs.unsubscribeToken
            });
        }
    }

    revalidatePath('/dashboard/feedback');
}


export async function addManualFeedbackAction(projectId: string, content: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Verify ownership via RLS
    const { data: project, error: checkError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

    if (checkError || !project) throw new Error("Project not found");

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

    if (insertError) throw new Error(insertError.message);

    // Mark associated notifications as read since the agency member created it themselves
    await supabase.from('notifications').update({ is_read: true }).eq('feedback_id', feedbackId);

    revalidatePath('/dashboard/feedback');
    return { success: true, feedback_id: feedbackId };
}
