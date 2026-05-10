/**
 * Tier 1 — Bootstrap auth + identity isolation
 *
 * `/api/widget/identity/exchange` is the entry point clients hit when widget.js
 * sees `?vv_invite=<workspace_invites.id>` on the host site. The route must:
 *
 *   1. Reject any invite whose `workspace_id` doesn't match the project the API
 *      key resolves to (cross-workspace isolation).
 *   2. Reject bogus / non-existent invite tokens.
 *   3. Short-circuit with the subscription gate (403) BEFORE the invite check
 *      when the workspace owner's plan is inactive — same response shape as
 *      every other widget endpoint.
 *   4. On success, mint a fresh `widget_identities` row and return a token that
 *      `verifyWidgetToken` accepts on subsequent calls.
 *
 * Also exercised here:
 *   - Multi-device coexistence: two successful exchanges for the same
 *     (project, email) produce two independently-valid widget_identities rows.
 *
 * These guarantees are exactly what makes the new invite-only model safe;
 * silent regressions here would mean cross-tenant leakage or auth bypass.
 *
 * Sensitive Dependencies:
 * - Uses the seeded client invite (`seed.clientInviteId`). Creates a foreign
 *   workspace + invite for the cross-workspace test and cleans it up.
 * - Mutates `profiles.subscription_status`/`trial_ends_at` for the disabled
 *   case; saves and restores the original values.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });

// Public endpoint — no auth cookies.
test.use({ storageState: AUTH_FILES.empty });

// Server-side route + DB-trigger behaviour — no per-browser variation worth
// running 3× for, and the disposable-workspace setup is expensive to repeat.
test.skip(({ browserName }) => browserName !== 'chromium', 'Server-side behaviour — single-browser run');

// ---------------------------------------------------------------------------
// POST /api/widget/identity/exchange — security cases
// ---------------------------------------------------------------------------

test.describe('POST /api/widget/identity/exchange', () => {
    test('happy path — valid invite + apiKey returns a token usable on subsequent widget calls', async ({ request }) => {
        const seed = getSeedResult();

        const exchangeRes = await request.post('/api/widget/identity/exchange', {
            data: {
                apiKey: seed.apiKey,
                inviteToken: seed.clientInviteId,
            },
        });
        expect(exchangeRes.status()).toBe(200);
        const body = await exchangeRes.json();
        expect(body.token, 'response must include a raw token').toBeTruthy();
        expect(body.email, 'response must include the resolved identity email').toBe(seed.clientEmail);

        // The token must immediately authenticate against the widget config endpoint.
        const configRes = await request.get(`/api/widget?key=${seed.apiKey}`, {
            headers: { Authorization: `Bearer ${body.token}` },
        });
        expect(configRes.status(), 'freshly-issued token should authenticate widget config').toBe(200);

        // Cleanup — the row will pile up in widget_identities otherwise.
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(body.token).digest('hex');
        await supabaseAdmin.from('widget_identities').delete().eq('token_hash', hash);
    });

    test('bogus invite token → 401 and no widget_identities row written', async ({ request }) => {
        const seed = getSeedResult();
        const before = await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', seed.projectId);

        const res = await request.post('/api/widget/identity/exchange', {
            data: {
                apiKey: seed.apiKey,
                inviteToken: '00000000-0000-0000-0000-000000000000',
            },
        });
        expect(res.status()).toBe(401);

        const after = await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', seed.projectId);
        expect(after.count).toBe(before.count);
    });

    test('missing apiKey → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/identity/exchange', {
            data: { inviteToken: seed.clientInviteId },
        });
        expect(res.status()).toBe(400);
    });

    test('missing inviteToken → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/identity/exchange', {
            data: { apiKey: seed.apiKey },
        });
        expect(res.status()).toBe(400);
    });

    test('cross-workspace: invite from another workspace presented with seed apiKey → 401', async ({ request }) => {
        // The key isolation guarantee: even with a real, valid invite token
        // from workspace A, presenting it alongside an apiKey that resolves
        // to workspace B must reject. Otherwise a bad actor with any client
        // invite could bootstrap into any project they had the public API key
        // for.

        const seed = getSeedResult();
        const foreignEmail = `e2e-foreign-exchange-${Date.now()}@example.com`;

        // Build a disposable workspace + project + client invite via the auth
        // trigger (auto-creates the workspace).
        const { data: foreignUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
            email: foreignEmail,
            email_confirm: true,
        });
        if (userErr || !foreignUser.user) throw new Error(`foreign user create failed: ${userErr?.message}`);
        await new Promise(r => setTimeout(r, 800)); // workspace trigger settle

        const { data: foreignWs } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', foreignUser.user.id)
            .single();

        const { data: foreignInvite, error: inviteErr } = await supabaseAdmin
            .from('workspace_invites')
            .insert({
                workspace_id: foreignWs!.id,
                email: 'foreign-client@example.com',
                role: 'client',
            })
            .select('id')
            .single();
        if (inviteErr || !foreignInvite) throw new Error(`foreign invite create failed: ${inviteErr?.message}`);

        try {
            // Foreign invite + seed apiKey → must reject.
            const res = await request.post('/api/widget/identity/exchange', {
                data: {
                    apiKey: seed.apiKey,
                    inviteToken: foreignInvite.id,
                },
            });
            expect(res.status()).toBe(401);

            // Belt-and-suspenders: confirm no widget_identities row was created
            // tied to the foreign invite under the seed project.
            const { count } = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', seed.projectId)
                .eq('invite_id', foreignInvite.id);
            expect(count ?? 0).toBe(0);
        } finally {
            // deleteUser cascades through workspaces/projects/invites.
            await supabaseAdmin.auth.admin.deleteUser(foreignUser.user.id);
        }
    });

    test('disabled widget owner → 403 short-circuits before invite check', async ({ request }) => {
        // Subscription gate fires inside validateApiKey, which runs before
        // the invite lookup. The error should be the standard "inactive"
        // message — same shape as every other widget endpoint when the owner's
        // plan is dead.

        const seed = getSeedResult();

        // Snapshot owner billing state for restoration.
        const { data: original } = await supabaseAdmin
            .from('profiles')
            .select('subscription_status, trial_ends_at, subscription_tier')
            .eq('id', seed.ownerId)
            .single();

        try {
            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: null,
                    subscription_tier: null,
                    trial_ends_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
                })
                .eq('id', seed.ownerId);

            const res = await request.post('/api/widget/identity/exchange', {
                data: {
                    apiKey: seed.apiKey,
                    inviteToken: seed.clientInviteId, // a perfectly valid invite
                },
            });
            expect(res.status()).toBe(403);
            const body = await res.json();
            expect(body.error).toContain('inactive');
        } finally {
            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: original?.subscription_status,
                    subscription_tier: original?.subscription_tier,
                    trial_ends_at: original?.trial_ends_at,
                })
                .eq('id', seed.ownerId);
        }
    });
});

// ---------------------------------------------------------------------------
// Multi-device coexistence
// ---------------------------------------------------------------------------

test.describe('Multi-device coexistence', () => {
    test('two successful exchanges for the same (project, email) yield two independently-valid tokens', async ({ request }) => {
        // Multi-device by design: there is no UNIQUE constraint on
        // (project_id, email). Two calls from two devices each get a fresh
        // row, and BOTH tokens must remain authoritative until explicitly
        // revoked. Any accidental dedup or last-writer-wins would silently
        // log out one of the user's devices.

        const seed = getSeedResult();

        const a = await request.post('/api/widget/identity/exchange', {
            data: { apiKey: seed.apiKey, inviteToken: seed.clientInviteId },
        });
        expect(a.status()).toBe(200);
        const tokenA = (await a.json()).token;

        const b = await request.post('/api/widget/identity/exchange', {
            data: { apiKey: seed.apiKey, inviteToken: seed.clientInviteId },
        });
        expect(b.status()).toBe(200);
        const tokenB = (await b.json()).token;

        expect(tokenA, 'distinct tokens per exchange').not.toBe(tokenB);

        // Both tokens must independently authenticate widget config.
        const configA = await request.get(`/api/widget?key=${seed.apiKey}`, {
            headers: { Authorization: `Bearer ${tokenA}` },
        });
        const configB = await request.get(`/api/widget?key=${seed.apiKey}`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        expect(configA.status()).toBe(200);
        expect(configB.status()).toBe(200);

        // Cleanup both rows.
        const crypto = await import('crypto');
        for (const token of [tokenA, tokenB]) {
            const hash = crypto.createHash('sha256').update(token).digest('hex');
            await supabaseAdmin.from('widget_identities').delete().eq('token_hash', hash);
        }
    });
});
