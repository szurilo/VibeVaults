/**
 * Main Responsibility: Manages email digest queuing, cooldown checks, and batch digest processing
 * to reduce Resend email volume. Feedback emails use a 15-min digest window; reply emails use
 * a 10-min per-thread cooldown.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client for queue reads/writes (bypasses RLS)
 * - Resend batch API via notifications.ts for sending grouped emails
 */

import { createAdminClient } from '@/lib/supabase/admin';

const FEEDBACK_DIGEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REPLY_COOLDOWN_MS = 10 * 60 * 1000;         // 10 minutes
const PROJECT_EVENT_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes

type DigestNotificationType = 'new_feedback' | 'reply' | 'agency_reply' | 'project_created' | 'project_deleted';

interface QueueEmailParams {
    recipientEmail: string;
    notificationType: DigestNotificationType;
    projectId: string;
    feedbackId?: string;
    payload: Record<string, any>;
}

/**
 * Check if a feedback notification was recently sent to this recipient for this project.
 * Returns true if we should send immediately (no recent email), false if we should queue.
 */
export async function shouldSendFeedbackImmediately(
    recipientEmail: string,
    projectId: string
): Promise<boolean> {
    const adminSupabase = createAdminClient();
    const cutoff = new Date(Date.now() - FEEDBACK_DIGEST_WINDOW_MS).toISOString();

    const { data } = await adminSupabase
        .from('email_digest_queue')
        .select('id')
        .eq('recipient_email', recipientEmail)
        .eq('notification_type', 'new_feedback')
        .eq('project_id', projectId)
        .not('sent_at', 'is', null)
        .gte('sent_at', cutoff)
        .limit(1);

    return !data || data.length === 0;
}

/**
 * Check if a reply notification was recently sent to this recipient for this feedback thread.
 * Returns true if we should send immediately (no recent email), false if we should queue.
 */
export async function shouldSendReplyImmediately(
    recipientEmail: string,
    feedbackId: string
): Promise<boolean> {
    const adminSupabase = createAdminClient();
    const cutoff = new Date(Date.now() - REPLY_COOLDOWN_MS).toISOString();

    const { data } = await adminSupabase
        .from('email_digest_queue')
        .select('id')
        .eq('recipient_email', recipientEmail)
        .eq('feedback_id', feedbackId)
        .not('sent_at', 'is', null)
        .gte('sent_at', cutoff)
        .limit(1);

    return !data || data.length === 0;
}

/**
 * Check if a project event notification was recently sent to this recipient.
 * Uses a 15-min window — first event is immediate, subsequent ones are queued.
 */
export async function shouldSendProjectEventImmediately(
    recipientEmail: string,
    notificationType: 'project_created' | 'project_deleted'
): Promise<boolean> {
    const adminSupabase = createAdminClient();
    const cutoff = new Date(Date.now() - PROJECT_EVENT_WINDOW_MS).toISOString();

    const { data } = await adminSupabase
        .from('email_digest_queue')
        .select('id')
        .eq('recipient_email', recipientEmail)
        .eq('notification_type', notificationType)
        .not('sent_at', 'is', null)
        .gte('sent_at', cutoff)
        .limit(1);

    return !data || data.length === 0;
}

/**
 * Record that an email was sent immediately (for cooldown tracking).
 */
export async function recordEmailSent(params: QueueEmailParams): Promise<void> {
    const adminSupabase = createAdminClient();
    await adminSupabase.from('email_digest_queue').insert({
        recipient_email: params.recipientEmail,
        notification_type: params.notificationType,
        project_id: params.projectId,
        feedback_id: params.feedbackId || null,
        payload: params.payload,
        sent_at: new Date().toISOString()
    });
}

/**
 * Queue an email for digest sending (will be picked up by the cron job).
 */
export async function queueDigestEmail(params: QueueEmailParams): Promise<void> {
    const adminSupabase = createAdminClient();
    await adminSupabase.from('email_digest_queue').insert({
        recipient_email: params.recipientEmail,
        notification_type: params.notificationType,
        project_id: params.projectId,
        feedback_id: params.feedbackId || null,
        payload: params.payload,
        sent_at: null // null = pending
    });
}

export interface PendingDigestItem {
    id: string;
    recipient_email: string;
    notification_type: DigestNotificationType;
    project_id: string;
    feedback_id: string | null;
    payload: Record<string, any>;
    created_at: string;
}

/**
 * Fetch all pending (unsent) digest items, grouped by recipient + type.
 */
export async function fetchPendingDigestItems(): Promise<PendingDigestItem[]> {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
        .from('email_digest_queue')
        .select('*')
        .is('sent_at', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('VibeVaults: Failed to fetch digest queue', error);
        return [];
    }

    return (data || []) as PendingDigestItem[];
}

/**
 * Mark digest items as sent after batch processing.
 */
export async function markDigestItemsSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const adminSupabase = createAdminClient();
    await adminSupabase
        .from('email_digest_queue')
        .update({ sent_at: new Date().toISOString() })
        .in('id', ids);
}

/**
 * Groups pending items by recipient email, then by notification type.
 */
export function groupDigestItems(items: PendingDigestItem[]): Map<string, Map<DigestNotificationType, PendingDigestItem[]>> {
    const grouped = new Map<string, Map<DigestNotificationType, PendingDigestItem[]>>();

    for (const item of items) {
        if (!grouped.has(item.recipient_email)) {
            grouped.set(item.recipient_email, new Map());
        }
        const byType = grouped.get(item.recipient_email)!;
        if (!byType.has(item.notification_type)) {
            byType.set(item.notification_type, []);
        }
        byType.get(item.notification_type)!.push(item);
    }

    return grouped;
}
