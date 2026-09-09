/**
 * Main Responsibility: Server-side tier resolution and limit enforcement functions.
 * All queries use the admin client to bypass RLS. Limit checks resolve through
 * the workspace owner's tier (members/clients don't have their own subscriptions).
 *
 * Sensitive Dependencies:
 * - supabase/admin.ts (admin client for RLS bypass)
 * - tier-config.ts (tier definitions and limits)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTierLimits, hasActiveAccess, isSubscribed, isTrialActive, type TierSlug, type TierLimits } from './tier-config';

export { hasActiveAccess, isTrialExpired, isSubscribed, isTrialActive } from './tier-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierInfo {
    tier: TierSlug | null;
    isTrialing: boolean;
    trialStarted: boolean;
    effectiveLimits: TierLimits;
}

export interface LimitCheck {
    allowed: boolean;
    message?: string;
}

// ---------------------------------------------------------------------------
// Tier resolution
// ---------------------------------------------------------------------------

/**
 * Get the effective tier for a user. During trial (or null tier), treated as Pro.
 */
export async function getUserTier(userId: string): Promise<TierInfo> {
    const admin = createAdminClient();
    const { data: profile } = await admin
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at')
        .eq('id', userId)
        .single();

    const tier = (profile?.subscription_tier as TierSlug | null) ?? null;
    const isTrialing = !isSubscribed(profile) && isTrialActive(profile);
    const trialStarted = !!profile?.trial_ends_at;

    // During trial, effective tier is Pro regardless of subscription_tier value
    const effectiveTier = isTrialing ? 'pro' : tier;

    return {
        tier,
        isTrialing,
        trialStarted,
        effectiveLimits: getTierLimits(effectiveTier),
    };
}

/**
 * Get the workspace owner's effective tier.
 */
export async function getWorkspaceOwnerTier(workspaceId: string): Promise<TierInfo & { ownerId: string }> {
    const admin = createAdminClient();
    const { data: workspace } = await admin
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

    if (!workspace?.owner_id) {
        throw new Error('Workspace not found');
    }

    const tierInfo = await getUserTier(workspace.owner_id);
    return { ...tierInfo, ownerId: workspace.owner_id };
}

// ---------------------------------------------------------------------------
// Workspace access gate (owner-derived)
//
// A workspace is live only while its OWNER has active access. Members and
// clients never hold their own subscription, so every gate — page routing,
// server actions, API routes, the widget — must resolve through the owner.
// Deriving it from the *viewer's* profile instead is what let members of a
// lapsed owner keep working for free.
// ---------------------------------------------------------------------------

export interface WorkspaceAccess {
    /** True while the workspace may be used (owner subscribed or in trial). */
    ok: boolean;
    ownerId: string | null;
    ownerEmail: string | null;
    /** Owner's paid tier, or null while trialing / lapsed. */
    ownerTier: TierSlug | null;
}

/**
 * Resolves whether a workspace is currently usable, by looking at its owner's
 * billing state. The single source of truth for "is this workspace live"; the
 * widget gate (`checkOwnerAccess`), the proxy, server actions and API routes
 * all route through this or through `hasActiveAccess` on the same columns.
 *
 * An ownerless workspace (shouldn't happen — `owner_id` is set at creation)
 * fails open, matching the widget gate's long-standing behaviour: we would
 * rather serve a malformed row than black out a paying customer's site.
 */
export async function getWorkspaceAccess(workspaceId: string): Promise<WorkspaceAccess> {
    const admin = createAdminClient();

    const { data: workspace } = await admin
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

    if (!workspace?.owner_id) {
        return { ok: true, ownerId: null, ownerEmail: null, ownerTier: null };
    }

    const { data: profile } = await admin
        .from('profiles')
        .select('email, subscription_status, trial_ends_at, subscription_tier')
        .eq('id', workspace.owner_id)
        .single();

    const ok = hasActiveAccess(profile);

    return {
        ok,
        ownerId: workspace.owner_id,
        ownerEmail: (profile?.email as string | null) ?? null,
        // A lapsed owner has no effective tier, even if `subscription_tier`
        // still holds a value (a failed payment leaves the tier in place and
        // only flips `subscription_status`).
        ownerTier: ok ? ((profile?.subscription_tier as TierSlug | null) ?? null) : null,
    };
}

/** Same gate, addressed by project instead of workspace. */
export async function getProjectWorkspaceAccess(
    projectId: string,
): Promise<WorkspaceAccess & { workspaceId: string | null }> {
    const admin = createAdminClient();
    const { data: project } = await admin
        .from('projects')
        .select('workspace_id')
        .eq('id', projectId)
        .single();

    if (!project?.workspace_id) {
        return { ok: false, ownerId: null, ownerEmail: null, ownerTier: null, workspaceId: null };
    }

    const access = await getWorkspaceAccess(project.workspace_id);
    return { ...access, workspaceId: project.workspace_id };
}

