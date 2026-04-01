import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2025-12-15.clover' as any, // Use the latest API version
  appInfo: {
    name: 'VibeVaults',
    version: '0.1.0',
  },
});
