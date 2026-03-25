'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserTier, countUserWorkspaces, countUserProjects, countWorkspaceMembers, getStorageUsedBytes } from '@/lib/tier-helpers';
import { type TierSlug, type TierLimits, getTierLimits } from '@/lib/tier-config';
import { cookies } from 'next/headers';

export interface TierUsage {
    tier: TierSlug | null;
    isTrialing: boolean;
    limits: TierLimits;
    usage: {
        workspaces: number;
        projects: number;
        members: number;
        storageBytes: number;
    };
}

/**
 * Returns the current user's tier, limits, and usage for the active workspace.
 * Used by dashboard components to show usage indicators and disable buttons at limits.
 */
export async function getTierUsageAction(): Promise<TierUsage> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Not authenticated');
    }

    const cookieStore = await cookies();
    const selectedWorkspaceId = cookieStore.get('selectedWorkspaceId')?.value;

    const tierInfo = await getUserTier(user.id);

    // Gather usage counts in parallel
    const [workspaceCount, projectCount, memberCount, storageBytes] = await Promise.all([
        countUserWorkspaces(user.id),
        countUserProjects(user.id),
        selectedWorkspaceId ? countWorkspaceMembers(selectedWorkspaceId) : Promise.resolve(0),
        getStorageUsedBytes(user.id),
    ]);

    return {
        tier: tierInfo.tier,
        isTrialing: tierInfo.isTrialing,
        limits: tierInfo.effectiveLimits,
        usage: {
            workspaces: workspaceCount,
            projects: projectCount,
            members: memberCount,
            storageBytes,
        },
    };
}
