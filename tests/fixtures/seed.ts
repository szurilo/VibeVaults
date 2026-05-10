/**
 * Main Responsibility: Programmatic E2E test data seeding.
 * Creates users, workspace, project, and invites via the Supabase admin API.
 * Returns all IDs and the project API key so tests can reference them.
 *
 * Sensitive Dependencies:
 * - supabase-admin.ts (admin client)
 * - test-data.ts (constants)
 */

import { supabaseAdmin } from '../utils/supabase-admin';
import { issueTestWidgetToken } from '../utils/widget-token';
import { TEST_USERS, TEST_WORKSPACE, TEST_PROJECT } from './test-data';

export interface SeedResult {
    ownerId: string;
    ownerEmail: string;
    memberId: string;
    memberEmail: string;
    clientId: string;
    clientEmail: string;
    clientInviteId: string;
    workspaceId: string;
    projectId: string;
    apiKey: string;
    /**
     * Pre-seeded widget bearer tokens, keyed by intended sender identity.
     * Each is a per-device token planted directly into widget_identities
     * — same primitive a real client would obtain by clicking
     * `?vv_invite=...` on the host site, or a member would obtain via
     * the dashboard's "Open widget on site" button. Tests pass these in
     * the Authorization header on widget API calls.
     */
    widgetTokens: {
        owner: string;
        member: string;
        client: string;
    };
}

/**
 * Seeds the database with a full E2E scenario:
 *   - Owner user with workspace + project (auto-created by DB trigger)
 *   - Member user invited & auto-accepted
 *   - Client user invited (workspace-level)
 */
export async function seedTestData(): Promise<SeedResult> {
    // 1. Create owner via admin auth (DB trigger creates workspace + profile)
    const { data: ownerAuth, error: ownerErr } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_USERS.owner.email,
        email_confirm: true,
    });
    if (ownerErr || !ownerAuth.user) throw new Error(`Owner creation failed: ${ownerErr?.message}`);
    const ownerId = ownerAuth.user.id;

    // Wait briefly for the DB trigger to fire and create the workspace
    await new Promise(r => setTimeout(r, 1000));

    // 2. Find the auto-created workspace
    const { data: workspaces, error: wsErr } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', ownerId);
    if (wsErr || !workspaces?.length) throw new Error(`Workspace not found for owner: ${wsErr?.message}`);
    const workspaceId = workspaces[0].id;

    // Rename workspace to our test name
    await supabaseAdmin
        .from('workspaces')
        .update({ name: TEST_WORKSPACE.name })
        .eq('id', workspaceId);

    // 3. Create the project under this workspace
    const { data: project, error: projErr } = await supabaseAdmin
        .from('projects')
        .insert({
            name: TEST_PROJECT.name,
            website_url: TEST_PROJECT.websiteUrl,
            workspace_id: workspaceId,
            user_id: ownerId,
        })
        .select('id, api_key')
        .single();
    if (projErr || !project) throw new Error(`Project creation failed: ${projErr?.message}`);

    // 4. Mark owner as onboarded + explicitly set trial_ends_at to avoid trigger race conditions
    await supabaseAdmin
        .from('profiles')
        .update({
            has_onboarded: true,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', ownerId);

    // 5. Create member user
    const { data: memberAuth, error: memErr } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_USERS.member.email,
        email_confirm: true,
    });
    if (memErr || !memberAuth.user) throw new Error(`Member creation failed: ${memErr?.message}`);
    const memberId = memberAuth.user.id;

    // Wait for member's auto-workspace trigger
    await new Promise(r => setTimeout(r, 500));

    // Add member to test workspace directly (simulating accepted invite)
    await supabaseAdmin
        .from('workspace_members')
        .insert({
            workspace_id: workspaceId,
            user_id: memberId,
            role: 'member',
        });

    // Mark member as onboarded
    await supabaseAdmin
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', memberId);

    // 6. Create client user
    const { data: clientAuth, error: cliErr } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_USERS.client.email,
        email_confirm: true,
    });
    if (cliErr || !clientAuth.user) throw new Error(`Client creation failed: ${cliErr?.message}`);
    const clientId = clientAuth.user.id;

    // Wait for client's auto-workspace trigger
    await new Promise(r => setTimeout(r, 500));

    // Create workspace invite for client. In the new invite-only widget
    // model this row is also the authorization anchor — the client invite
    // ID doubles as the bootstrap token, and FK-cascade-deleting it
    // revokes every widget token derived from it.
    const { data: clientInvite, error: cInvErr } = await supabaseAdmin
        .from('workspace_invites')
        .insert({
            workspace_id: workspaceId,
            email: TEST_USERS.client.email,
            role: 'client',
        })
        .select('id')
        .single();
    if (cInvErr || !clientInvite) throw new Error(`Client invite creation failed: ${cInvErr?.message}`);

    // 7. Pre-issue widget tokens for owner, member, and client so tests
    // can hit widget API endpoints with `Authorization: Bearer <token>`
    // without going through the real bootstrap UX.
    const [ownerWidgetToken, memberWidgetToken, clientWidgetToken] = await Promise.all([
        issueTestWidgetToken({
            projectId: project.id,
            email: TEST_USERS.owner.email,
            userId: ownerId,
        }),
        issueTestWidgetToken({
            projectId: project.id,
            email: TEST_USERS.member.email,
            userId: memberId,
        }),
        issueTestWidgetToken({
            projectId: project.id,
            email: TEST_USERS.client.email,
            inviteId: clientInvite.id,
        }),
    ]);

    return {
        ownerId,
        ownerEmail: TEST_USERS.owner.email,
        memberId,
        memberEmail: TEST_USERS.member.email,
        clientId,
        clientEmail: TEST_USERS.client.email,
        clientInviteId: clientInvite.id,
        workspaceId,
        projectId: project.id,
        apiKey: project.api_key,
        widgetTokens: {
            owner: ownerWidgetToken,
            member: memberWidgetToken,
            client: clientWidgetToken,
        },
    };
}
