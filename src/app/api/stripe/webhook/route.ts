import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { getTierFromPriceId, getTierLimits, type TierSlug } from '@/lib/tier-config';

// Use secret key to bypass RLS for webhook updates
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
);

/**
 * Resolve the tier slug from a Stripe subscription object.
 */
function resolveTierFromSubscription(subscription: any): string | null {
    const priceId = subscription?.items?.data?.[0]?.price?.id;
    if (!priceId) return null;
    return getTierFromPriceId(priceId);
}

/**
 * When a user downgrades, enforce tier-gated features:
 * - Disable public dashboard sharing if not allowed on new tier
 * - Revert email frequency to 'digest' if realtime not allowed on new tier
 */
async function enforceTierLimitsOnChange(tier: TierSlug | null, customerId: string) {
    const limits = getTierLimits(tier);

    // Find the user by stripe_customer_id
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!profile) return;

    // Disable sharing if tier doesn't support it
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
                console.error('❌ Webhook: Failed to disable sharing on downgrade:', error.message);
            } else {
                console.log('✅ Webhook: Disabled public sharing for downgraded user', profile.id);
            }
        }
    }

    // Revert email frequency to digest if realtime not allowed
    if (!limits.emailFrequencies.includes('realtime') && profile.email) {
        const { error } = await supabaseAdmin
            .from('email_preferences')
            .update({ email_frequency: 'digest' })
            .eq('email', profile.email)
            .eq('email_frequency', 'realtime');

        if (error) {
            console.error('❌ Webhook: Failed to revert email frequency on downgrade:', error.message);
        } else {
            console.log('✅ Webhook: Reverted email frequency to digest for', profile.email);
        }
    }
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
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    const { type, data } = event;

    try {
        switch (type) {
            case 'checkout.session.completed': {
                const session = data.object as any;
                const userId = session.metadata.userId;
                const customerId = session.customer;
                const subscriptionId = session.subscription;
                const tier = session.metadata.tier || null;

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
                    console.error('❌ Webhook: Failed to update profile on checkout.session.completed:', error.message);
                } else {
                    console.log('✅ Webhook: Profile updated for user', userId, `(tier: ${tier})`);
                    await enforceTierLimitsOnChange(tier as TierSlug | null, customerId);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = data.object as any;
                const customerId = subscription.customer;
                const status = subscription.status === 'active' ? 'active' : 'inactive';
                const tier = resolveTierFromSubscription(subscription);

                const updateData: Record<string, any> = {
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

                const updateData: Record<string, any> = {
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
                const schedule = data.object as any;
                const subscriptionId = schedule.subscription;
                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const tier = resolveTierFromSubscription(subscription);
                        const customerId = subscription.customer as string;

                        const updateData: Record<string, any> = {
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
    } catch (error: any) {
        console.error(`Error processing webhook ${type}:`, error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
