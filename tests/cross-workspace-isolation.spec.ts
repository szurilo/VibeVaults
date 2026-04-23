/**
 * Tier 1 — Security-critical: Cross-workspace isolation
 *
 * Proves that a user who owns their OWN workspace cannot poke into somebody
 * else's workspace via the Next.js API routes. Regressions here are the kind
 * of bug that ends up in a public writeup, so the suite errs on the loud side:
 * every attempt must either be rejected (non-2xx) or return an empty result.
 *
 * Covered vectors (all as the "outsider" — a fresh owner with no relationship
 * to the seed workspace):
 *   - POST /api/projects          → create a project inside the seed workspace
 *   - POST /api/workspaces/invites → invite someone to the seed workspace
 *   - DELETE /api/workspaces/invites?id=<seed invite> → revoke somebody else's invite
 *   - GET /api/projects with selectedWorkspaceId=<seed> → read somebody else's project list
 *
 * Why not use a static storage-state fixture?
 *   The seed fixtures (owner/member/client) are all *inside* the same workspace,
 *   so they can't express "a stranger". We provision a disposable outsider user
 *   per suite run and tear them down in afterAll.
 *
 * Sensitive Dependencies:
 * - supabaseAdmin for user/workspace provisioning and cleanup.
 * - Next.js API routes — test covers the `createClient()` (user-scoped) path,
 *   which is what production requests hit. RLS must hold under that client.
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import { supabaseAdmin, generateMagicLink } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

test.describe.configure({ mode: 'serial' });

const OUTSIDER_EMAIL = `e2e-outsider-${Date.now()}@example.com`;
let outsiderUserId: string;
let outsiderWorkspaceId: string;
let outsiderContext: BrowserContext | undefined;
/** An invite row in the SEED workspace we attempt to delete as the outsider. */
let seedInviteId: string;

test.beforeAll(async ({ browser }) => {
    // 1. Provision the outsider. The new-user DB trigger auto-creates their
    //    workspace, which gives them a legitimate workspace to act from.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: OUTSIDER_EMAIL,
        email_confirm: true,
    });
    if (error || !data.user) throw new Error(`outsider create failed: ${error?.message}`);
    outsiderUserId = data.user.id;

    // Let the workspace trigger settle.
    await new Promise(r => setTimeout(r, 1000));

    const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', outsiderUserId)
        .single();
    if (!ws?.id) throw new Error('outsider workspace not created by trigger');
    outsiderWorkspaceId = ws.id;

    // Mark them onboarded + trial-active so the proxy paywall never gets in the way.
    await supabaseAdmin
        .from('profiles')
        .update({
            has_onboarded: true,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', outsiderUserId);

    // 2. Seed a throwaway invite inside the SEED workspace — the outsider will try to delete it.
    const seed = getSeedResult();
    const { data: invite } = await supabaseAdmin
        .from('workspace_invites')
        .insert({
            workspace_id: seed.workspaceId,
            email: `e2e-outsider-target-${Date.now()}@example.com`,
            role: 'member',
        })
        .select('id')
        .single();
    if (!invite?.id) throw new Error('seed-workspace invite creation failed');
    seedInviteId = invite.id;

    // 3. Sign the outsider into a browser context so we get real session cookies
    //    (tokens-only encoded — same cookies production uses).
    outsiderContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await outsiderContext.newPage();
    const link = await generateMagicLink(OUTSIDER_EMAIL);
    await page.goto(link);
    await expect(page.getByText(/Verified!/i)).toBeVisible({ timeout: 15_000 });
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await page.close();
});

test.afterAll(async () => {
    // Remove any leftover invite row (the seeded one) if the outsider somehow
    // didn't get blocked. Idempotent.
    if (seedInviteId) {
        await supabaseAdmin.from('workspace_invites').delete().eq('id', seedInviteId);
    }
    // Tear down outsider (cascades workspace + profile).
    if (outsiderUserId) {
        await supabaseAdmin.auth.admin.deleteUser(outsiderUserId);
    }
    if (outsiderContext) {
        await outsiderContext.close();
    }
});

// ---------------------------------------------------------------------------
// Vector 1 — Writes to a foreign workspace
// ---------------------------------------------------------------------------