/**
 * Liveness for every workspace the calling user belongs to, as
 * `workspaceId → isLive`, in one round trip. Backed by the
 * `get_user_workspace_billing()` SECURITY DEFINER RPC because `profiles` RLS
 * hides the owner's row from members.
 *
 * Pass a USER-SCOPED client — the RPC derives the workspace set from
 * `auth.uid()`, so an admin client would return nothing.
 *
 * Fails open: on error the map comes back empty, and a workspace missing from
 * the map must be treated as live. Locking paying customers out of their own
 * dashboard because one query hiccuped is the worse failure.
 */
export async function getViewerWorkspaceLiveness(
    supabase: SupabaseClient,
): Promise<Record<string, boolean>> {
    const { data, error } = await supabase.rpc('get_user_workspace_billing');

    if (error || !data) {
        if (error) console.error('getViewerWorkspaceLiveness failed:', error.message);
        return {};
    }

    const rows = data as Array<{
        workspace_id: string;
        subscription_status: string | null;
        trial_ends_at: string | null;
    }>;

    const map: Record<string, boolean> = {};
    for (const row of rows) {
        map[row.workspace_id] = hasActiveAccess(row);
    }
    return map;
}

/** True unless the liveness map explicitly says the workspace is paused (fail open). */
export function isWorkspaceLive(
    liveness: Record<string, boolean>,
    workspaceId: string | undefined | null,
): boolean {
    if (!workspaceId) return true;
    return liveness[workspaceId] !== false;
}

/**
 * Context-aware copy for a blocked mutation, mirroring how the limit checks
 * above word themselves differently for owners and members. Owners can fix it
 * themselves; members can only nudge whoever pays.
 */
export function workspacePausedMessage(isOwner: boolean, ownerEmail?: string | null): string {
    if (isOwner) {
        return 'Your subscription is inactive. Renew your plan to continue working in this workspace.';
    }
    const who = ownerEmail ? `the workspace owner (${ownerEmail})` : 'the workspace owner';
    return `This workspace is paused because its owner's subscription has expired. Ask ${who} to renew to continue working.`;
}

/**
 * Guard for workspace-scoped mutations (server actions and API routes).
 * Returns `null` when the caller may proceed, or a ready-to-surface message
 * when the workspace is paused.
 *
 * Deliberately NOT applied to leaving a workspace, removing a member, email
 * preferences, or unsubscribing: those are exits and opt-outs, and locking a
 * user inside a workspace they can't use (or inside emails they can't stop)
 * would be a support and compliance problem, not revenue protection.
 */
export async function checkWorkspaceActive(
    workspaceId: string,
    userId: string,
): Promise<string | null> {
    const access = await getWorkspaceAccess(workspaceId);
    if (access.ok) return null;
    return workspacePausedMessage(access.ownerId === userId, access.ownerEmail);
}

/** Same guard, addressed by project. */
export async function checkProjectWorkspaceActive(
    projectId: string,
    userId: string,
): Promise<string | null> {
    const access = await getProjectWorkspaceAccess(projectId);
    if (access.ok) return null;
    return workspacePausedMessage(access.ownerId === userId, access.ownerEmail);
}

/** Same guard, addressed by feedback (feedback → project → workspace → owner). */
export async function checkFeedbackWorkspaceActive(
    feedbackId: string,
    userId: string,
): Promise<string | null> {
    const admin = createAdminClient();
    const { data: feedback } = await admin
        .from('feedbacks')
        .select('project_id')
        .eq('id', feedbackId)
        .single();

    // No project to resolve — let the caller's own RLS check produce the error.
    if (!feedback?.project_id) return null;

    return checkProjectWorkspaceActive(feedback.project_id, userId);
}

// ---------------------------------------------------------------------------
// Count helpers
// ---------------------------------------------------------------------------

/** Count workspaces owned by a user. */
export async function countUserWorkspaces(userId: string): Promise<number> {
    const admin = createAdminClient();
    const { count } = await admin
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);
    return count ?? 0;
}

/** Count all projects across all workspaces owned by a user. */
export async function countUserProjects(userId: string): Promise<number> {
    const admin = createAdminClient();

    const { data: workspaces } = await admin
        .from('workspaces')
        .select('id')
        .eq('owner_id', userId);

    if (!workspaces || workspaces.length === 0) return 0;

    const { count } = await admin
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('workspace_id', workspaces.map(w => w.id));

    return count ?? 0;
}

/**
 * Count team members in a workspace (excluding owner, excluding clients).
 * Also counts pending member invites since those count toward the limit.
 */
