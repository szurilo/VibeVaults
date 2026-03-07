import { createAdminClient } from "@/lib/supabase/admin";

type NotificationType = 'new_feedback' | 'replies';

interface NotificationPrefs {
    shouldNotify: boolean;
    unsubscribeToken: string | undefined;
}

/**
 * Looks up the email notification preferences for a given email.
 * If no preference row exists, upserts a default one (opted-in).
 *
 * @param email - The email address to check preferences for
 * @param type - Which notification type to check: 'new_feedback' or 'replies'
 * @returns `{ shouldNotify, unsubscribeToken }`
 */
export async function getNotificationPrefs(
    email: string,
    type: NotificationType
): Promise<NotificationPrefs> {
    const adminSupabase = createAdminClient();
    const column = type === 'new_feedback' ? 'notify_new_feedback' : 'notify_replies';

    const { data: prefData } = await adminSupabase
        .from('email_preferences')
        .select(`${column}, unsubscribe_token`)
        .eq('email', email)
        .single();

    let shouldNotify = true;
    let unsubscribeToken = prefData?.unsubscribe_token;

    if (!prefData) {
        // Upsert with default values and retrieve the generated unsubscribe_token
        const { data: newPref } = await adminSupabase
            .from('email_preferences')
            .upsert({ email }, { onConflict: 'email' })
            .select('unsubscribe_token')
            .single();
        if (newPref) {
            unsubscribeToken = newPref.unsubscribe_token;
        }
    } else {
        shouldNotify = (prefData as any)[column];
    }

    return { shouldNotify, unsubscribeToken };
}
