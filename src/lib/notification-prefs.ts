import { createAdminClient } from "@/lib/supabase/admin";

type NotificationType = 'new_feedback' | 'replies' | 'project_created';
type EmailFrequency = 'digest' | 'realtime';

interface NotificationPrefs {
    shouldNotify: boolean;
    emailFrequency: EmailFrequency;
    unsubscribeToken: string | undefined;
}

const isLocalhost = process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ?? false;

/**
 * Looks up the email notification preferences for a given email.
 * If no preference row exists, upserts a default one.
 * On localhost, all notification booleans default to false to avoid dev email noise.
 *
 * @param email - The email address to check preferences for
 * @param type - Which notification type to check: 'new_feedback', 'replies', or 'project_created'
 * @returns `{ shouldNotify, emailFrequency, unsubscribeToken }`
 */
export async function getNotificationPrefs(
    email: string,
    type: NotificationType
): Promise<NotificationPrefs> {
    const adminSupabase = createAdminClient();

    const columnMap: Record<NotificationType, string> = {
        'new_feedback': 'notify_new_feedback',
        'replies': 'notify_replies',
        'project_created': 'notify_project_created'
    };

    const column = columnMap[type];

    const { data: prefData } = await adminSupabase
        .from('email_preferences')
        .select(`${column}, email_frequency, unsubscribe_token`)
        .eq('email', email)
        .single() as any;

    let shouldNotify = !isLocalhost; // default true in prod, false on localhost
    let emailFrequency: EmailFrequency = 'digest';
    let unsubscribeToken = prefData?.unsubscribe_token;

    if (!prefData) {
        // Upsert with defaults — on localhost, all notifications default to off
        const defaults: Record<string, any> = { email };
        if (isLocalhost) {
            defaults.notify_new_feedback = false;
            defaults.notify_replies = false;
            defaults.notify_project_created = false;
        }

        const { data: newPref } = await adminSupabase
            .from('email_preferences')
            .upsert(defaults, { onConflict: 'email' })
            .select('unsubscribe_token, email_frequency')
            .single();
        if (newPref) {
            unsubscribeToken = newPref.unsubscribe_token;
            emailFrequency = (newPref as any).email_frequency || 'digest';
        }
    } else {
        shouldNotify = (prefData as any)[column];
        emailFrequency = prefData.email_frequency || 'digest';
    }

    return { shouldNotify, emailFrequency, unsubscribeToken };
}