export async function countWorkspaceMembers(workspaceId: string): Promise<number> {
    const admin = createAdminClient();

    // Count existing members (excluding owner)
    const { count: memberCount } = await admin
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'member');

    // Count pending member invites
    const { count: inviteCount } = await admin
        .from('workspace_invites')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'member');

    return (memberCount ?? 0) + (inviteCount ?? 0);
}

/**
 * Sum file storage used by a user across all their owned workspaces (in bytes).
 */
export async function getStorageUsedBytes(userId: string): Promise<number> {
    const admin = createAdminClient();

    // Get all workspace IDs owned by this user
    const { data: workspaces } = await admin
        .from('workspaces')
        .select('id')
        .eq('owner_id', userId);

    if (!workspaces || workspaces.length === 0) return 0;

    const workspaceIds = workspaces.map(w => w.id);

    // Get all project IDs in those workspaces
    const { data: projects } = await admin
        .from('projects')
        .select('id')
        .in('workspace_id', workspaceIds);

    if (!projects || projects.length === 0) return 0;

    const projectIds = projects.map(p => p.id);

    // Sum file sizes across all attachments for these projects
    // (Supabase JS doesn't support SUM aggregation directly, so we fetch and sum in JS)
    const { data: attachments } = await admin
        .from('feedback_attachments')
        .select('file_size')
        .in('project_id', projectIds);

    if (!attachments || attachments.length === 0) return 0;

    return attachments.reduce((sum, a) => sum + (a.file_size || 0), 0);
}

// ---------------------------------------------------------------------------
// Limit check functions
// ---------------------------------------------------------------------------

/**
 * Check if user can create another workspace.
 */
export async function checkWorkspaceLimit(userId: string): Promise<LimitCheck> {
    const { effectiveLimits } = await getUserTier(userId);

    if (effectiveLimits.maxWorkspaces === Infinity) {
        return { allowed: true };
    }

    const count = await countUserWorkspaces(userId);
    if (count >= effectiveLimits.maxWorkspaces) {
        return {
            allowed: false,
            message: `You've reached the workspace limit for your plan which is ${effectiveLimits.maxWorkspaces}. Upgrade to add more workspaces.`,
        };
    }

    return { allowed: true };
}

/**
 * Check if another project can be created in a workspace.
 * Resolves through the workspace owner's tier.
 */
export async function checkProjectLimit(workspaceId: string, requestingUserId?: string): Promise<LimitCheck> {
    const { effectiveLimits, ownerId } = await getWorkspaceOwnerTier(workspaceId);

    if (effectiveLimits.maxProjects === Infinity) {
        return { allowed: true };
    }

    const count = await countUserProjects(ownerId);
    if (count >= effectiveLimits.maxProjects) {
        const isOwner = requestingUserId === ownerId;
        return {
            allowed: false,
            message: isOwner
                ? `You've reached the project limit for your plan which is ${effectiveLimits.maxProjects}. Upgrade to add more projects.`
                : `The workspace owner has reached the project limit of ${effectiveLimits.maxProjects}. Ask the owner to upgrade the plan.`,
        };
    }

    return { allowed: true };
}

/**
 * Check if another team member can be invited to a workspace.
 * Resolves through the workspace owner's tier. Clients are unlimited.
 */
export async function checkMemberLimit(workspaceId: string): Promise<LimitCheck> {
    const { effectiveLimits } = await getWorkspaceOwnerTier(workspaceId);

    if (effectiveLimits.maxTeamMembers === Infinity) {
        return { allowed: true };
    }

    const count = await countWorkspaceMembers(workspaceId);
    if (count >= effectiveLimits.maxTeamMembers) {
        return {
            allowed: false,
            message: `This workspace has reached its team member limit which is ${effectiveLimits.maxTeamMembers}. Upgrade to invite more members.`,
        };
    }

    return { allowed: true };
}

/**
 * Check if a file upload would exceed the user's storage limit.
 * @param userId - The workspace owner's user ID
 * @param additionalBytes - Size of the files being uploaded
 */
export async function checkStorageLimit(userId: string, additionalBytes: number): Promise<LimitCheck> {
    const { effectiveLimits } = await getUserTier(userId);
    const used = await getStorageUsedBytes(userId);
    const total = used + additionalBytes;

    if (total > effectiveLimits.storageBytes) {
        const usedMB = (used / (1024 * 1024)).toFixed(1);
        const limitMB = (effectiveLimits.storageBytes / (1024 * 1024)).toFixed(0);
        return {
            allowed: false,
            message: `Storage limit exceeded. You're using ${usedMB} MB of ${limitMB} MB. Upgrade your plan for more storage.`,
        };
    }

    return { allowed: true };
}

// ---------------------------------------------------------------------------
// Utility: format storage for display
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
