/**
 * Main Responsibility: Verifies that workspace owners and members receive the correct
 * bell notifications when a member departs — whether by leaving voluntarily, having
 * access revoked by the owner, or deleting their account entirely.
 *
 * Scenarios covered:
 *   1. Member leaves workspace         → owner gets "has left" notification
 *   2. Owner revokes member access     → member gets "Access Revoked" notification
 *   3. Member deletes account          → owner gets "deleted their account" notification
 *
 * Sensitive Dependencies:
 * - Mutates `workspace_members` for scenarios 1 and 2; restores the seeded member
 *   in `afterEach` so later tests in the suite are unaffected.
 * - Scenario 3 creates a throwaway user (e2e-temp-*) and deletes them via the real
 *   DELETE /api/auth/delete-account endpoint — the global teardown handles any
 *   leftovers, but the user should already be gone by then.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin, generateMagicLink } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';
import type { SeedResult } from './fixtures/seed';

test.describe.configure({ mode: 'serial' });

test.describe('Member departure notifications', () => {
    let seed: SeedResult;

    test.beforeAll(() => {
        seed = getSeedResult();
    });

    // Re-add the seeded member after any test that removes them from the workspace.
    test.afterEach(async () => {
        await supabaseAdmin
            .from('workspace_members')
            .upsert(
                { workspace_id: seed.workspaceId, user_id: seed.memberId, role: 'member' },
                { onConflict: 'workspace_id,user_id', ignoreDuplicates: true }
            );
    });

    // -------------------------------------------------------------------------
    // 1. Member leaves voluntarily
    // -------------------------------------------------------------------------
    test('member leaving workspace notifies the owner with "has left" wording', async ({ browser }) => {
        const before = new Date().toISOString();

        const memberCtx = await browser.newContext({ storageState: AUTH_FILES.member });
        await memberCtx.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);
        const memberPage = await memberCtx.newPage();

        await memberPage.goto('/dashboard/settings/users');
        await memberPage.getByRole('button', { name: 'Leave Workspace' }).click();
        // Confirm in the AlertDialog
        await memberPage.getByRole('alertdialog')
            .getByRole('button', { name: 'Leave Workspace' })
            .click();
        // Wait for redirect away from the page (action completes)
        await memberPage.waitForURL(url => !url.pathname.includes('/settings/users'), { timeout: 10_000 });
        await memberCtx.close();

        const { data: notification } = await supabaseAdmin
            .from('notifications')
            .select('message, type')
            .eq('user_id', seed.ownerId)
            .eq('type', 'member_left')
            .gte('created_at', before)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        expect(notification).not.toBeNull();
        expect(notification!.message).toMatch(/has left/);
    });

    // -------------------------------------------------------------------------
    // 2. Owner revokes member access
    // -------------------------------------------------------------------------
    test('owner revoking access sends "Access Revoked" notification to the removed member', async ({ browser }) => {
        const before = new Date().toISOString();

        const ownerCtx = await browser.newContext({ storageState: AUTH_FILES.owner });
        await ownerCtx.addCookies([{
            name: 'selectedWorkspaceId',
            value: seed.workspaceId,
            url: 'http://127.0.0.1:3000',
        }]);
        const ownerPage = await ownerCtx.newPage();

        await ownerPage.goto('/dashboard/settings/users');
        // Find the member's row by email and click the Revoke Access trigger
        const memberRow = ownerPage.locator('div')
            .filter({ hasText: seed.memberEmail })
            .filter({ has: ownerPage.getByRole('button', { name: 'Revoke Access' }) })
            .last();
        await memberRow.getByRole('button', { name: 'Revoke Access' }).click();
        await ownerPage.getByRole('alertdialog')
            .getByRole('button', { name: 'Revoke Access' })
            .click();
        // Wait for the member's row to disappear — signals the server action
        // returned and the client re-rendered. The notification insert inside
        // the action is fire-and-forget, so we still poll the DB below.
        await expect(ownerPage.locator('p', { hasText: seed.memberEmail })).toHaveCount(0, { timeout: 10_000 });
        await ownerCtx.close();

        await expect.poll(async () => {
            const { data } = await supabaseAdmin
                .from('notifications')
                .select('title, type')
                .eq('user_id', seed.memberId)
                .eq('type', 'member_removed')
                .gte('created_at', before)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data?.title ?? null;
        }, { timeout: 10_000, intervals: [200, 500, 1000] }).toBe('Access Revoked');
    });

    // -------------------------------------------------------------------------
    // 3. Member deletes their account
    // -------------------------------------------------------------------------
    test('member deleting account notifies owner with "deleted their account" wording', async ({ browser }) => {
        // Create a disposable member so deleting them doesn't break the seeded state
        const tempEmail = `e2e-temp-${Date.now()}@example.com`;
        const { data: { user: tempUser }, error } = await supabaseAdmin.auth.admin.createUser({
            email: tempEmail,
            email_confirm: true,
        });
        if (error || !tempUser) throw new Error(`Could not create temp user: ${error?.message}`);

        // Wait for the profile DB trigger
        await new Promise(r => setTimeout(r, 1_000));

        await supabaseAdmin.from('workspace_members').insert({
            workspace_id: seed.workspaceId,
            user_id: tempUser.id,
            role: 'member',
        });

        // Authenticate as the temp user via magic link
        const magicLink = await generateMagicLink(tempEmail);
        const tempCtx = await browser.newContext();
        const tempPage = await tempCtx.newPage();
        await tempPage.goto(magicLink);
        await tempPage.waitForURL('**/dashboard**', { timeout: 15_000 });

        const before = new Date().toISOString();

        // Hit the DELETE endpoint directly — the UI flow is already covered
        // implicitly, and this avoids flakiness around account-page navigation
        // for freshly-created users with partial profile state.
        const response = await tempPage.request.delete('/api/auth/delete-account');
        expect(response.ok(), `delete-account returned ${response.status()}`).toBe(true);
        await tempCtx.close();

        const { data: notification } = await supabaseAdmin
            .from('notifications')
            .select('message, type')
            .eq('user_id', seed.ownerId)
            .eq('type', 'member_left')
            .gte('created_at', before)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        expect(notification).not.toBeNull();
        expect(notification!.message).toMatch(/deleted their account/);
    });
});
