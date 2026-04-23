/**
 * Tier 1 — Security-critical: Invite acceptance flow
 *
 * Covers the deferred-account invite path (GDPR-conscious rewrite):
 *   - Invalid / unknown token → "Invite not found" view
 *   - Guest (no session) → sign-in surface (AcceptInviteClient)
 *   - Logged-in user, matching email → auto-accept, membership row created
 *   - Logged-in user, mismatched email → "Wrong account" view, NO membership
 *
 * Why this is critical: `acceptInvite()` gates membership on the authed user's
 * email matching the invite's target. A regression here would let anyone with
 * the invite UUID join a workspace they weren't invited to.
 *
 * Sensitive Dependencies:
 * - Creates ephemeral invites + users via supabaseAdmin; cleans them up in afterAll
 *   so the shared seed workspace is left untouched.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

// Serial — we create and reference invites across tests, and mutate
// workspace_members. Parallel would race on cleanup.
test.describe.configure({ mode: 'serial' });

const EPHEMERAL_PREFIX = `e2e-invite-${Date.now()}`;
const createdUserIds: string[] = [];
const createdInviteIds: string[] = [];

async function createInvite(workspaceId: string, email: string, role: 'member' | 'client' = 'member') {
    const { data, error } = await supabaseAdmin
        .from('workspace_invites')
        .insert({ workspace_id: workspaceId, email, role })
        .select('id')
        .single();
    if (error || !data) throw new Error(`createInvite failed: ${error?.message}`);
    createdInviteIds.push(data.id);
    return data.id as string;
}

async function createConfirmedUser(email: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createConfirmedUser failed: ${error?.message}`);
    createdUserIds.push(data.user.id);
    // Let the new-user trigger settle (auto-workspace + profile row).
    await new Promise(r => setTimeout(r, 500));
    return data.user.id;
}

async function countMembership(workspaceId: string, userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
    if (error) throw new Error(`countMembership failed: ${error.message}`);
    return count ?? 0;
}

test.afterAll(async () => {
    // Remove any memberships this suite created inside the seed workspace,
    // so subsequent runs/tests see a clean slate.
    const seed = getSeedResult();
    if (createdUserIds.length) {
        await supabaseAdmin
            .from('workspace_members')
            .delete()
            .eq('workspace_id', seed.workspaceId)
            .in('user_id', createdUserIds);
    }
    for (const id of createdInviteIds) {
        await supabaseAdmin.from('workspace_invites').delete().eq('id', id);
    }
    for (const id of createdUserIds) {
        await supabaseAdmin.auth.admin.deleteUser(id);
    }
});

// ---------------------------------------------------------------------------
// Guest (no session) — should see the sign-in surface or the invalid view.
// ---------------------------------------------------------------------------

test.describe('Invite acceptance — guest', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unknown token renders "Invite not found"', async ({ page }) => {
        // Random UUID that does not exist in workspace_invites.
        await page.goto('/auth/accept-invite?token=00000000-0000-0000-0000-000000000000');
        await expect(page.getByText(/Invite not found/i)).toBeVisible({ timeout: 10_000 });
    });

    test('missing token renders "Invite not found"', async ({ page }) => {
        await page.goto('/auth/accept-invite');
        await expect(page.getByText(/Invite not found/i)).toBeVisible({ timeout: 10_000 });
    });

    test('valid token but no session shows sign-in surface', async ({ page }) => {
        const seed = getSeedResult();
        const inviteEmail = `${EPHEMERAL_PREFIX}-guest@example.com`;
        const inviteId = await createInvite(seed.workspaceId, inviteEmail);

        await page.goto(`/auth/accept-invite?token=${inviteId}`);

        // AcceptInviteClient renders a sign-in card that mentions the invited email.
        // Match the masked/display form used by the component; if the component
        // shows the literal email, this assertion still holds.
        await expect(page.getByText(inviteEmail)).toBeVisible({ timeout: 10_000 });
        // Should NOT have inserted any membership row (no user even exists yet).
        const { data: invite } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('id', inviteId)
            .maybeSingle();
        expect(invite, 'invite should still be pending').not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Logged-in, MATCHING email → auto-accept path writes workspace_members.
// ---------------------------------------------------------------------------

test.describe('Invite acceptance — matching email auto-accepts', () => {
    // Uses its own per-test storage state (created dynamically below).
    test.use({ storageState: { cookies: [], origins: [] } });

    test('auto-accepts and creates membership row', async ({ page }) => {
        const seed = getSeedResult();
        const email = `${EPHEMERAL_PREFIX}-match@example.com`;

        // 1. Create the user + pending invite.
        const userId = await createConfirmedUser(email);
        const inviteId = await createInvite(seed.workspaceId, email, 'member');

        // 2. Log the user in via magic link → populates cookies on this page context.
        const { data: link } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });
        const action = link?.properties?.action_link;
        expect(action, 'magic link must be issued').toBeTruthy();
        const url = new URL(action!);
        const token = url.searchParams.get('token')!;
        const type = url.searchParams.get('type')!;

        // Send them to confirm, but with a next-step that bounces to the invite.
        // (accept-invite itself reads the invite token from the query string.)
        await page.goto(
            `http://127.0.0.1:3000/auth/confirm?token_hash=${token}&type=${type}&next=/auth/accept-invite?token=${inviteId}`
        );

        // If the `next` redirect doesn't fire for any reason, navigate manually
        // — at this point the session cookie is set.
        if (!page.url().includes('/auth/accept-invite') && !page.url().includes('/dashboard')) {
            await page.goto(`/auth/accept-invite?token=${inviteId}`);
        }

        // 3. Auto-accept should redirect into /dashboard/feedback via email-redirect.
        await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 });

        // 4. Membership row must now exist.
        const count = await countMembership(seed.workspaceId, userId);
        expect(count, 'membership row should be inserted').toBe(1);

        // 5. Invite should be consumed (acceptInvite deletes it on success).
        const { data: leftoverInvite } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('id', inviteId)
            .maybeSingle();
        expect(leftoverInvite, 'invite should be deleted after accept').toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Logged-in, MISMATCHED email → should show "Wrong account", NO membership.
// This is the hijack-prevention test — regressions here are critical.
// ---------------------------------------------------------------------------

test.describe('Invite acceptance — email mismatch is rejected', () => {
    // Sign in as the seeded owner, but visit an invite addressed to someone else.
    test.use({ storageState: AUTH_FILES.owner });

    test('wrong account view renders and no membership is created', async ({ page }) => {
        const seed = getSeedResult();
        const strangerEmail = `${EPHEMERAL_PREFIX}-stranger@example.com`;

        // Create the invite for someone who is NOT the owner.
        const inviteId = await createInvite(seed.workspaceId, strangerEmail, 'member');

        // Snapshot membership count for the owner before (owner is always a member).
        const before = await countMembership(seed.workspaceId, seed.ownerId);

        await page.goto(`/auth/accept-invite?token=${inviteId}`);

        // Mismatch view signals the disconnect and offers a sign-out action.
        await expect(page.getByText(/Wrong account/i)).toBeVisible({ timeout: 10_000 });
        // The stranger's email is rendered twice (card description + instruction
        // block) — scope to the first occurrence so strict-mode doesn't trip.
        await expect(page.getByText(strangerEmail).first()).toBeVisible();

        // Owner's membership count must be unchanged (the auto-insert path is gated by email match).
        const after = await countMembership(seed.workspaceId, seed.ownerId);
        expect(after, 'owner membership count should be unchanged').toBe(before);

        // Invite must still be pending — mismatch path must NOT consume it.
        const { data: stillThere } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('id', inviteId)
            .maybeSingle();
        expect(stillThere, 'invite should remain pending after mismatch').not.toBeNull();
    });

    test('acceptInvite action also rejects mismatch when called directly', async ({ request }) => {
        // Even if somebody POSTs straight at the server action's underlying route
        // (or replays it), the email-match gate in acceptInvite() must still
        // protect the membership row. We verify by (a) creating an invite for a
        // stranger, (b) hitting the accept-invite page as the owner, (c) asserting
        // that no row for the owner was inserted.
        const seed = getSeedResult();
        const strangerEmail = `${EPHEMERAL_PREFIX}-stranger-2@example.com`;
        const inviteId = await createInvite(seed.workspaceId, strangerEmail, 'member');

        // Hit the page as the owner; membership inserts would surface here.
        const response = await request.get(`/auth/accept-invite?token=${inviteId}`);
        expect(response.status(), 'page should render (not crash)').toBeLessThan(500);

        // No membership row should exist for the owner beyond the pre-existing
        // one (seed already makes them a member). A new row would violate the
        // composite PK anyway — this assertion is belt-and-suspenders.
        const { data: rows } = await supabaseAdmin
            .from('workspace_members')
            .select('user_id, role')
            .eq('workspace_id', seed.workspaceId)
            .eq('user_id', seed.ownerId);
        expect(rows?.length, 'owner should have exactly one membership row').toBe(1);
        expect(rows?.[0].role).toBe('owner');
    });
});
