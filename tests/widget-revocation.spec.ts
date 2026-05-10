/**
 * Tier 1 — Revocation cascades on widget_identities
 *
 * Two complementary teardown paths protect the new invite-only widget model
 * from "removed user can still hit the widget API" leakage:
 *
 *   1. Member-removal trigger (`revoke_widget_identities_on_member_removal`):
 *      when a `workspace_members` row is DELETEd, all `widget_identities`
 *      rows for that user_id within that workspace's projects are deleted.
 *      The same user's identities in OTHER workspaces must be untouched.
 *
 *   2. FK cascade on workspace_invites: deleting a `workspace_invites` row
 *      cascade-deletes any `widget_identities` whose `invite_id` referenced
 *      it. This covers the client-side equivalent of removal — kicking a
 *      client = removing their invite.
 *
 * Sensitive Dependencies:
 * - All scenarios use disposable users/workspaces created via the auth admin
 *   API and torn down via deleteUser (which cascades through workspaces /
 *   projects / members / invites / widget_identities).
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { issueTestWidgetToken } from './utils/widget-token';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.empty });

// Pure DB / SQL trigger behaviour — no browser involved at all. Skip on
// non-chromium projects so the trigger doesn't fire 3× in parallel and
// race on the disposable users we create per test.
test.skip(({ browserName }) => browserName !== 'chromium', 'DB-trigger behaviour — single-browser run');

// Helper: create a fresh user + auto-workspace + a project under it. Returns
// IDs the caller can use to mint widget_identities and assert on.
async function createDisposableWorkspace(opts: { userEmail: string; projectName?: string; websiteUrl?: string }) {
    const { data: user, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: opts.userEmail,
        email_confirm: true,
    });
    if (userErr || !user.user) throw new Error(`user create failed: ${userErr?.message}`);

    // Wait for the workspace trigger to settle.
    await new Promise(r => setTimeout(r, 800));

    const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.user.id)
        .single();

    const { data: project } = await supabaseAdmin
        .from('projects')
        .insert({
            name: opts.projectName ?? `revocation-${Date.now()}`,
            website_url: opts.websiteUrl ?? 'https://revoke.example.com',
            workspace_id: ws!.id,
            user_id: user.user.id,
        })
        .select('id')
        .single();

    return {
        userId: user.user.id,
        workspaceId: ws!.id,
        projectId: project!.id,
    };
}

// ---------------------------------------------------------------------------
// Member-removal trigger
// ---------------------------------------------------------------------------

test.describe('revoke_widget_identities_on_member_removal trigger', () => {
    test('removing a workspace_members row deletes that user\'s widget_identities for that workspace, and ONLY that workspace', async () => {
        const ownerEmail = `e2e-revoke-owner-${Date.now()}@example.com`;
        const otherOwnerEmail = `e2e-revoke-other-${Date.now()}@example.com`;
        const memberEmail = `e2e-revoke-member-${Date.now()}@example.com`;

        // Two separate workspaces.
        const ws1 = await createDisposableWorkspace({ userEmail: ownerEmail, projectName: 'ws1-project' });
        const ws2 = await createDisposableWorkspace({ userEmail: otherOwnerEmail, projectName: 'ws2-project' });

        // A single user who's a member of both.
        const { data: member, error: memberErr } = await supabaseAdmin.auth.admin.createUser({
            email: memberEmail,
            email_confirm: true,
        });
        if (memberErr || !member.user) throw new Error(`member create failed: ${memberErr?.message}`);
        await new Promise(r => setTimeout(r, 800));

        try {
            await supabaseAdmin.from('workspace_members').insert([
                { workspace_id: ws1.workspaceId, user_id: member.user.id, role: 'member' },
                { workspace_id: ws2.workspaceId, user_id: member.user.id, role: 'member' },
            ]);

            // Mint a widget identity for the member in BOTH workspaces' projects.
            await Promise.all([
                issueTestWidgetToken({ projectId: ws1.projectId, email: memberEmail, userId: member.user.id }),
                issueTestWidgetToken({ projectId: ws2.projectId, email: memberEmail, userId: member.user.id }),
            ]);

            // Sanity: both rows exist.
            const beforeWs1 = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', ws1.projectId)
                .eq('user_id', member.user.id);
            const beforeWs2 = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', ws2.projectId)
                .eq('user_id', member.user.id);
            expect(beforeWs1.count).toBe(1);
            expect(beforeWs2.count).toBe(1);

            // Remove member from ws1 only. The trigger should fire.
            const { error: removeErr } = await supabaseAdmin
                .from('workspace_members')
                .delete()
                .eq('workspace_id', ws1.workspaceId)
                .eq('user_id', member.user.id);
            expect(removeErr).toBeNull();

            // ws1 row gone, ws2 row untouched.
            const afterWs1 = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', ws1.projectId)
                .eq('user_id', member.user.id);
            const afterWs2 = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('project_id', ws2.projectId)
                .eq('user_id', member.user.id);
            expect(afterWs1.count, 'ws1 widget_identities revoked').toBe(0);
            expect(afterWs2.count, 'ws2 widget_identities preserved').toBe(1);
        } finally {
            // deleteUser cascades through everything.
            await supabaseAdmin.auth.admin.deleteUser(member.user.id);
            await supabaseAdmin.auth.admin.deleteUser(ws1.userId);
            await supabaseAdmin.auth.admin.deleteUser(ws2.userId);
        }
    });
});

// ---------------------------------------------------------------------------
// FK cascade on workspace_invites delete
// ---------------------------------------------------------------------------

test.describe('workspace_invites delete cascade to widget_identities', () => {
    test('deleting a client workspace_invites row removes every widget_identities row that referenced its id', async () => {
        const ownerEmail = `e2e-cascade-owner-${Date.now()}@example.com`;
        const clientEmail = `e2e-cascade-client-${Date.now()}@example.com`;

        const ws = await createDisposableWorkspace({ userEmail: ownerEmail, projectName: 'cascade-project' });

        try {
            // Create a client invite.
            const { data: invite, error: inviteErr } = await supabaseAdmin
                .from('workspace_invites')
                .insert({
                    workspace_id: ws.workspaceId,
                    email: clientEmail,
                    role: 'client',
                })
                .select('id')
                .single();
            if (inviteErr || !invite) throw new Error(`invite create failed: ${inviteErr?.message}`);

            // Mint two devices' widget_identities for that invite (multi-device).
            await Promise.all([
                issueTestWidgetToken({ projectId: ws.projectId, email: clientEmail, inviteId: invite.id }),
                issueTestWidgetToken({ projectId: ws.projectId, email: clientEmail, inviteId: invite.id }),
            ]);

            const beforeCount = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('invite_id', invite.id);
            expect(beforeCount.count).toBe(2);

            // Delete the invite — the FK cascade on widget_identities.invite_id
            // should clear both rows automatically.
            const { error: delErr } = await supabaseAdmin
                .from('workspace_invites')
                .delete()
                .eq('id', invite.id);
            expect(delErr).toBeNull();

            const afterCount = await supabaseAdmin
                .from('widget_identities')
                .select('id', { count: 'exact', head: true })
                .eq('invite_id', invite.id);
            expect(afterCount.count, 'cascade should null out every dependent row').toBe(0);
        } finally {
            await supabaseAdmin.auth.admin.deleteUser(ws.userId);
        }
    });
});
