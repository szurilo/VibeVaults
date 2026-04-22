/**
 * Main Responsibility: Server-side tier resolution and limit enforcement functions.
 * All queries use the admin client to bypass RLS. Limit checks resolve through
 * the workspace owner's tier (members/clients don't have their own subscriptions).
 *
 * Sensitive Dependencies:
 * - supabase/admin.ts (admin client for RLS bypass)
 * - tier-config.ts (tier definitions and limits)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getTierLimits, isSubscribed, isTrialActive, type TierSlug, type TierLimits } from './tier-config';

export { hasActiveAccess, isTrialExpired, isSubscribed, isTrialActive } from './tier-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierInfo {
    tier: TierSlug | null;
    isTrialing: boolean;
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

    // During trial, effective tier is Pro regardless of subscription_tier value
    const effectiveTier = isTrialing ? 'pro' : tier;

    return {
        tier,
        isTrialing,
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
