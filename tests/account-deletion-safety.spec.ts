/**
 * Main Responsibility: Regression tests for account deletion safety.
 * Ensures that when an invited workspace member deletes their account,
 * only their own data is removed — workspace-level data they contributed
 * (projects, replies) must survive.
 *
 * Scenarios covered:
 *   1. Projects created by the member in another owner's workspace survive
 *      (projects.user_id becomes NULL, project remains).
 *   2. Dashboard replies authored by the member survive with content intact
 *      (feedback_replies.user_id becomes NULL, author_name preserved).
 *   3. email_digest_queue entries for the member's email are purged.
 *   4. workspace_invites addressed to the member's email are purged.
 *
 * Sensitive Dependencies:
 *   - Creates a throwaway member user (e2e-del-safety-*) in the seeded owner's
 *     workspace. The user is deleted by the test itself; global teardown handles
 *     any leftovers.
 *   - Inserts rows directly into email_digest_queue and workspace_invites via
 *     the admin client to set up fixtures without needing full UI flows.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin, generateMagicLink } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import type { SeedResult } from './fixtures/seed';

test.describe.configure({ mode: 'serial' });

test.describe('Account deletion safety', () => {
    let seed: SeedResult;

    // IDs created during setup — used for post-deletion assertions.
    let tempUserId: string;
    let tempEmail: string;
    let tempProjectId: string;
    let tempReplyId: string;
    let tempFeedbackId: string;

    test.beforeAll(async ({ browser }) => {
        seed = getSeedResult();

        // ── Create a disposable member ──────────────────────────────────────
        tempEmail = `e2e-del-safety-${Date.now()}@example.com`;
        const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
            email: tempEmail,
            email_confirm: true,
        });
        if (error || !user) throw new Error(`Could not create temp user: ${error?.message}`);
        tempUserId = user.id;

        // Wait for the DB trigger to fire (profile + auto-workspace creation).
        await new Promise(r => setTimeout(r, 1_000));

        // Add to the seeded owner's workspace as a member.
        await supabaseAdmin.from('workspace_members').insert({
            workspace_id: seed.workspaceId,
            user_id: tempUserId,
            role: 'member',
        });

        // ── Create a project as this member in the owner's workspace ────────
        const { data: project, error: projErr } = await supabaseAdmin
            .from('projects')
            .insert({
                name: 'Temp Member Project',
                website_url: 'https://temp-member.example.com',
                workspace_id: seed.workspaceId,
                user_id: tempUserId,
            })
            .select('id')
            .single();
        if (projErr || !project) throw new Error(`Project creation failed: ${projErr?.message}`);
        tempProjectId = project.id;

        // ── Create a feedback entry so we have something to reply to ────────
        const { data: feedback, error: fbErr } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'Fixture feedback for deletion safety test',
                type: 'Bug',
                sender: 'fixture@example.com',
                status: 'open',
            })
            .select('id')
            .single();
        if (fbErr || !feedback) throw new Error(`Feedback creation failed: ${fbErr?.message}`);
        tempFeedbackId = feedback.id;

        // ── Write a reply as the temp member (dashboard/agency reply) ───────
        const { data: reply, error: replyErr } = await supabaseAdmin
            .from('feedback_replies')
            .insert({
                feedback_id: tempFeedbackId,
                user_id: tempUserId,
                author_role: 'agency',
                author_name: tempEmail.split('@')[0],
                content: 'Reply that must survive account deletion',
            })
            .select('id')
            .single();
        if (replyErr || !reply) throw new Error(`Reply creation failed: ${replyErr?.message}`);
        tempReplyId = reply.id;

        // ── Seed an email_digest_queue row for the member's email ───────────
        await supabaseAdmin.from('email_digest_queue').insert({
            recipient_email: tempEmail,
            notification_type: 'new_feedback',
            project_id: seed.projectId,
            payload: { test: true },
        });

        // ── Seed a workspace_invite for the member's email in another ws ────
        // Use the seeded workspace (already exists) — the invite keyed on email
        // won't conflict because the member is already a member (different table).
        // We insert directly into a second workspace owned by the member's own
        // auto-created workspace; simplest is to use the admin client directly.
        // Just ensure at least one invite row exists for this email:
        const { data: memberOwnedWs } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', tempUserId)
            .single();

        if (memberOwnedWs) {
            // Invite some random email into the member's own workspace so we
            // have an invite row keyed on a different email — but for our test
            // we actually want an invite for tempEmail in the owner's workspace:
            await supabaseAdmin.from('workspace_invites').upsert(
                {
                    workspace_id: seed.workspaceId,
                    email: tempEmail,
                    role: 'member',
                },
                { onConflict: 'workspace_id,email', ignoreDuplicates: true }
            );
        }

        // ── Authenticate as the temp user and delete the account ────────────
        const magicLink = await generateMagicLink(tempEmail);
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(magicLink);
        await page.waitForURL('**/dashboard**', { timeout: 15_000 });

        const response = await page.request.delete('/api/auth/delete-account');
        expect(response.ok(), `delete-account returned ${response.status()}: ${await response.text()}`).toBe(true);
        await ctx.close();

        // Give the DB a moment to process cascades.
        await new Promise(r => setTimeout(r, 500));
    });

    // ── Scenario 1: Project survives ──────────────────────────────────────────
    test('project created by member in owner workspace survives deletion', async () => {
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, user_id, workspace_id')
            .eq('id', tempProjectId)
            .single();

        expect(error).toBeNull();
        expect(project).not.toBeNull();
        expect(project!.workspace_id).toBe(seed.workspaceId);
        // user_id must be NULL — not the deleted user's ID, not missing.
        expect(project!.user_id).toBeNull();
    });

    // ── Scenario 2: Reply survives with content intact ────────────────────────
    test('dashboard reply authored by member survives with content and author_name intact', async () => {
        const { data: reply, error } = await supabaseAdmin
            .from('feedback_replies')
            .select('id, user_id, author_name, content')
            .eq('id', tempReplyId)
            .single();

        expect(error).toBeNull();
        expect(reply).not.toBeNull();
        expect(reply!.content).toBe('Reply that must survive account deletion');
        expect(reply!.author_name).toBe(tempEmail.split('@')[0]);
        // user_id must be NULL — the author row is gone but the reply is not.
        expect(reply!.user_id).toBeNull();
    });

    // ── Scenario 3: email_digest_queue entries are purged ────────────────────
    test('email_digest_queue entries for deleted email are removed', async () => {
        const { data, error } = await supabaseAdmin
            .from('email_digest_queue')
            .select('id')
            .eq('recipient_email', tempEmail);

        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    // ── Scenario 4: workspace_invites for deleted email are purged ────────────
    test('workspace_invites for deleted email are removed', async () => {
        const { data, error } = await supabaseAdmin
            .from('workspace_invites')
            .select('id')
            .eq('email', tempEmail);

        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    // ── Cleanup: remove fixture feedback ─────────────────────────────────────
    test.afterAll(async () => {
        if (tempFeedbackId) {
            await supabaseAdmin.from('feedbacks').delete().eq('id', tempFeedbackId);
        }
        if (tempProjectId) {
            await supabaseAdmin.from('projects').delete().eq('id', tempProjectId);
        }
    });
});
