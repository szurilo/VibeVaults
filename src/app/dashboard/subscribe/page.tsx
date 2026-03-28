/**
 * Main Responsibility: Subscribe/upgrade page shown in three contexts:
 * 1. Trial expired → urgency messaging to pick a plan
 * 2. Trial active → "Choose your plan" with remaining trial days
 * 3. Active subscriber (Starter) → "Upgrade your plan" with current plan badge
 *
 * Sensitive Dependencies:
 * - tier-helpers.ts for user tier resolution
 * - supabase/server.ts for auth + profile data
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PricingCards } from '@/components/landing/PricingCards';
import { getUserTier } from '@/lib/tier-helpers';
import { STRIPE_PRICES } from '@/lib/tier-config';

export default async function SubscribePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    const tierInfo = await getUserTier(user.id);

    // Fetch trial_ends_at for remaining days calculation
    const { data: profile } = await supabase
        .from('profiles')
        .select('trial_ends_at')
        .eq('id', user.id)
        .single();

    // Determine page context
    const isTrialExpired = !tierInfo.isTrialing && !tierInfo.tier;
    const isTrialActive = tierInfo.isTrialing;
    const isSubscribed = !!tierInfo.tier;

    // Calculate remaining trial days
    let trialDaysLeft = 0;
    if (isTrialActive && profile?.trial_ends_at) {
        trialDaysLeft = Math.max(0, Math.ceil(
            (new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ));
    }

    // Pick heading and description based on context
    let heading: string;
    let description: string;

    if (isTrialExpired) {
        heading = 'Your trial has expired';
        description = 'Your 14-day free trial has ended. Choose a plan to continue using VibeVaults and keep collaborating on your projects.';
    } else if (isTrialActive) {
        heading = 'Choose your plan';
        description = `You have ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your free trial. Pick a plan to continue seamlessly when your trial ends.`;
    } else {
        heading = 'Upgrade your plan';
        description = 'Unlock more workspaces, projects, team members, and storage by upgrading to a higher tier.';
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{heading}</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    {description}
                </p>
            </div>

            {/* Pricing cards — Pro pre-selected via highlighted flag in tier-config */}
            <div className="w-full max-w-5xl">
                <PricingCards
                    ctaLabel={isSubscribed ? 'Upgrade' : 'Subscribe'}
                    currentTier={tierInfo.tier}
                    priceIds={STRIPE_PRICES}
                />
                <div className="text-center mt-8">
                    <Link
                        href="/pricing#comparison"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
                    >
                        Compare all features
                        <span aria-hidden="true">&rarr;</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
