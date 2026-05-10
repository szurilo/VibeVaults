/**
 * Mints a widget identity token directly via the Supabase admin client,
 * mirroring `issueWidgetIdentity` from src/lib/widget-helpers.ts. Use this
 * in tests that create projects, members, or invites mid-run and need a
 * Bearer token to hit widget API endpoints — the seed only pre-issues
 * tokens for the seeded project.
 *
 * Returns the raw token (only available at issue time; only the sha256
 * hash is persisted in widget_identities.token_hash).
 */
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

export type IssueTestWidgetTokenArgs = {
    projectId: string;
    email: string;
    /** Set when binding to a client invite (workspace_invites.id). */
    inviteId?: string | null;
    /** Set when binding to a workspace member or owner (auth.users.id). */
    userId?: string | null;
};

export async function issueTestWidgetToken(args: IssueTestWidgetTokenArgs): Promise<string> {
    if (!args.inviteId && !args.userId) {
        throw new Error('issueTestWidgetToken requires either inviteId or userId');
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { error } = await supabaseAdmin.from('widget_identities').insert({
        project_id: args.projectId,
        email: args.email,
        invite_id: args.inviteId ?? null,
        user_id: args.userId ?? null,
        token_hash: tokenHash,
    });
    if (error) throw new Error(`issueTestWidgetToken insert failed: ${error.message}`);
    return rawToken;
}
