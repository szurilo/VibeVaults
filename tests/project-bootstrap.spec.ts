/**
 * Tier 2 — `POST /api/projects` auto-bootstrap side effects
 *
 * When a project is created, the route auto-mints widget bootstrap material
 * for everyone in the workspace (so they don't have to wait for the dashboard
 * button or hunt for the recovery page):
 *
 *   - Each non-creator member: gets one fresh `widget_identities` row tied to
 *     their `user_id`, with a raw token embedded in the project-created email
 *     URL (`?vv_token=...`).
 *   - Each client invitee: gets the project-created email pointing at
 *     `?vv_invite=<workspace_invites.id>`, the invite ID is persistent so no
 *     widget_identities row is minted.
 *   - The creator: explicitly excluded — they already use the dashboard
 *     "Open widget on site" button on demand.
 *
 * The email itself is no-op'd in the test environment (resend.ts checks for
 * `.playwright-running`), so we verify the DB side effects: widget_identities
 * row counts before and after the project create.
 *
 * Sensitive Dependencies:
 * - The seed gives us owner + member + client. The `member` already has a
 *   user_id and is in the workspace; the `clientEmail` already has a
 *   workspace_invites row.
 * - Each test creates a disposable project and tears it down (and its
 *   cascade-deleted widget_identities) in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.owner });

// Server-side route behaviour — no per-browser variation. Cross-browser
// execution would also race on the seed member's email_preferences row.
test.skip(({ browserName }) => browserName !== 'chromium', 'Server-side behaviour — single-browser run');

test.describe('POST /api/projects auto-bootstrap', () => {
    const createdProjectIds: string[] = [];
    let originalMemberPrefs: { notify_project_created: boolean; email_frequency: string } | null = null;

    test.beforeAll(async () => {
        const seed = getSeedResult();

        // The auto-bootstrap branch in /api/projects only mints widget_identities
        // for recipients whose email_preferences.notify_project_created is true
        // AND whose email_frequency is 'realtime' (so the project-created email
        // is sent immediately rather than queued for digest). On localhost the
        // defaults are all false to avoid dev email noise — opt the seed
        // member in for this spec, restore in afterAll.
        const { data: existing } = await supabaseAdmin
            .from('email_preferences')
            .select('notify_project_created, email_frequency')
            .eq('email', seed.memberEmail)
            .maybeSingle();
        originalMemberPrefs = existing;

        await supabaseAdmin.from('email_preferences').upsert({
            email: seed.memberEmail,
            notify_project_created: true,
            email_frequency: 'realtime',
        }, { onConflict: 'email' });
    });

    test.afterEach(async () => {
        const seed = getSeedResult();
        // Each project create inserts a `project_created` row into
        // email_digest_queue with sent_at populated. The next test's
        // shouldSendProjectEventImmediately would then see it within the
        // 15-min cooldown window and route the email to the queue branch
        // — bypassing the immediate-mint side effect we're testing. Clear
        // the member's queue rows after each test to keep them independent.
        await supabaseAdmin
            .from('email_digest_queue')
            .delete()
            .eq('recipient_email', seed.memberEmail);
    });

    test.afterAll(async () => {
        const seed = getSeedResult();

        if (createdProjectIds.length > 0) {
            // Project delete cascades through widget_identities (FK on project_id).
            await supabaseAdmin.from('projects').delete().in('id', createdProjectIds);
        }

        // Restore the seed member's email_preferences to whatever they were.
        if (originalMemberPrefs) {
            await supabaseAdmin
                .from('email_preferences')
                .update({
                    notify_project_created: originalMemberPrefs.notify_project_created,
                    email_frequency: originalMemberPrefs.email_frequency,
                })
                .eq('email', seed.memberEmail);
        } else {
            // Pref row didn't exist before — delete the one we created.
            await supabaseAdmin
                .from('email_preferences')
                .delete()
                .eq('email', seed.memberEmail);
        }
    });

    test('creating a project mints a widget_identities row for each non-creator member, none for clients, none for creator', async ({ request }) => {
        const seed = getSeedResult();

        // Snapshot widget_identities counts that are scoped to the *new*
        // project (which doesn't exist yet, so should start at 0).
        const projectName = `auto-bootstrap-${Date.now()}`;
        const websiteUrl = `https://auto-bootstrap-${Date.now()}.example.com`;

        const res = await request.post('/api/projects', {
            data: {
                name: projectName,
                website_url: websiteUrl,
                workspace_id: seed.workspaceId,
            },
        });
        expect(res.status(), 'project creation should succeed for the owner').toBe(200);
        const project = await res.json();
        createdProjectIds.push(project.id);

        // Member: exactly 1 widget_identities row should exist for the new project.
        const { data: memberRows } = await supabaseAdmin
            .from('widget_identities')
            .select('id, user_id, invite_id, email')
            .eq('project_id', project.id)
            .eq('user_id', seed.memberId);
        expect(memberRows ?? [], 'member should get exactly one bootstrap token for the new project').toHaveLength(1);
        expect(memberRows![0].email).toBe(seed.memberEmail);
        expect(memberRows![0].invite_id, 'member rows must be user-bound, not invite-bound').toBeNull();

        // Owner (creator): zero rows — they're explicitly excluded from the
        // member-iteration filter (`m.user_id !== user.id`).
        const { count: ownerCount } = await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('user_id', seed.ownerId);
        expect(ownerCount, 'creator must NOT receive an auto-mint').toBe(0);

        // Clients: zero new widget_identities rows. The client email goes
        // out with the persistent invite_id; widget.js exchanges it on click.
        const { count: clientCount } = await supabaseAdmin
            .from('widget_identities')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('email', seed.clientEmail);
        expect(clientCount, 'clients reuse persistent invite_id; no widget_identities mint').toBe(0);
    });

    // NOTE: there used to be a "no clients" sanity test here that temporarily
    // deleted the seed workspace's client invites and restored them via upsert.
    // The DELETE silently triggered the FK cascade on widget_identities.invite_id,
    // wiping the seeded client's bearer token mid-run; the upsert restored the
    // invite row but NOT the cascade-deleted widget_identities row, so every
    // subsequent test relying on `seed.widgetTokens.client` then 401'd. The
    // assertion the test was making (the per-recipient loop tolerates an empty
    // clientInvites array) is trivial JavaScript and covered implicitly by the
    // happy path above plus the route's own type signature — not worth the
    // shared-state breakage. If we ever want it back, do it against a fully
    // disposable workspace, not the seed.
});
