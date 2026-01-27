import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }

        // Check if user already has a Stripe Customer ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
            // Create a new Stripe customer
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabaseUUID: user.id,
                },
            });
            customerId = customer.id;

            // Save the customer ID to the profile
            await supabase
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', user.id);
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${new URL(request.url).origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${new URL(request.url).origin}/dashboard`,
            metadata: {
                userId: user.id,
            },
        });

        if (!session.url) {
            throw new Error('Failed to create stripe session');
        }

        return NextResponse.redirect(session.url, 303);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
