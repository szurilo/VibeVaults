-- Cache the Stripe subscription billing interval ('monthly' | 'yearly') on the
-- profile so the account page doesn't have to round-trip Stripe on every render.
-- Webhook handlers (customer.subscription.{updated,deleted}, invoice.paid,
-- subscription_schedule.completed, checkout.session.completed via stripe-sync)
-- keep this in sync. NULL means trial/no subscription.

ALTER TABLE public.profiles
    ADD COLUMN billing_interval text
        CHECK (billing_interval IN ('monthly', 'yearly'));
