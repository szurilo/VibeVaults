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

    test('creating a project in a workspace with no clients still mints for members and does not error', async ({ request }) => {
        // Sanity check that the per-recipient loop short-circuits cleanly for
        // workspaces with zero clients (the earlier test always has the seeded
        // client, so this exercises the empty-client-list branch).
        const seed = getSeedResult();

        // Temporarily delete any client invites in the seed workspace so the
        // route's clientInvites loop receives an empty set. We restore them
        // afterwards because lots of other tests depend on the client invite.
        const { data: removedInvites } = await supabaseAdmin
            .from('workspace_invites')
            .select('id, email, role, workspace_id')
            .eq('workspace_id', seed.workspaceId)
            .eq('role', 'client');

        try {
            if (removedInvites && removedInvites.length > 0) {
                await supabaseAdmin
                    .from('workspace_invites')
                    .delete()
                    .in('id', removedInvites.map(i => i.id));
            }

            const res = await request.post('/api/projects', {
                data: {
                    name: `no-clients-${Date.now()}`,
                    website_url: `https://no-clients-${Date.now()}.example.com`,
                    workspace_id: seed.workspaceId,
                },
            });
            expect(res.status()).toBe(200);
            const project = await res.json();
            createdProjectIds.push(project.id);

            // Member should still get their auto-bootstrap row.
            const { count: memberCount } = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', project.id)
                .eq('user_id', seed.memberId);
            expect(memberCount).toBe(1);
        } finally {
            // Restore the original client invites verbatim.
            if (removedInvites && removedInvites.length > 0) {
                for (const inv of removedInvites) {
                    await supabaseAdmin.from('workspace_invites').upsert({
                        id: inv.id,
                        workspace_id: inv.workspace_id,
                        email: inv.email,
                        role: inv.role,
                    });
                }
            }
        }
    });
});
