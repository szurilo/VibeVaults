/**
 * Main Responsibility: Cron endpoint that processes the email digest queue every 15 minutes.
 * Groups pending emails by recipient + type and sends digest summaries via Resend batch API.
 * Called by Supabase pg_cron + pg_net (no auth needed — endpoint is idempotent and non-destructive).
 *
 * Sensitive Dependencies:
 * - email-digest.ts for queue operations
 * - notifications.ts for digest email templates
 */

import { NextResponse } from 'next/server';
import {
    fetchPendingDigestItems,
    groupDigestItems,
} from '@/lib/email-digest';
import {
    sendFeedbackDigestEmail,
    sendReplyDigestEmail,
    sendProjectEventDigestEmail,
} from '@/lib/notifications';
import { getNotificationPrefs } from '@/lib/notification-prefs';

export async function GET() {
    try {
        const pendingItems = await fetchPendingDigestItems();

        if (pendingItems.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        const grouped = groupDigestItems(pendingItems);
        let totalSent = 0;
        const allProcessedIds: string[] = [];

        for (const [recipientEmail, byType] of grouped) {
            // Process feedback digests
            const feedbackItems = byType.get('new_feedback') || [];
            if (feedbackItems.length > 0) {
                const prefs = await getNotificationPrefs(recipientEmail, 'new_feedback');
                if (prefs.shouldNotify) {
                    await sendFeedbackDigestEmail({
                        to: recipientEmail,
                        items: feedbackItems.map(item => ({
                            content: item.payload.content || '',
                            sender: item.payload.sender,
                            projectName: item.payload.projectName || '',
                            workspaceId: item.payload.workspaceId,
                            projectId: item.payload.projectId,
                            feedbackId: item.feedback_id || item.payload.feedbackId,
                        })),
                        unsubscribeToken: prefs.unsubscribeToken,
                    });
                    totalSent++;
                }
                allProcessedIds.push(...feedbackItems.map(i => i.id));
            }

            // Process reply digests (both 'reply' and 'agency_reply' grouped together)
            const replyItems = [
                ...(byType.get('reply') || []),
                ...(byType.get('agency_reply') || []),
            ];
            if (replyItems.length > 0) {
                const prefs = await getNotificationPrefs(recipientEmail, 'replies');
                if (prefs.shouldNotify) {
                    await sendReplyDigestEmail({
                        to: recipientEmail,
                        items: replyItems.map(item => ({
                            replyContent: item.payload.replyContent || '',
                            sender: item.payload.sender || '',
                            projectName: item.payload.projectName || '',
                            feedbackContentPreview: item.payload.originalFeedback,
                            workspaceId: item.payload.workspaceId,
                            projectId: item.payload.projectId,
                            feedbackId: item.feedback_id || item.payload.feedbackId,
                        })),
                        unsubscribeToken: prefs.unsubscribeToken,
                    });
                    totalSent++;
                }
                allProcessedIds.push(...replyItems.map(i => i.id));
            }

            // Process project event digests (created + deleted grouped together)
            const projectItems = [
                ...(byType.get('project_created') || []),
                ...(byType.get('project_deleted') || []),
            ];
            if (projectItems.length > 0) {
                // Use the first item's type to determine which pref to check
                const hasDeleted = projectItems.some(i => i.notification_type === 'project_deleted');
                const hasCreated = projectItems.some(i => i.notification_type === 'project_created');
                let shouldSend = false;

                if (hasDeleted) {
                    const prefs = await getNotificationPrefs(recipientEmail, 'project_deleted');
                    if (prefs.shouldNotify) shouldSend = true;
                }
                if (hasCreated) {
                    const prefs = await getNotificationPrefs(recipientEmail, 'project_created');
                    if (prefs.shouldNotify) shouldSend = true;
                }

                if (shouldSend) {
                    await sendProjectEventDigestEmail({
                        to: recipientEmail,
                        items: projectItems.map(item => ({
                            projectName: item.payload.projectName || '',
                            actorName: item.payload.actorName || 'A team member',
                            workspaceName: item.payload.workspaceName || '',
                            type: item.notification_type === 'project_deleted' ? 'deleted' as const : 'created' as const,
                            workspaceId: item.payload.workspaceId,
                            projectId: item.payload.projectId,
                        })),
                        unsubscribeToken: (await getNotificationPrefs(recipientEmail, hasDeleted ? 'project_deleted' : 'project_created')).unsubscribeToken,
                    });
                    totalSent++;
                }
                allProcessedIds.push(...projectItems.map(i => i.id));
            }
        }

        return NextResponse.json({ processed: allProcessedIds.length, emailsSent: totalSent });
    } catch (e) {
        console.error('VibeVaults: Digest cron error', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
