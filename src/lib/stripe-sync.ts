/**
 * Main Responsibility: Idempotent profile sync from a Stripe Checkout Session.
 * Called by both the Stripe webhook (checkout.session.completed) and the
 * payment-success page as a fallback when webhook delivery is delayed or down.
 *
 * Sensitive Dependencies:
 * - SUPABASE_SECRET_KEY — bypasses RLS to write profile + workspace + email_preferences
 * - Stripe API (sessions.retrieve) — verifies payment_status before writing
 */

import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { getTierFromPriceId, getTierLimits, type TierSlug } from '@/lib/tier-config';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
);

export async function enforceTierLimitsOnChange(tier: TierSlug | null, customerId: string) {
    const limits = getTierLimits(tier);

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!profile) return;

    if (!limits.publicDashboard) {
        const { data: workspaces } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('owner_id', profile.id);

        if (workspaces && workspaces.length > 0) {
            const { error } = await supabaseAdmin
                .from('projects')
                .update({ is_sharing_enabled: false })
                .in('workspace_id', workspaces.map(w => w.id))
                .eq('is_sharing_enabled', true);

            if (error) {
                console.error('❌ Failed to disable sharing on downgrade:', error.message);
            }
        }
    }

    if (!limits.emailFrequencies.includes('realtime') && profile.email) {
        const { error } = await supabaseAdmin
            .from('email_preferences')
            .update({ email_frequency: 'digest' })
            .eq('email', profile.email)
            .eq('email_frequency', 'realtime');

        if (error) {
            console.error('❌ Failed to revert email frequency on downgrade:', error.message);
        }
    }
}

export type SyncResult =
    | { status: 'activated'; tier: string | null }
    | { status: 'already_active' }
    | { status: 'unpaid' }
    | { status: 'forbidden' }
    | { status: 'not_found' };

/**
 * Retrieve a Checkout Session from Stripe and mirror its state onto the
 * profile row. Idempotent — safe to call from both webhook and success page.
 *
 * If `expectedUserId` is provided, the session's metadata.userId must match
 * (prevents another user from activating a subscription via a leaked session_id).
 */
export async function syncProfileFromCheckoutSession(
    sessionId: string,
    expectedUserId?: string
): Promise<SyncResult> {
    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
        console.error('❌ stripe-sync: failed to retrieve session', sessionId, e);
        return { status: 'not_found' };
    }

    const userId = session.metadata?.userId;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const tier = session.metadata?.tier || null;

    if (!userId || !customerId) {
        return { status: 'not_found' };
    }

    if (expectedUserId && expectedUserId !== userId) {
        return { status: 'forbidden' };
    }

    if (session.payment_status !== 'paid') {
        return { status: 'unpaid' };
    }

    const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('subscription_status, stripe_subscription_id')
        .eq('id', userId)
        .single();

    if (existing?.subscription_status === 'active' && existing?.stripe_subscription_id === subscriptionId) {
        return { status: 'already_active' };
    }

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_tier: tier,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        console.error('❌ stripe-sync: failed to update profile', userId, error.message);
        return { status: 'not_found' };
    }

    await enforceTierLimitsOnChange(tier as TierSlug | null, customerId);
    return { status: 'activated', tier };
}

export { getTierFromPriceId };
