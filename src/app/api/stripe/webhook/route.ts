import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { getTierFromPriceId, type TierSlug } from '@/lib/tier-config';
import { enforceTierLimitsOnChange, syncProfileFromCheckoutSession } from '@/lib/stripe-sync';

// Use secret key to bypass RLS for webhook updates
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
);

/**
 * Resolve the tier slug from a Stripe subscription object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveTierFromSubscription(subscription: any): string | null {
    const priceId = subscription?.items?.data?.[0]?.price?.id;
    if (!priceId) return null;
    return getTierFromPriceId(priceId);
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') as string;

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Webhook signature verification failed: ${msg}`);
        return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
    }

    const { type, data } = event;

    try {
        switch (type) {
            case 'checkout.session.completed': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const session = data.object as any;
                const result = await syncProfileFromCheckoutSession(session.id);
                console.log('Webhook: checkout.session.completed sync →', result);
                break;
            }

            case 'customer.subscription.updated': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const subscription = data.object as any;
                const customerId = subscription.customer;
                // 'active' = normal active subscription (including cancel_at_period_end)
                // 'past_due' = payment failed but Stripe is retrying — keep access during grace period
                const status = (subscription.status === 'active' || subscription.status === 'past_due')
                    ? 'active' : 'inactive';
                const tier = resolveTierFromSubscription(subscription);

                const updateData: Record<string, string | null> = {
                    subscription_status: status,
                    updated_at: new Date().toISOString(),
                };
                if (tier) {
                    updateData.subscription_tier = tier;
                }

                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update(updateData)
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on customer.subscription.updated:', error.message);
                } else if (tier) {
                    await enforceTierLimitsOnChange(tier as TierSlug, customerId);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const subscription = data.object as any;
                const customerId = subscription.customer;

                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'inactive',
                        stripe_subscription_id: null,
                        subscription_tier: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on customer.subscription.deleted:', error.message);
                } else {
                    await enforceTierLimitsOnChange(null, customerId);
                }
                break;
            }

            case 'invoice.paid': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = data.object as any;
                const customerId = invoice.customer;

                // Resolve tier from the subscription associated with this invoice
                let tier: string | null = null;
                if (invoice.subscription) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
                        tier = resolveTierFromSubscription(subscription);
                    } catch (e) {
                        console.error('❌ Webhook: Failed to retrieve subscription for invoice.paid:', e);
                    }
                }

                const updateData: Record<string, string | null> = {
                    subscription_status: 'active',
                    updated_at: new Date().toISOString(),
                };
                if (tier) {
                    updateData.subscription_tier = tier;
                }

                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update(updateData)
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on invoice.paid:', error.message);
                } else {
                    console.log('✅ Webhook: Subscription marked as active on invoice.paid for customer', customerId);
                }
                break;
            }

            case 'subscription_schedule.completed': {
                // Fired when a scheduled plan change (e.g. end-of-period downgrade) takes effect.
                // The actual tier update is handled by customer.subscription.updated which fires
                // at the same time, but we log this for visibility.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const schedule = data.object as any;
                const subscriptionId = schedule.subscription;
                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const tier = resolveTierFromSubscription(subscription);
                        const customerId = subscription.customer as string;

                        const updateData: Record<string, string | null> = {
                            subscription_status: subscription.status === 'active' ? 'active' : 'inactive',
                            updated_at: new Date().toISOString(),
                        };
                        if (tier) {
                            updateData.subscription_tier = tier;
                        }

                        await supabaseAdmin
                            .from('profiles')
                            .update(updateData)
                            .eq('stripe_customer_id', customerId);

                        console.log('✅ Webhook: Subscription schedule completed — tier updated to', tier, 'for customer', customerId);
                    } catch (e) {
                        console.error('❌ Webhook: Failed to process subscription_schedule.completed:', e);
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = data.object as any;
                const customerId = invoice.customer;

                // Don't clear subscription_tier — user still has a plan, just payment failed
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'inactive',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on invoice.payment_failed:', error.message);
                } else {
                    console.log('⚠️ Webhook: Subscription marked as inactive on invoice.payment_failed for customer', customerId);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error(`Error processing webhook ${type}:`, error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
