import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { NotificationsCard } from "@/components/NotificationsCard";
import { BillingCard } from "@/components/BillingCard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserTier, countUserWorkspaces, countUserProjects, getStorageUsedBytes, formatBytes } from "@/lib/tier-helpers";
import { stripe } from "@/lib/stripe";

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
            .select('stripe_subscription_id')
            .eq('id', user.id)
            .single(),
        getUserTier(user.id),
    ]);

    // Fetch usage counts in parallel
    const [workspaceCount, projectCount, storageBytes] = await Promise.all([
        countUserWorkspaces(user.id),
        countUserProjects(user.id),
        getStorageUsedBytes(user.id),
    ]);

    // Resolve billing interval from Stripe subscription
    let billingInterval: 'monthly' | 'yearly' | null = null;
    if (profile?.stripe_subscription_id) {
        try {
            const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
            const interval = subscription.items.data[0]?.price?.recurring?.interval;
            billingInterval = interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : null;
        } catch {
            // Subscription may have been deleted
        }
    }

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
                    <BillingCard
                        tierLabel={tierLabel}
                        hasSubscription={hasSubscription}
                        billingInterval={billingInterval}
                        usage={usage}
                    />
                    <NotificationsCard initialPreferences={initialPreferences} canUseRealtime={canUseRealtime} />
                    <DeleteAccountCard />
                </div>
            </div>
        </div>
    );
}
