/**
 * Main Responsibility: Server-side logic for accepting pending workspace invites.
 * Ensures the authenticated user's email matches the invite's target email before
 * granting workspace membership, preventing invite-link hijacking.
 *
 * Sensitive Dependencies:
 * - Supabase Server Client (@/lib/supabase/server) for user auth lookup.
 * - Supabase Admin Client (@/lib/supabase/admin) for invite read and workspace_members
 *   write (bypasses RLS — invited user is not yet a member, so standard RLS would block).
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchMemberWelcomeBootstrap } from '@/lib/member-onboarding';

export type AcceptInviteResult =
    | { ok: true; workspaceId: string }
    | { ok: false; reason: 'not_authenticated' | 'invite_not_found' | 'email_mismatch' | 'internal_error' | 'client_invite_not_acceptable' };

export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
    if (!token) {
        return { ok: false, reason: 'invite_not_found' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
        return { ok: false, reason: 'not_authenticated' };
    }

    const admin = createAdminClient();

    const { data: invite } = await admin
        .from('workspace_invites')
        .select('id, workspace_id, email, role')
        .eq('id', token)
        .maybeSingle();

    if (!invite) {
        return { ok: false, reason: 'invite_not_found' };
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return { ok: false, reason: 'email_mismatch' };
    }

    // Client invites no longer flow through the auth/accept-invite path.
    // Clients access the widget via per-device tokens bootstrapped from
    // the host URL (?vv_invite=...) — they never become workspace_members.
    // This guard rejects any stale client-invite link routed here.
    if (invite.role === 'client') {
        return { ok: false, reason: 'client_invite_not_acceptable' };
    }

    // Insert membership. Composite PK (workspace_id, user_id) makes this idempotent —
    // a duplicate accept just returns 23505, which we treat as success.
    const { error: insertError } = await admin
        .from('workspace_members')
        .insert({
            workspace_id: invite.workspace_id,
            user_id: user.id,
            role: invite.role,
        });

    if (insertError && insertError.code !== '23505') {
        console.error('acceptInvite: membership insert failed', insertError);
        return { ok: false, reason: 'internal_error' };
    }

    await admin
        .from('workspace_invites')
        .delete()
        .eq('id', invite.id);

    // Fire-and-forget welcome email with per-project widget bootstrap links.
    // Errors are logged inside the helper; failure here must not block the
    // membership write that just succeeded.
    dispatchMemberWelcomeBootstrap({
        workspaceId: invite.workspace_id,
        userId: user.id,
        userEmail: user.email,
    }).catch(() => {});

    return { ok: true, workspaceId: invite.workspace_id };
}
