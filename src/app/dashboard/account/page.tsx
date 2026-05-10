import { DeleteAccountCard } from "@/components/delete-account-card";
import { NotificationsCard } from "@/components/notifications-card";
import { BillingCard } from "@/components/billing-card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserTier, countUserWorkspaces, countUserProjects, countWorkspaceMembers, getStorageUsedBytes, formatBytes } from "@/lib/tier-helpers";
import { cookies } from "next/headers";

export default async function AccountPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const adminSupabase = createAdminClient();
    const [{ data: preferences }, { data: profile }, tierInfo] = await Promise.all([
        adminSupabase
            .from('email_preferences')
            .select('*')
            .eq('email', user.email)
            .single(),
        adminSupabase
            .from('profiles')
            .select('billing_interval')
            .eq('id', user.id)
            .single(),
        getUserTier(user.id),
    ]);

    const cookieStore = await cookies();
    const selectedWorkspaceId = cookieStore.get('selectedWorkspaceId')?.value;

    let ownedSelectedWorkspaceId: string | null = null;
    if (selectedWorkspaceId) {
        const { data: ws } = await adminSupabase
            .from('workspaces')
            .select('id')
            .eq('id', selectedWorkspaceId)
            .eq('owner_id', user.id)
            .maybeSingle();
        ownedSelectedWorkspaceId = ws?.id ?? null;
    }

    // Fetch usage counts in parallel
    const [workspaceCount, projectCount, memberCount, storageBytes] = await Promise.all([
        countUserWorkspaces(user.id),
        countUserProjects(user.id),
        ownedSelectedWorkspaceId ? countWorkspaceMembers(ownedSelectedWorkspaceId) : Promise.resolve(null),
        getStorageUsedBytes(user.id),
    ]);

    const billingInterval = (profile?.billing_interval as 'monthly' | 'yearly' | null) ?? null;

    const initialPreferences = {
        notify_new_feedback: preferences?.notify_new_feedback ?? true,
        notify_replies: preferences?.notify_replies ?? true,
        notify_project_created: preferences?.notify_project_created ?? true,
        notify_project_deleted: preferences?.notify_project_deleted ?? true,
        email_frequency: (preferences?.email_frequency as 'digest' | 'realtime') || 'digest',
    };

    const canUseRealtime = tierInfo.effectiveLimits.emailFrequencies.includes('realtime');

    const tierLabel = tierInfo.isTrialing
        ? 'Trial (Pro)'
        : tierInfo.tier
            ? tierInfo.tier.charAt(0).toUpperCase() + tierInfo.tier.slice(1)
            : 'No plan';
    const hasSubscription = !!tierInfo.tier;

    const limits = tierInfo.effectiveLimits;
    const usage = {
        workspaces: { used: workspaceCount, max: limits.maxWorkspaces },
        projects: { used: projectCount, max: limits.maxProjects },
        ...(memberCount !== null && { members: { used: memberCount, max: limits.maxTeamMembers } }),
        storage: { used: storageBytes, max: limits.storageBytes, usedLabel: formatBytes(storageBytes), maxLabel: formatBytes(limits.storageBytes) },
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Account
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full space-y-6">
                    {workspaceCount > 0 && (
                        <BillingCard
                            tierLabel={tierLabel}
                            hasSubscription={hasSubscription}
                            billingInterval={billingInterval}
                            usage={usage}
                        />
                    )}
                    <NotificationsCard initialPreferences={initialPreferences} canUseRealtime={canUseRealtime} />
                    <DeleteAccountCard />
                </div>
            </div>
        </div>
    );
}
