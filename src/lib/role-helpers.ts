/**
 * Main Responsibility: Single source of truth for workspace role checks.
 * Replaces scattered inline `membership.role !== 'owner'` checks across
 * API routes, server actions, and server components.
 *
 * Sensitive Dependencies:
 * - workspace_members table schema: composite key (workspace_id, user_id), no `id` column
 * - Role values: 'owner' | 'member' | 'client'
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceRole = 'owner' | 'member' | 'client';

// ---------------------------------------------------------------------------
// Async lookups (use a Supabase client — server or admin)
// ---------------------------------------------------------------------------

/**
 * Returns the user's role in a workspace, or null if not a member.
 * Pass a user-scoped client (RLS-enforced) or admin client depending on context.
 */
export async function getUserWorkspaceRole(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
): Promise<WorkspaceRole | null> {
    const { data } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single();
    return (data?.role as WorkspaceRole | undefined) ?? null;
}

/** True if the user is the owner of the workspace. */
export async function isWorkspaceOwner(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
): Promise<boolean> {
    return (await getUserWorkspaceRole(supabase, userId, workspaceId)) === 'owner';
}

// ---------------------------------------------------------------------------
// Pure derivations (work on an already-fetched members array)
// Safe for both server and client components.
// ---------------------------------------------------------------------------

type MemberLike = { user_id: string; role: string };

/** True if `userId` appears as an owner in the provided members list. */
export function isOwnerInMembers(
    members: MemberLike[] | null | undefined,
    userId: string | undefined | null,
): boolean {
    if (!members || !userId) return false;
    return members.some(m => m.user_id === userId && m.role === 'owner');
}

/** Returns the role for `userId` in the provided members list, or null. */
export function getRoleFromMembers(
    members: MemberLike[] | null | undefined,
    userId: string | undefined | null,
): WorkspaceRole | null {
    if (!members || !userId) return null;
    const m = members.find(x => x.user_id === userId);
    return (m?.role as WorkspaceRole | undefined) ?? null;
}
