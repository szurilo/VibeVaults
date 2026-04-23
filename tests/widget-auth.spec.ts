/**
 * Tier 1 — Abuse-prevention: Widget auth and input validation
 *
 * The widget endpoints are the only fully-public product surfaces. Their input
 * validation + sender-authorization checks are what keep strangers from (a)
 * submitting feedback or replies they shouldn't, (b) pushing oversized payloads
 * through the serverless runtime, and (c) brute-forcing email enumeration.
 *
 * Covered endpoints:
 *   - GET  /api/widget/verify-email  (email authorization check)
 *   - POST /api/widget               (feedback submission)
 *   - POST /api/widget/reply         (reply submission)
 *
 * What we assert:
 *   - Authorization: invited emails pass; strangers get {authorized:false} or 403
 *   - Membership precedence: workspace owner/member emails also pass
 *     (even without a matching workspace_invites row)
 *   - Content limits: >5000 chars rejected
 *   - Input validation: invalid email format, missing fields rejected
 *   - Reply gate: wrong feedback_id for the project rejected
 *   - Side-effects: a rejected request must NOT write a feedback/reply row
 *
 * Not covered here: rate limiting. The in-memory limiter is 60/min per
 * (IP, endpoint). Triggering it requires 61 sequential requests, which is
 * slow and process-local (useless on Vercel with warm-instance sprawl).
 * Lower-value than the assertions above; revisit if we move the limiter
 * into Redis/Upstash.
 *
 * Sensitive Dependencies:
 * - Uses the seeded client's email for the authorized case (they have a
 *   matching workspace_invites row).
 * - Uses the seeded owner's email for the membership-precedence case.
 * - Cleans up any rogue feedback/reply rows in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

// Public endpoints — no auth cookies.
test.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// GET /api/widget/verify-email
// ---------------------------------------------------------------------------

test.describe('GET /api/widget/verify-email', () => {
    test('missing API key → 400', async ({ request }) => {
        const res = await request.get('/api/widget/verify-email?email=foo@example.com');
        expect(res.status()).toBe(400);
    });

    test('invalid email format → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.get(
            `/api/widget/verify-email?key=${seed.apiKey}&email=not-an-email`
        );
        expect(res.status()).toBe(400);
    });

    test('invalid API key → 401 (validateApiKey rejection)', async ({ request }) => {
        const res = await request.get(
            '/api/widget/verify-email?key=bogus&email=foo@example.com'
        );
        expect(res.status()).toBe(401);
    });

    test('invited client email → {authorized: true}', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.get(
            `/api/widget/verify-email?key=${seed.apiKey}&email=${encodeURIComponent(seed.clientEmail)}`
        );
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.authorized).toBe(true);
    });

    test('workspace owner email → {authorized: true} (members beat invites)', async ({ request }) => {
        // Owners/members have NO workspace_invites row — they're authorized via
        // workspace_members. A regression in the precedence order would lock
        // owners out of their own widget.
        const seed = getSeedResult();
        const res = await request.get(
            `/api/widget/verify-email?key=${seed.apiKey}&email=${encodeURIComponent(seed.ownerEmail)}`
        );
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.authorized).toBe(true);
    });

    test('stranger email → {authorized: false}', async ({ request }) => {
        const seed = getSeedResult();
        const stranger = `e2e-stranger-${Date.now()}@example.com`;
        const res = await request.get(
            `/api/widget/verify-email?key=${seed.apiKey}&email=${encodeURIComponent(stranger)}`
        );
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.authorized).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// POST /api/widget  (feedback submission)
// ---------------------------------------------------------------------------

test.describe('POST /api/widget (feedback submission)', () => {
    // Track any rows we accidentally create so we can clean them up.
    const createdFeedbackIds: string[] = [];

    test.afterAll(async () => {
        if (createdFeedbackIds.length) {
            await supabaseAdmin.from('feedbacks').delete().in('id', createdFeedbackIds);
        }
    });

    test('stranger sender email → 403 and no feedback row written', async ({ request }) => {
        const seed = getSeedResult();
        const strangerContent = `should-not-persist-${Date.now()}`;
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: strangerContent,
                type: 'Feature',
                sender: `e2e-stranger-${Date.now()}@example.com`,
            },
        });
        expect(res.status()).toBe(403);

        const { data: leaked } = await supabaseAdmin
            .from('feedbacks')
            .select('id')
            .eq('project_id', seed.projectId)
            .eq('content', strangerContent);
        expect(leaked?.length ?? 0, 'stranger submission must not persist').toBe(0);
    });

    test('content over 5000 chars → 400 and no row written', async ({ request }) => {
        const seed = getSeedResult();
        const huge = 'x'.repeat(5001);
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: huge,
                type: 'Feature',
                sender: seed.clientEmail,
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/too long/i);

        // Sanity: no feedback row matching the oversized content should exist.
        const { data: leaked } = await supabaseAdmin
            .from('feedbacks')
            .select('id')
            .eq('project_id', seed.projectId)
            .eq('content', huge);
        expect(leaked?.length ?? 0).toBe(0);
    });

    test('empty / whitespace-only content → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: '   ',
                type: 'Feature',
                sender: seed.clientEmail,
            },
        });
        expect(res.status()).toBe(400);
    });

    test('malformed sender email → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: 'legit text',
                type: 'Feature',
                sender: 'not-an-email',
            },
        });
        expect(res.status()).toBe(400);
    });

    test('missing sender → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: 'legit text',
                type: 'Feature',
            },
        });
        expect(res.status()).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// POST /api/widget/reply
// ---------------------------------------------------------------------------

test.describe('POST /api/widget/reply', () => {
    // Seed a feedback row we can reply against. Cleaned up in afterAll along
    // with any reply rows the negative tests accidentally create.
    let feedbackId: string;
    const createdReplyIds: string[] = [];

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data, error } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: `E2E reply target ${Date.now()}`,
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();
        if (error || !data) throw new Error(`reply-target insert failed: ${error?.message}`);
        feedbackId = data.id;
    });

    test.afterAll(async () => {
        if (createdReplyIds.length) {
            await supabaseAdmin.from('feedback_replies').delete().in('id', createdReplyIds);
        }
        if (feedbackId) {
            await supabaseAdmin.from('feedback_replies').delete().eq('feedback_id', feedbackId);
            await supabaseAdmin.from('feedbacks').delete().eq('id', feedbackId);
        }
    });

    test('stranger sender → 403 and no reply row written', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `stranger-reply-${Date.now()}`;
        const res = await request.post('/api/widget/reply', {
            data: {
                feedbackId,
                content: marker,
                apiKey: seed.apiKey,
                senderEmail: `e2e-stranger-${Date.now()}@example.com`,
            },
        });
        expect(res.status()).toBe(403);

        const { data: leaked } = await supabaseAdmin
            .from('feedback_replies')
            .select('id')
            .eq('feedback_id', feedbackId)
            .eq('content', marker);
        expect(leaked?.length ?? 0).toBe(0);
    });

    test('empty content and no attachments → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/reply', {
            data: {
                feedbackId,
                content: '   ',
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                hasAttachments: false,
            },
        });
        expect(res.status()).toBe(400);
    });

    test('content over 5000 chars → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/reply', {
            data: {
                feedbackId,
                content: 'x'.repeat(5001),
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/too long/i);
    });

    test('malformed sender email → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/reply', {
            data: {
                feedbackId,
                content: 'valid text',
                apiKey: seed.apiKey,
                senderEmail: 'not-an-email',
            },
        });
        expect(res.status()).toBe(400);
    });

    test('feedbackId from another project → 401 (no cross-project replies)', async ({ request }) => {
        // This is the key isolation assertion: even with a valid API key + an
        // authorized sender, you cannot reply to a feedback that belongs to a
        // different project.
        const seed = getSeedResult();

        // Create a disposable owner + project, then a feedback under it.
        const foreignEmail = `e2e-foreign-${Date.now()}@example.com`;
        const { data: user } = await supabaseAdmin.auth.admin.createUser({
            email: foreignEmail,
            email_confirm: true,
        });
        if (!user.user) throw new Error('foreign user create failed');
        await new Promise(r => setTimeout(r, 800)); // let workspace trigger settle

        const { data: foreignWs } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', user.user.id)
            .single();
        const { data: foreignProject } = await supabaseAdmin
            .from('projects')
            .insert({
                name: 'Foreign Project',
                website_url: 'https://foreign.example.com',
                workspace_id: foreignWs!.id,
                user_id: user.user.id,
            })
            .select('id')
            .single();
        const { data: foreignFeedback } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: foreignProject!.id,
                content: 'foreign feedback',
                type: 'Feature',
                sender: foreignEmail,
            })
            .select('id')
            .single();

        try {
            const res = await request.post('/api/widget/reply', {
                data: {
                    feedbackId: foreignFeedback!.id, // ← foreign
                    content: 'cross-project attempt',
                    apiKey: seed.apiKey,              // ← seed's key
                    senderEmail: seed.clientEmail,
                },
            });
            // verifyApiKeyForFeedback returns { error: "Feedback not found for this project" } → 401
            expect(res.status()).toBe(401);
        } finally {
            // Cleanup — deleteUser cascades through workspace/project/feedback.
            await supabaseAdmin.auth.admin.deleteUser(user.user.id);
        }
    });
});
