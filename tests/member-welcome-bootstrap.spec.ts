/**
 * Tier 2 — Member-join welcome bootstrap (`dispatchMemberWelcomeBootstrap`)
 *
 * When a fresh user accepts a workspace invite — whether through the explicit
 * `acceptInvite()` server action or via the dashboard's auto-accept loop on
 * first dashboard render — the helper fires and:
 *   1. Mints one `widget_identities` row per project in the joined workspace
 *      that has a `website_url`, tied to the new member's `user_id`.
 *   2. Sends one welcome email listing the bootstrap links (no-op'd in tests).
 *
 * This spec exercises the dashboard-auto-accept path end-to-end:
 *   - Create a fresh auth user.
 *   - Insert a `workspace_invites` row pointing them at the seed workspace.
 *   - Sign them in via a real magic-link round-trip (mirrors global-setup).
 *   - Land on /dashboard — the layout's auto-accept loop fires.
 *   - Assert widget_identities rows exist for the new user, scoped to the
 *     seed workspace's projects only.
 *
 * Sensitive Dependencies:
 * - Creates one disposable auth user per test; cleans up via deleteUser
 *   (cascades through workspace_members, widget_identities, and the user's
 *   own auto-created workspace).
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin, generateMagicLink } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.empty });

// Magic-link sign-in + dashboard auto-accept loop are server-side flows —
// no per-browser variation. Magic-link tokens are also single-use, so
// running across browsers would race on token consumption.
test.skip(({ browserName }) => browserName !== 'chromium', 'Server-side auto-accept flow — single-browser run');

test.describe('dispatchMemberWelcomeBootstrap (dashboard auto-accept path)', () => {
    test('fresh member joins seed workspace → widget_identities minted for each project they now have access to', async ({ context }) => {
        const seed = getSeedResult();
        const newMemberEmail = `e2e-welcome-${Date.now()}@example.com`;

        // 1. Create the user via admin API (the workspace trigger spins up
        //    their own personal workspace as a side effect).
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: newMemberEmail,
            email_confirm: true,
        });
        if (createErr || !created.user) throw new Error(`user create failed: ${createErr?.message}`);
        const newUserId = created.user.id;

        try {
            await new Promise(r => setTimeout(r, 800)); // workspace trigger settle

            // 2. Insert a member-role invite for them in the seed workspace.
            await supabaseAdmin.from('workspace_invites').insert({
                workspace_id: seed.workspaceId,
                email: newMemberEmail,
                role: 'member',
            });

            // 3. Determine how many projects in the seed workspace have a
            //    website_url — that's the expected widget_identities row count
            //    after auto-accept fires.
            const { count: expectedRows } = await supabaseAdmin
                .from('projects')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', seed.workspaceId)
                .not('website_url', 'is', null);

            // 4. Sign the user in via magic link → land on dashboard.
            const magicLink = await generateMagicLink(newMemberEmail);
            const page = await context.newPage();
            await page.goto(magicLink);
            await page.waitForURL('**/dashboard**', { timeout: 30_000 });
            await page.waitForLoadState('networkidle');

            // The auto-accept loop is fire-and-forget; the helper completes
            // the widget_identities inserts as a separate task. Poll briefly.
            const deadline = Date.now() + 5000;
            let actualRows = -1;
            while (Date.now() < deadline) {
                const { count } = await supabaseAdmin
                    .from('widget_identities')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', newUserId);
                actualRows = count ?? 0;
                if (actualRows === expectedRows) break;
                await new Promise(r => setTimeout(r, 200));
            }
            expect(actualRows, 'one widget_identities row per project with website_url').toBe(expectedRows);

            // Each row should be scoped to a project that's in the SEED
            // workspace — never the user's own auto-created workspace.
            const { data: rows } = await supabaseAdmin
                .from('widget_identities')
                .select('project_id, projects!inner(workspace_id)')
                .eq('user_id', newUserId);

            for (const r of (rows ?? [])) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ws = (r.projects as any).workspace_id;
                expect(ws, 'widget_identities only minted for the joined workspace').toBe(seed.workspaceId);
            }

            await page.close();
        } finally {
            // Cleans workspace_members, widget_identities, and the user's
            // auto-created workspace (FK cascades).
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
        }
    });
});
