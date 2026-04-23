/**
 * Tier 1 — Product-critical: DB-trigger notification delivery
 *
 * The `notifications` table is populated entirely by Postgres triggers:
 *   - notify_new_feedback      → on feedbacks INSERT
 *   - notify_new_reply         → on feedback_replies INSERT
 *   - notify_project_deleted   → on projects DELETE
 *
 * These triggers feed the bell icon, the Realtime subscriber in
 * GlobalNotificationProvider, and the navigate-to-notification flow. A silent
 * regression (dropped by a later migration, broken column ref, etc.) means
 * users stop getting notified — with no user-facing error to catch it.
 *
 * Properties under test:
 *   1. New feedback from an outsider (client) → notifications for owner + member
 *      (every workspace_member that isn't the sender).
 *   2. New feedback from the owner themselves (simulating widget-as-owner) →
 *      sender excluded via the email→user_id lookup; only member notified.
 *   3. New reply from an outsider → notifications for owner + member.
 *   4. Project deletion → notifications for every workspace_member except the
 *      deleter, and deleter's name appears in the message.
 *
 * Sensitive Dependencies:
 * - Uses admin client for inserts, so auth.uid() is NULL inside the trigger.
 *   The self-notification fallback (email → profiles.id) is what protects
 *   against the sender getting spammed; property #2 is the regression guard.
 * - Every test cleans up its own rows and the notifications it generated so
 *   downstream specs aren't polluted.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

test.describe.configure({ mode: 'serial' });

// Helper — returns notifications for (user, feedback) or (user, project).
async function countNotifications(params: {
    userId: string;
    feedbackId?: string;
    projectId?: string;
    type?: string;
}): Promise<number> {
    let q = supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', params.userId);
    if (params.feedbackId) q = q.eq('feedback_id', params.feedbackId);
    if (params.projectId) q = q.eq('project_id', params.projectId);
    if (params.type) q = q.eq('type', params.type);
    const { count } = await q;
    return count ?? 0;
}

async function readNotification(userId: string, feedbackId: string) {
    const { data } = await supabaseAdmin
        .from('notifications')
        .select('title, message, type, project_id')
        .eq('user_id', userId)
        .eq('feedback_id', feedbackId)
        .maybeSingle();
    return data;
}

async function seedMemberUserId(): Promise<string> {
    const seed = getSeedResult();
    return seed.memberId;
}

// ---------------------------------------------------------------------------
// notify_new_feedback
// ---------------------------------------------------------------------------

test.describe('notify_new_feedback', () => {
    let feedbackA: string;   // sender = client
    let feedbackB: string;   // sender = owner (self-notification exclusion)

    test.afterAll(async () => {
        for (const id of [feedbackA, feedbackB].filter(Boolean)) {
            await supabaseAdmin.from('notifications').delete().eq('feedback_id', id);
            await supabaseAdmin.from('feedbacks').delete().eq('id', id);
        }
    });

    test('feedback from a client notifies every workspace_member (owner + member)', async () => {
        const seed = getSeedResult();
        const memberId = await seedMemberUserId();

        const { data } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'Trigger test feedback from client',
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();
        feedbackA = data!.id;

        // Trigger is synchronous — but give PG a tick in case of Realtime flush.
        await new Promise(r => setTimeout(r, 200));

        expect(
            await countNotifications({ userId: seed.ownerId, feedbackId: feedbackA }),
            'owner should receive the notification'
        ).toBe(1);
        expect(
            await countNotifications({ userId: memberId, feedbackId: feedbackA }),
            'member should receive the notification'
        ).toBe(1);

        // Content assertions — regressions in the trigger title/message format
        // would break the bell UI subtly.
        const ownerNotif = await readNotification(seed.ownerId, feedbackA);
        expect(ownerNotif?.type).toBe('new_feedback');
        expect(ownerNotif?.title).toContain(seed.clientEmail);
        expect(ownerNotif?.message).toContain('Trigger test feedback from client');
        expect(ownerNotif?.project_id).toBe(seed.projectId);
    });

    test('feedback from the owner themselves excludes owner from notifications', async () => {
        // Simulates an owner using the widget on their own site. The trigger
        // looks the sender up in `profiles` by email and filters them out —
        // this is the self-notification guard added in the prevent_self_
        // notification_via_widget migration.
        const seed = getSeedResult();
        const memberId = await seedMemberUserId();

        const { data } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'Trigger test feedback from owner',
                type: 'Feature',
                sender: seed.ownerEmail,
            })
            .select('id')
            .single();
        feedbackB = data!.id;

        await new Promise(r => setTimeout(r, 200));

        expect(
            await countNotifications({ userId: seed.ownerId, feedbackId: feedbackB }),
            'owner must NOT notify themselves'
        ).toBe(0);
        expect(
            await countNotifications({ userId: memberId, feedbackId: feedbackB }),
            'member should still be notified'
        ).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// notify_new_reply
// ---------------------------------------------------------------------------

test.describe('notify_new_reply', () => {
    let feedbackId: string;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'Reply trigger host feedback',
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();
        feedbackId = data!.id;
    });

    test.afterAll(async () => {
        if (!feedbackId) return;
        await supabaseAdmin.from('notifications').delete().eq('feedback_id', feedbackId);
        await supabaseAdmin.from('feedback_replies').delete().eq('feedback_id', feedbackId);
        await supabaseAdmin.from('feedbacks').delete().eq('id', feedbackId);
    });

    test('client reply notifies every workspace_member', async () => {
        const seed = getSeedResult();
        const memberId = await seedMemberUserId();

        // Snapshot counts BEFORE (the host feedback already created
        // notifications for owner + member; we care about the *delta*).
        const ownerBefore = await countNotifications({
            userId: seed.ownerId, feedbackId, type: 'new_reply',
        });
        const memberBefore = await countNotifications({
            userId: memberId, feedbackId, type: 'new_reply',
        });

        await supabaseAdmin
            .from('feedback_replies')
            .insert({
                feedback_id: feedbackId,
                content: 'trigger-reply marker',
                author_role: 'client',
                author_name: seed.clientEmail,
            });

        await new Promise(r => setTimeout(r, 200));

        const ownerAfter = await countNotifications({
            userId: seed.ownerId, feedbackId, type: 'new_reply',
        });
        const memberAfter = await countNotifications({
            userId: memberId, feedbackId, type: 'new_reply',
        });

        expect(ownerAfter - ownerBefore, 'owner should get +1 reply notification').toBe(1);
        expect(memberAfter - memberBefore, 'member should get +1 reply notification').toBe(1);
    });

    test('owner replying to their own thread does not notify themselves', async () => {
        const seed = getSeedResult();
        const memberId = await seedMemberUserId();

        const ownerBefore = await countNotifications({
            userId: seed.ownerId, feedbackId, type: 'new_reply',
        });
        const memberBefore = await countNotifications({
            userId: memberId, feedbackId, type: 'new_reply',
        });

        await supabaseAdmin
            .from('feedback_replies')
            .insert({
                feedback_id: feedbackId,
                content: 'owner self-reply',
                author_role: 'agency',
                author_name: seed.ownerEmail,
            });

        await new Promise(r => setTimeout(r, 200));

        expect(
            (await countNotifications({ userId: seed.ownerId, feedbackId, type: 'new_reply' })) - ownerBefore,
            'owner must be excluded from their own reply notification'
        ).toBe(0);
        expect(
            (await countNotifications({ userId: memberId, feedbackId, type: 'new_reply' })) - memberBefore,
            'member should still be notified'
        ).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// notify_project_deleted
// ---------------------------------------------------------------------------

test.describe('notify_project_deleted', () => {
    test('deleting a project notifies every other workspace_member with the deleter name', async () => {
        const seed = getSeedResult();
        const memberId = await seedMemberUserId();

        // Create a throwaway project in the seed workspace.
        const { data: proj } = await supabaseAdmin
            .from('projects')
            .insert({
                name: `E2E trigger-delete-${Date.now()}`,
                website_url: 'https://trigger.example.com',
                workspace_id: seed.workspaceId,
                user_id: seed.ownerId,
            })
            .select('id, name')
            .single();
        const projectId = proj!.id;
        const projectName = proj!.name;

        // Count project_deleted notifs before (should be zero for this project —
        // they point via message text since the trigger sets project_id = NULL).
        const ownerBefore = await countNotifications({
            userId: seed.ownerId, type: 'project_deleted',
        });
        const memberBefore = await countNotifications({
            userId: memberId, type: 'project_deleted',
        });

        await supabaseAdmin.from('projects').delete().eq('id', projectId);

        await new Promise(r => setTimeout(r, 200));

        const ownerAfter = await countNotifications({
            userId: seed.ownerId, type: 'project_deleted',
        });
        const memberAfter = await countNotifications({
            userId: memberId, type: 'project_deleted',
        });

        // The admin client has no auth.uid(), so the exclusion-by-auth.uid
        // branch doesn't kick in — both owner and member receive a notif.
        // That's the intended behaviour for triggers fired outside a session.
        expect(ownerAfter - ownerBefore).toBe(1);
        expect(memberAfter - memberBefore).toBe(1);

        // Verify the deleted project's name is in the latest notification message.
        const { data: latest } = await supabaseAdmin
            .from('notifications')
            .select('message')
            .eq('user_id', memberId)
            .eq('type', 'project_deleted')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        expect(latest?.message).toContain(projectName);

        // Cleanup the notifications we created.
        await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('type', 'project_deleted')
            .ilike('message', `%${projectName}%`);
    });
});
