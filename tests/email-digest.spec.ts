/**
 * Tier 1 — UX + deliverability: Email digest queue
 *
 * The digest system keeps Resend email volume sane:
 *   - Feedback emails: 15-min digest window per (recipient, project). First
 *     email is sent immediately; subsequent ones are queued.
 *   - Reply emails: 10-min cooldown per (recipient, feedback thread).
 *   - Queued items are drained by GET /api/cron/digest (Supabase pg_cron
 *     fires this URL every 15 minutes via pg_net).
 *
 * A regression here manifests silently: users either get spammed (cooldown
 * broken) or stop receiving emails entirely (cron fails / claim never flips).
 * The queue rows are the load-bearing contract between the trigger path and
 * the cron; this suite asserts the contract directly.
 *
 * Covered:
 *   1. shouldSendFeedbackImmediately: true first time → record → false inside
 *      the 15-min window.
 *   2. shouldSendFeedbackImmediately: a cooldown row OLDER than 15 min does
 *      NOT suppress a new send.
 *   3. shouldSendReplyImmediately: true first time → record → false inside
 *      the 10-min window, scoped per-feedback-thread (another feedback's
 *      cooldown must NOT leak into this thread).
 *   4. /api/cron/digest flips sent_at for pending rows (idempotent claim:
 *      second call leaves them alone).
 *   5. Atomic claim — two concurrent cron calls do not double-process.
 *
 * Intentionally NOT covered: actual email delivery. On localhost
 * NEXT_PUBLIC_APP_URL=http://localhost:3000 → getNotificationPrefs returns
 * shouldNotify=false by default, so Resend isn't called. We assert the queue
 * contract, which is what the email delivery depends on.
 *
 * Sensitive Dependencies:
 * - Imports helpers from ../src/lib/email-digest directly (admin-only module,
 *   no HTTP round-trip needed for unit-like checks).
 * - Uses unique recipient emails per test so cleanup is scoped.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import {
    shouldSendFeedbackImmediately,
    shouldSendReplyImmediately,
    recordEmailSent,
    queueDigestEmail,
    fetchPendingDigestItems,
} from '../src/lib/email-digest';

test.describe.configure({ mode: 'serial' });

// Unique per-run prefix so we can sweep up our own rows in afterAll.
const RECIPIENT_PREFIX = `e2e-digest-${Date.now()}`;

test.afterAll(async () => {
    await supabaseAdmin
        .from('email_digest_queue')
        .delete()
        .like('recipient_email', `${RECIPIENT_PREFIX}%`);
});

// ---------------------------------------------------------------------------
// 1 + 2. shouldSendFeedbackImmediately — window semantics
// ---------------------------------------------------------------------------

test.describe('shouldSendFeedbackImmediately', () => {
    test('first feedback email is immediate; repeats within the 15-min window are not', async () => {
        const seed = getSeedResult();
        const recipient = `${RECIPIENT_PREFIX}-feedback-window@example.com`;

        expect(
            await shouldSendFeedbackImmediately(recipient, seed.projectId),
            'first email must be immediate'
        ).toBe(true);

        await recordEmailSent({
            recipientEmail: recipient,
            notificationType: 'new_feedback',
            projectId: seed.projectId,
            payload: { marker: 'first' },
        });

        expect(
            await shouldSendFeedbackImmediately(recipient, seed.projectId),
            'second email within the window must be queued (not immediate)'
        ).toBe(false);
    });

    test('a recorded send older than 15 min no longer suppresses', async () => {
        const seed = getSeedResult();
        const recipient = `${RECIPIENT_PREFIX}-feedback-expired@example.com`;

        // Insert a cooldown row with sent_at beyond the 15-min window (20 min ago).
        const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
        await supabaseAdmin.from('email_digest_queue').insert({
            recipient_email: recipient,
            notification_type: 'new_feedback',
            project_id: seed.projectId,
            payload: { marker: 'stale' },
            sent_at: twentyMinAgo,
        });

        expect(
            await shouldSendFeedbackImmediately(recipient, seed.projectId),
            'stale cooldown must not suppress new sends'
        ).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. shouldSendReplyImmediately — per-thread cooldown
// ---------------------------------------------------------------------------

test.describe('shouldSendReplyImmediately', () => {
    test('cooldown is scoped per feedback_id (other threads unaffected)', async () => {
        const recipient = `${RECIPIENT_PREFIX}-reply-scope@example.com`;
        const seed = getSeedResult();

        // Create two throwaway feedback rows so we have real feedback_ids.
        const { data: fbA } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'digest-scope A',
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();
        const { data: fbB } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'digest-scope B',
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();

        try {
            // No prior sends for either thread → both immediate.
            expect(await shouldSendReplyImmediately(recipient, fbA!.id)).toBe(true);
            expect(await shouldSendReplyImmediately(recipient, fbB!.id)).toBe(true);

            // Record a send for thread A only.
            await recordEmailSent({
                recipientEmail: recipient,
                notificationType: 'reply',
                projectId: seed.projectId,
                feedbackId: fbA!.id,
                payload: {},
            });

            // Thread A is cooled down; thread B must still be immediate.
            expect(await shouldSendReplyImmediately(recipient, fbA!.id)).toBe(false);
            expect(
                await shouldSendReplyImmediately(recipient, fbB!.id),
                'reply cooldown must not leak across threads'
            ).toBe(true);
        } finally {
            // Cleanup — notifications were created by notify_new_reply on insert,
            // so wipe those first along with the feedbacks.
            await supabaseAdmin
                .from('notifications')
                .delete()
                .in('feedback_id', [fbA!.id, fbB!.id]);
            await supabaseAdmin
                .from('feedbacks')
                .delete()
                .in('id', [fbA!.id, fbB!.id]);
        }
    });
});

// ---------------------------------------------------------------------------
// 4. /api/cron/digest — drains pending items, second call is a no-op
// ---------------------------------------------------------------------------

test.describe('GET /api/cron/digest', () => {
    test('claims pending rows and flips sent_at; re-running does not reprocess', async ({ request }) => {
        const seed = getSeedResult();
        const recipient = `${RECIPIENT_PREFIX}-cron@example.com`;

        // Queue two pending items (sent_at = null).
        await queueDigestEmail({
            recipientEmail: recipient,
            notificationType: 'new_feedback',
            projectId: seed.projectId,
            payload: { content: 'queued 1', sender: seed.clientEmail, projectName: 'test' },
        });
        await queueDigestEmail({
            recipientEmail: recipient,
            notificationType: 'new_feedback',
            projectId: seed.projectId,
            payload: { content: 'queued 2', sender: seed.clientEmail, projectName: 'test' },
        });

        const beforePending = await supabaseAdmin
            .from('email_digest_queue')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_email', recipient)
            .is('sent_at', null);
        expect(beforePending.count, 'two pending rows should exist pre-cron').toBe(2);

        // First cron run — should drain both.
        const first = await request.get('/api/cron/digest');
        expect(first.ok(), `cron status: ${first.status()}`).toBeTruthy();

        const afterPending = await supabaseAdmin
            .from('email_digest_queue')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_email', recipient)
            .is('sent_at', null);
        expect(afterPending.count, 'cron must clear pending rows').toBe(0);

        const claimed = await supabaseAdmin
            .from('email_digest_queue')
            .select('id, sent_at', { count: 'exact' })
            .eq('recipient_email', recipient)
            .not('sent_at', 'is', null);
        expect(claimed.count, 'both rows should now have sent_at set').toBe(2);

        // Capture sent_at before second call so we can assert idempotency.
        const firstSentAts = (claimed.data ?? []).map(r => r.sent_at).sort();

        // Second cron run — nothing left to process; existing rows must be untouched.
        const second = await request.get('/api/cron/digest');
        expect(second.ok()).toBeTruthy();

        const { data: postSecond } = await supabaseAdmin
            .from('email_digest_queue')
            .select('id, sent_at')
            .eq('recipient_email', recipient);
        const secondSentAts = (postSecond ?? []).map(r => r.sent_at).sort();
        expect(
            secondSentAts,
            'second cron run must not re-stamp already-processed rows'
        ).toEqual(firstSentAts);
    });

    test('concurrent cron calls do not double-process the same queue item', async ({ request }) => {
        const seed = getSeedResult();
        const recipient = `${RECIPIENT_PREFIX}-concurrent@example.com`;

        // Queue a single pending row.
        await queueDigestEmail({
            recipientEmail: recipient,
            notificationType: 'new_feedback',
            projectId: seed.projectId,
            payload: { content: 'race-target', sender: seed.clientEmail, projectName: 'test' },
        });

        // Fire two cron calls as close to simultaneously as possible.
        const [a, b] = await Promise.all([
            request.get('/api/cron/digest'),
            request.get('/api/cron/digest'),
        ]);
        expect(a.ok() && b.ok(), `statuses ${a.status()}/${b.status()}`).toBeTruthy();

        // There must be exactly one row for this recipient, with sent_at set
        // once. A regression in the atomic claim would produce either a NULL
        // sent_at (missed) or duplicate processing signals.
        const { data: rows } = await supabaseAdmin
            .from('email_digest_queue')
            .select('id, sent_at')
            .eq('recipient_email', recipient);
        expect(rows?.length).toBe(1);
        expect(rows?.[0].sent_at, 'the single row must be claimed').not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 5. fetchPendingDigestItems direct — sanity check the claim primitive
// ---------------------------------------------------------------------------

test.describe('fetchPendingDigestItems (claim primitive)', () => {
    test('atomically claims pending rows; second call returns none of the same', async () => {
        const seed = getSeedResult();
        const recipient = `${RECIPIENT_PREFIX}-claim-primitive@example.com`;

        await queueDigestEmail({
            recipientEmail: recipient,
            notificationType: 'new_feedback',
            projectId: seed.projectId,
            payload: { marker: 'claim-me' },
        });

        const first = await fetchPendingDigestItems();
        const mine = first.filter(r => r.recipient_email === recipient);
        expect(mine.length, 'first call must claim my row').toBe(1);

        const second = await fetchPendingDigestItems();
        const mineAgain = second.filter(r => r.recipient_email === recipient);
        expect(mineAgain.length, 'second call must not re-claim the same row').toBe(0);
    });
});
