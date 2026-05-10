/**
 * Tier 1 — `/access` self-service widget bootstrap recovery
 *
 * The `/access` page is the public escape hatch for invitees and members who
 * have lost their per-device widget token (cleared browser, new device, etc.).
 * Two security guarantees we need to lock in:
 *
 *   1. Anti-enumeration: a known and an unknown email both produce the same
 *      visible response. Otherwise a stranger can probe whether arbitrary
 *      emails are workspace members or client invitees.
 *   2. Side-effects only fire for matched emails: members get fresh
 *      `widget_identities` rows minted (one per project they have access to).
 *      Clients reuse their persistent `workspace_invites.id` and don't mint
 *      anything in widget_identities.
 *
 * The action runs the matching + email send in a fire-and-forget background
 * task and returns ok immediately; the DB mints happen async, so we poll for
 * the side effects rather than asserting synchronously.
 *
 * Sensitive Dependencies:
 * - The seed fixture provides ownerEmail + memberEmail + clientEmail. We
 *   delete any widget_identities rows minted for these emails inside this
 *   spec to keep the table clean for downstream tests.
 */

import { test, expect, type Page } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.empty });

// These tests exercise server-side behaviour (rate limiting, side-effect mints,
// anti-enumeration response shape) — there's no per-browser variation worth
// running 3× for. Cross-browser execution would also burn through the per-IP
// and per-email rate-limit buckets shared across worker processes and start
// returning ok=false where we expect ok=true.
test.skip(({ browserName }) => browserName !== 'chromium', 'Server-side behaviour — single-browser run');

async function submitRecoveryForm(page: Page, email: string) {
    await page.goto('/access');
    await page.locator('#email').fill(email);
    await page.locator('button[type="submit"]').click();
}

async function pollForIdentityCount(predicate: () => Promise<number>, expected: number, timeoutMs = 10_000) {
    // The action returns ok immediately and runs the heavy work in a void
    // async block — the DB inserts are visible only after that block resolves.
    // 10s is generous; in practice it's <1s in dev, but Next.js dev server
    // under E2E load can spike.
    const deadline = Date.now() + timeoutMs;
    let last = -1;
    while (Date.now() < deadline) {
        last = await predicate();
        if (last === expected) return last;
        await new Promise(r => setTimeout(r, 150));
    }
    return last;
}

// ---------------------------------------------------------------------------
// Anti-enumeration: known and unknown emails get the same visible feedback
// ---------------------------------------------------------------------------

test.describe('/access anti-enumeration', () => {
    test('unknown email shows the same generic success state as a known one', async ({ page }) => {
        const seed = getSeedResult();

        // Known case: the seeded member.
        await submitRecoveryForm(page, seed.memberEmail);
        const knownSuccess = page.getByText('Check your inbox', { exact: true });
        await expect(knownSuccess).toBeVisible({ timeout: 5000 });

        // Unknown case: a synthetic email no row exists for.
        const stranger = `e2e-stranger-recovery-${Date.now()}@example.com`;
        await submitRecoveryForm(page, stranger);
        const unknownSuccess = page.getByText('Check your inbox', { exact: true });
        await expect(unknownSuccess).toBeVisible({ timeout: 5000 });

        // Belt-and-suspenders: stranger must NOT have any widget_identities
        // rows created on their behalf. Side-effect leakage would defeat the
        // anti-enumeration guarantee just as much as a different UI response
        // would.
        const strangerCount = await pollForIdentityCount(
            async () => {
                const { count } = await supabaseAdmin
                    .from('widget_identities')
                    .select('id', { count: 'exact', head: true })
                    .eq('email', stranger);
                return count ?? 0;
            },
            0,
            2000
        );
        expect(strangerCount).toBe(0);
    });

    test('client-invitee email triggers ok response but mints NO new widget_identities (uses persistent invite_id)', async ({ page }) => {
        const seed = getSeedResult();

        const beforeCount = (await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('email', seed.clientEmail)
            .is('user_id', null)).count ?? 0;

        await submitRecoveryForm(page, seed.clientEmail);
        await expect(page.getByText('Check your inbox', { exact: true })).toBeVisible({ timeout: 5000 });

        // Wait briefly to let the background task settle, then assert no new rows.
        await new Promise(r => setTimeout(r, 1500));
        const afterCount = (await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('email', seed.clientEmail)
            .is('user_id', null)).count ?? 0;

        expect(afterCount, 'client recovery reuses persistent invite_id, no new rows').toBe(beforeCount);
    });
});

// ---------------------------------------------------------------------------
// Member side-effects
// ---------------------------------------------------------------------------

test.describe('/access member recovery', () => {
    test('member-email recovery mints widget_identities (one per project with website_url)', async ({ page }) => {
        const seed = getSeedResult();

        // Snapshot existing rows for this member before the recovery call.
        const beforeRows = await supabaseAdmin
            .from('widget_identities')
            .select('id, project_id')
            .eq('email', seed.memberEmail)
            .eq('user_id', seed.memberId);
        const beforeIds = new Set((beforeRows.data ?? []).map(r => r.id));

        await submitRecoveryForm(page, seed.memberEmail);
        await expect(page.getByText('Check your inbox', { exact: true })).toBeVisible({ timeout: 5000 });

        // Determine how many projects-with-website the member should have
        // gotten links for — should be every project in the seed workspace.
        const { count: expectedProjectCount } = await supabaseAdmin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', seed.workspaceId)
            .not('website_url', 'is', null);

        // Poll for the expected number of NEW rows minted for this member.
        const newRowCount = await pollForIdentityCount(async () => {
            const { data } = await supabaseAdmin
                .from('widget_identities')
                .select('id')
                .eq('email', seed.memberEmail)
                .eq('user_id', seed.memberId);
            return (data ?? []).filter(r => !beforeIds.has(r.id)).length;
        }, expectedProjectCount ?? 0, 5000);

        expect(newRowCount, 'one widget_identities row per accessible project').toBe(expectedProjectCount);

        // Cleanup the rows we just minted so subsequent specs don't see drift.
        const { data: afterRows } = await supabaseAdmin
            .from('widget_identities')
            .select('id')
            .eq('email', seed.memberEmail)
            .eq('user_id', seed.memberId);
        const newIds = (afterRows ?? []).map(r => r.id).filter(id => !beforeIds.has(id));
        if (newIds.length > 0) {
            await supabaseAdmin.from('widget_identities').delete().in('id', newIds);
        }
    });
});

// ---------------------------------------------------------------------------
// Form-level validation
// ---------------------------------------------------------------------------

test.describe('/access form validation', () => {
    test('invalid email format → form error, no submission', async ({ page }) => {
        await page.goto('/access');
        await page.locator('#email').fill('not-an-email');
        await page.locator('button[type="submit"]').click();
        await expect(page.getByText('Please enter a valid email address.')).toBeVisible({ timeout: 3000 });
        // Success state should NOT appear — the action wasn't called.
        await expect(page.getByText('Check your inbox', { exact: true })).not.toBeVisible();
    });
});
