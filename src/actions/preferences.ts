'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePreferencesAction(token: string, notifyReplies: boolean, notifyNewFeedback?: boolean) {
    const supabase = createAdminClient();

    const updateData: any = { notify_replies: notifyReplies };
    if (notifyNewFeedback !== undefined) {
        updateData.notify_new_feedback = notifyNewFeedback;
    }

    const { error } = await supabase
        .from("email_preferences")
        .update(updateData)
        .eq("unsubscribe_token", token);

    if (error) {
        throw new Error("Failed to update preferences.");
    }

    revalidatePath('/unsubscribe');
}

export async function updateAgencyPreferencesAction(notifyNewFeedback: boolean, notifyReplies: boolean) {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const email = user.email;
    if (!email) throw new Error("No user email found.");

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
        .from("email_preferences")
        .upsert({
            email,
            notify_new_feedback: notifyNewFeedback,
            notify_replies: notifyReplies
        }, { onConflict: 'email' });

    if (error) {
        throw new Error("Failed to update preferences.");
    }

    revalidatePath('/dashboard/settings');
}
