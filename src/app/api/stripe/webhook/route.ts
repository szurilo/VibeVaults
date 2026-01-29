import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for webhook updates
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // You'll need to add this to .env.local
);

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

                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        subscription_status: 'active',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on checkout.session.completed:', error.message);
                } else {
                    console.log('✅ Webhook: Profile updated for user', userId);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = data.object as any;
                const customerId = subscription.customer;
                const status = subscription.status === 'active' ? 'active' : 'inactive';

                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: status,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on customer.subscription.updated:', error.message);
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
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on customer.subscription.deleted:', error.message);
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = data.object as any;
                const customerId = invoice.customer;

                // When an invoice is paid, ensure the subscription is marked as active
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'active',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('❌ Webhook: Failed to update profile on invoice.paid:', error.message);
                } else {
                    console.log('✅ Webhook: Subscription marked as active on invoice.paid for customer', customerId);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = data.object as any;
                const customerId = invoice.customer;

                // When a payment fails, we mark the subscription as inactive
                // This allows the UI to prompt the user to update their payment method
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
