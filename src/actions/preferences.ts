'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePreferencesAction(token: string, notifyReplies: boolean, notifyNewFeedback?: boolean, notifyProjectCreated?: boolean, notifyProjectDeleted?: boolean) {
    const supabase = createAdminClient();

    const updateData: any = { notify_replies: notifyReplies };
    if (notifyNewFeedback !== undefined) {
        updateData.notify_new_feedback = notifyNewFeedback;
    }
    if (notifyProjectCreated !== undefined) {
        updateData.notify_project_created = notifyProjectCreated;
    }
    if (notifyProjectDeleted !== undefined) {
        updateData.notify_project_deleted = notifyProjectDeleted;
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

export async function updateAgencyPreferencesAction(notifyNewFeedback: boolean, notifyReplies: boolean, notifyProjectCreated: boolean, notifyProjectDeleted: boolean) {
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
            notify_replies: notifyReplies,
            notify_project_created: notifyProjectCreated,
            notify_project_deleted: notifyProjectDeleted
        }, { onConflict: 'email' });

    if (error) {
        throw new Error("Failed to update preferences.");
    }

    revalidatePath('/dashboard/settings');
}

export async function updateEmailFrequencyAction(frequency: 'digest' | 'realtime') {
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
            email_frequency: frequency
        }, { onConflict: 'email' });

    if (error) {
        throw new Error("Failed to update email frequency.");
    }

    revalidatePath('/dashboard/settings');
}
