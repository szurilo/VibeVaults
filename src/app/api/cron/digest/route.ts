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
    sendNewSignupNotification,
} from '@/lib/notifications';
import { getNotificationPrefs } from '@/lib/notification-prefs';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueWidgetIdentity } from '@/lib/widget-helpers';

/**
 * Builds a per-recipient widget bootstrap URL for a `project_created` digest
 * item. Returns null if the project has no website_url, or if the recipient
 * isn't recognized as either a workspace member or a client invitee.
 *
 * Members: mints a fresh `widget_identities` row tied to user_id and embeds
 * `?vv_token=<rawToken>`. Clients: reuses the persistent `workspace_invites.id`
 * and embeds `?vv_invite=<inviteId>`. Either way, opening the link on the
 * host site activates the widget for that recipient on that device.
 */
async function buildWidgetUrlForDigestItem(
    recipientEmail: string,
    projectId: string
): Promise<string | null> {
    try {
        const admin = createAdminClient();

        const { data: project } = await admin
            .from('projects')
            .select('id, workspace_id, website_url')
            .eq('id', projectId)
            .maybeSingle();

        if (!project || !project.website_url) return null;

        // Member path
        const { data: profile } = await admin
            .from('profiles')
            .select('id')
            .eq('email', recipientEmail)
            .maybeSingle();

        if (profile) {
            const { data: membership } = await admin
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', project.workspace_id)
                .eq('user_id', profile.id)
                .maybeSingle();

            if (membership) {
                const rawToken = await issueWidgetIdentity({
                    projectId: project.id,
                    email: recipientEmail,
                    userId: profile.id,
                });
                const url = new URL(project.website_url);
                url.searchParams.set('vv_token', rawToken);
                return url.toString();
            }
        }

        // Client path — workspace_invites with role='client' for this email
        const { data: invite } = await admin
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', project.workspace_id)
            .eq('email', recipientEmail)
            .eq('role', 'client')
            .maybeSingle();

        if (invite) {
            const url = new URL(project.website_url);
            url.searchParams.set('vv_invite', invite.id);
            return url.toString();
        }

        return null;
    } catch (e) {
        console.error('buildWidgetUrlForDigestItem failure', e);
        return null;
    }
}

export async function GET() {
    try {
        const pendingItems = await fetchPendingDigestItems();

        if (pendingItems.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        let totalSent = 0;
        const allProcessedIds: string[] = [];

        // Admin signup notifications are routed to ADMIN_EMAIL (server env), not the
        // row's recipient_email, so handle them before the per-recipient grouping.
        // One email per signup — low volume, no batching needed.
        const adminSignupItems = pendingItems.filter(i => i.notification_type === 'admin_new_signup');
        const remainingItems = pendingItems.filter(i => i.notification_type !== 'admin_new_signup');
        for (const item of adminSignupItems) {
            const email = (item.payload.email as string) || '';
            if (email) {
                await sendNewSignupNotification({ userEmail: email });
                totalSent++;
            }
            allProcessedIds.push(item.id);
        }

        const grouped = groupDigestItems(remainingItems);

        for (const [recipientEmail, byType] of grouped) {
            // Process feedback digests
            const feedbackItems = byType.get('new_feedback') || [];
            if (feedbackItems.length > 0) {
                const prefs = await getNotificationPrefs(recipientEmail, 'new_feedback');
                if (prefs.shouldNotify) {
                    await sendFeedbackDigestEmail({
                        to: recipientEmail,
                        items: feedbackItems.map(item => ({
                            content: (item.payload.content as string) || '',
                            sender: item.payload.sender as string,
                            projectName: (item.payload.projectName as string) || '',
                            workspaceId: item.payload.workspaceId as string,
                            projectId: item.payload.projectId as string,
                            feedbackId: item.feedback_id || (item.payload.feedbackId as string),
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
                            replyContent: (item.payload.replyContent as string) || '',
                            sender: (item.payload.sender as string) || '',
                            projectName: (item.payload.projectName as string) || '',
                            feedbackContentPreview: item.payload.originalFeedback as string | undefined,
                            workspaceId: item.payload.workspaceId as string,
                            projectId: item.payload.projectId as string,
                            feedbackId: item.feedback_id || (item.payload.feedbackId as string),
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
                    // Build per-recipient widget URLs only for `created` items
                    // — sequential await since each can mint a widget identity.
                    // Items are typically <10 per recipient per cron tick.
                    const enrichedItems = await Promise.all(projectItems.map(async (item) => {
                        const isCreated = item.notification_type === 'project_created';
                        const projectId = item.payload.projectId as string | undefined;
                        const widgetUrl = isCreated && projectId
                            ? await buildWidgetUrlForDigestItem(recipientEmail, projectId)
                            : null;
                        return {
                            projectName: (item.payload.projectName as string) || '',
                            actorName: (item.payload.actorName as string) || 'A team member',
                            workspaceName: (item.payload.workspaceName as string) || '',
                            type: item.notification_type === 'project_deleted' ? 'deleted' as const : 'created' as const,
                            workspaceId: item.payload.workspaceId as string,
                            projectId: item.payload.projectId as string,
                            widgetUrl: widgetUrl ?? undefined,
                        };
                    }));

                    await sendProjectEventDigestEmail({
                        to: recipientEmail,
                        items: enrichedItems,
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
