'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendReplyNotification } from "@/lib/notifications";


export async function updateFeedbackStatus(id: string, status: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('feedbacks')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error('Failed to update feedback status');
    }

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

    // Verify ownership
    const { data: feedback, error: checkError } = await supabase
        .from('feedbacks')
        .select('*, projects!inner(user_id, name)')
        .eq('id', feedbackId)
        .single();

    if (checkError || !feedback) throw new Error("Feedback not found");
    const project = feedback.projects as unknown as { user_id: string; name: string };
    if (project.user_id !== user.id) throw new Error("Unauthorized");

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

    // Send notification to client if they provided an email
    if (feedback.sender && feedback.sender.includes('@')) {
        sendReplyNotification({
            to: feedback.sender,
            projectName: project.name,
            replyContent: content,
            originalFeedback: feedback.content
        }).catch(err => console.error("Error sending client notification:", err));
    }

    revalidatePath('/dashboard/feedback');
}
