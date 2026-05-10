/**
 * Tier 1 — Abuse-prevention: Widget auth and input validation
 *
 * The widget endpoints are the only fully-public product surfaces. Every
 * widget API request now carries `Authorization: Bearer <token>` (or
 * `?token=` for SSE) — the legacy email-prompt flow + `/api/widget/verify-email`
 * route were removed in slice C2. The bearer's identity is server-authoritative;
 * `request.body.sender` is no longer accepted.
 *
 * Covered endpoints:
 *   - POST /api/widget               (feedback submission)
 *   - POST /api/widget/reply         (reply submission)
 *
 * What we assert:
 *   - Anonymous (no Bearer) → 401, no row written
 *   - Bogus Bearer → 401, no row written
 *   - Valid Bearer → request proceeds; identity.email becomes the sender
 *   - Content limits: >5000 chars rejected (400)
 *   - Empty content rejected (400)
 *   - Reply gate: feedback_id from a different project rejected (404)
 *   - Side-effects: rejected requests must NOT write a feedback/reply row
 *
 * Not covered here: rate limiting (60/min per IP+endpoint, process-local —
 * impractical to exercise reliably).
 *
 * Sensitive Dependencies:
 * - Uses the seeded client's bearer token (`widgetTokens.client`) for the
 *   authorized cases. The widget identity row is created at seed time.
 * - Cleans up any rogue feedback/reply rows in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

// Public endpoints — no Supabase auth cookies.
test.use({ storageState: AUTH_FILES.empty });

// ---------------------------------------------------------------------------
// POST /api/widget  (feedback submission)
// ---------------------------------------------------------------------------

test.describe('POST /api/widget (feedback submission)', () => {
    const createdFeedbackIds: string[] = [];

    test.afterAll(async () => {
        if (createdFeedbackIds.length) {
            await supabaseAdmin.from('feedbacks').delete().in('id', createdFeedbackIds);
        }
    });

    test('happy path — valid Bearer submits a feedback whose sender = identity.email', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `auth-spec-happy-${Date.now()}`;
        const res = await request.post('/api/widget', {
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                apiKey: seed.apiKey,
                content: marker,
                type: 'Feature',
            },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.feedback_id).toBeTruthy();
        createdFeedbackIds.push(body.feedback_id);

        const { data: row } = await supabaseAdmin
            .from('feedbacks')
            .select('content, sender, project_id')
            .eq('id', body.feedback_id)
            .single();
        expect(row?.content).toBe(marker);
        expect(row?.project_id).toBe(seed.projectId);
        // Sender comes from the bearer's identity row, not the request body.
        expect(row?.sender).toBe(seed.clientEmail);
    });

    test('no Bearer token → 401 and no feedback row written', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `should-not-persist-anon-${Date.now()}`;
        const res = await request.post('/api/widget', {
            data: {
                apiKey: seed.apiKey,
                content: marker,
                type: 'Feature',
            },
        });
        expect(res.status()).toBe(401);

        const { data: leaked } = await supabaseAdmin
            .from('feedbacks')
            .select('id')
            .eq('project_id', seed.projectId)
            .eq('content', marker);
        expect(leaked?.length ?? 0, 'anonymous submission must not persist').toBe(0);
    });

    test('bogus Bearer token → 401 and no feedback row written', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `should-not-persist-bogus-${Date.now()}`;
        const res = await request.post('/api/widget', {
            headers: { Authorization: `Bearer not-a-real-token-${Date.now()}` },
            data: {
                apiKey: seed.apiKey,
                content: marker,
                type: 'Feature',
            },
        });
        expect(res.status()).toBe(401);

        const { data: leaked } = await supabaseAdmin
            .from('feedbacks')
            .select('id')
            .eq('project_id', seed.projectId)
            .eq('content', marker);
        expect(leaked?.length ?? 0, 'bogus-token submission must not persist').toBe(0);
    });

    test('content over 5000 chars → 400 and no row written', async ({ request }) => {
        const seed = getSeedResult();
        const huge = 'x'.repeat(5001);
        const res = await request.post('/api/widget', {
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                apiKey: seed.apiKey,
                content: huge,
                type: 'Feature',
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/too long/i);

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
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                apiKey: seed.apiKey,
                content: '   ',
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

    test('happy path — valid Bearer posts a reply attributed to identity.email', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `auth-spec-reply-${Date.now()}`;
        const res = await request.post('/api/widget/reply', {
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                feedbackId,
                content: marker,
                apiKey: seed.apiKey,
            },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.replyId).toBeTruthy();
        createdReplyIds.push(body.replyId);

        const { data: row } = await supabaseAdmin
            .from('feedback_replies')
            .select('content, author_name, author_role')
            .eq('id', body.replyId)
            .single();
        expect(row?.content).toBe(marker);
        // author_name is the identity email, not anything the body claimed.
        expect(row?.author_name).toBe(seed.clientEmail);
        expect(row?.author_role).toBe('client');
    });

    test('no Bearer token → 401 and no reply row written', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `anon-reply-${Date.now()}`;
        const res = await request.post('/api/widget/reply', {
            data: {
                feedbackId,
                content: marker,
                apiKey: seed.apiKey,
            },
        });
        expect(res.status()).toBe(401);

        const { data: leaked } = await supabaseAdmin
            .from('feedback_replies')
            .select('id')
            .eq('feedback_id', feedbackId)
            .eq('content', marker);
        expect(leaked?.length ?? 0).toBe(0);
    });

    test('bogus Bearer → 401 and no reply row written', async ({ request }) => {
        const seed = getSeedResult();
        const marker = `bogus-reply-${Date.now()}`;
        const res = await request.post('/api/widget/reply', {
            headers: { Authorization: `Bearer not-a-real-token-${Date.now()}` },
            data: {
                feedbackId,
                content: marker,
                apiKey: seed.apiKey,
            },
        });
        expect(res.status()).toBe(401);

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
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                feedbackId,
                content: '   ',
                apiKey: seed.apiKey,
                hasAttachments: false,
            },
        });
        expect(res.status()).toBe(400);
    });

    test('content over 5000 chars → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/reply', {
            headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
            data: {
                feedbackId,
                content: 'x'.repeat(5001),
                apiKey: seed.apiKey,
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/too long/i);
    });

    test('feedbackId from another project → 404 (no cross-project replies)', async ({ request }) => {
        // Even with a valid Bearer + matching API key, you cannot reply to a
        // feedback that belongs to a different project. The route returns 404
        // ("Feedback not found for this project") rather than a more
        // explicit 403 so that cross-tenant feedback IDs aren't confirmable
        // via response shape.
        const seed = getSeedResult();

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
                headers: { Authorization: `Bearer ${seed.widgetTokens.client}` },
                data: {
                    feedbackId: foreignFeedback!.id,  // ← foreign feedback
                    content: 'cross-project attempt',
                    apiKey: seed.apiKey,              // ← seed's key (auth resolves to seed project)
                },
            });
            expect(res.status()).toBe(404);
        } finally {
            // deleteUser cascades through workspace/project/feedback.
            await supabaseAdmin.auth.admin.deleteUser(user.user.id);
        }
    });
});