test.describe('Outsider cannot write into the seed workspace', () => {
    test('POST /api/projects with a foreign workspace_id is rejected', async () => {
        const seed = getSeedResult();
        if (!outsiderContext) throw new Error('outsider context not initialised');

        const response = await outsiderContext.request.post('/api/projects', {
            data: {
                name: 'Hijacked Project',
                website_url: 'https://evil.example.com',
                workspace_id: seed.workspaceId,
            },
        });

        // Either 403 (explicit tier/role rejection), or 500 (RLS insert error).
        // The must-hold property is: status is NOT 2xx AND no project row lands
        // in the seed workspace.
        expect(response.status(), `got ${response.status()}`).toBeGreaterThanOrEqual(400);

        const { data: matching } = await supabaseAdmin
            .from('projects')
            .select('id, name')
            .eq('workspace_id', seed.workspaceId)
            .eq('name', 'Hijacked Project');
        expect(matching?.length ?? 0, 'no foreign project row should have been created').toBe(0);
    });

    test('POST /api/workspaces/invites for a foreign workspace returns 403', async () => {
        const seed = getSeedResult();
        if (!outsiderContext) throw new Error('outsider context not initialised');

        const victimEmail = `e2e-outsider-victim-${Date.now()}@example.com`;
        const response = await outsiderContext.request.post('/api/workspaces/invites', {
            data: {
                workspaceId: seed.workspaceId,
                email: victimEmail,
                role: 'member',
            },
        });

        // `isWorkspaceOwner` gate returns 403 for non-owners.
        expect(response.status()).toBe(403);

        const { data: ghostInvites } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', seed.workspaceId)
            .eq('email', victimEmail);
        expect(ghostInvites?.length ?? 0, 'no invite should have been created').toBe(0);
    });

    test('DELETE /api/workspaces/invites?id=<seed invite> is blocked and leaves the row intact', async () => {
        if (!outsiderContext) throw new Error('outsider context not initialised');

        const response = await outsiderContext.request.delete(
            `/api/workspaces/invites?id=${seedInviteId}`
        );

        // Either 403 (owner gate) or 404 (RLS hides the row from the outsider's
        // user-scoped SELECT before the owner check runs). Both are valid
        // "access denied" outcomes — 404 is arguably better because it doesn't
        // confirm the invite exists. The real contract is the row staying intact.
        expect([403, 404], `got ${response.status()}`).toContain(response.status());

        const { data: row } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('id', seedInviteId)
            .maybeSingle();
        expect(row?.id, 'seed invite should still exist').toBe(seedInviteId);
    });
});

// ---------------------------------------------------------------------------
// Vector 2 — Reads from a foreign workspace (RLS must filter, even when the
// client pretends the foreign workspace is "selected").
// ---------------------------------------------------------------------------

test.describe('Outsider cannot read the seed workspace via selectedWorkspaceId spoofing', () => {
    test('GET /api/projects with a spoofed selectedWorkspaceId returns empty', async () => {
        const seed = getSeedResult();
        if (!outsiderContext) throw new Error('outsider context not initialised');

        // Point the outsider's cookie at the SEED workspace — RLS must still
        // filter the query result to only rows the outsider can see (none).
        await outsiderContext.addCookies([
            {
                name: 'selectedWorkspaceId',
                value: seed.workspaceId,
                url: 'http://127.0.0.1:3000',
            },
        ]);

        const response = await outsiderContext.request.get('/api/projects');
        expect(response.ok(), `got ${response.status()}`).toBeTruthy();

        const projects = await response.json();
        expect(Array.isArray(projects)).toBe(true);

        // CRITICAL: the seed project id must NOT appear. A regression here
        // would expose another tenant's data to any signed-in user that flips
        // a cookie.
        const ids = (projects as Array<{ id: string }>).map(p => p.id);
        expect(ids, 'outsider must not see seed projects').not.toContain(seed.projectId);

        // Restore the cookie to the outsider's own workspace so subsequent tests
        // don't inherit the spoof.
        await outsiderContext.addCookies([
            {
                name: 'selectedWorkspaceId',
                value: outsiderWorkspaceId,
                url: 'http://127.0.0.1:3000',
            },
        ]);
    });
});
