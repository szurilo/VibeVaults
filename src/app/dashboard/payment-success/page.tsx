/**
 * Main Responsibility: Landing page after Stripe Checkout redirect. Runs a
 * server-side sync against the Checkout Session so the subscription activates
 * even when the Stripe webhook is delayed or down. Falls back to client polling
 * if the server sync can't finalize (e.g. Stripe API unreachable at that moment).
 *
 * Sensitive Dependencies:
 * - session_id URL param (verified against logged-in user's metadata.userId in sync)
 * - syncProfileFromCheckoutSession — idempotent with the Stripe webhook
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncProfileFromCheckoutSession } from '@/lib/stripe-sync';
import PaymentSuccessClient from './PaymentSuccessClient';

export default async function PaymentSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }>;
}) {
    const { session_id } = await searchParams;

    if (!session_id) {
        redirect('/dashboard');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/auth/login');
    }

    const result = await syncProfileFromCheckoutSession(session_id, user.id);

    // If the sync confirmed payment (or the webhook already did), no need to poll —
    // render the client in its 'success' state so it briefly confirms then redirects.
    const initialStatus =
        result.status === 'activated' || result.status === 'already_active'
            ? 'success'
            : 'loading';

    return <PaymentSuccessClient initialStatus={initialStatus} />;
}
