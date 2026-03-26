'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { TIER_DISPLAY, type TierSlug, type BillingInterval } from '@/lib/tier-config';

/** Pre-resolved price ID map, keyed by tier and interval. Pass this from a server
 *  component so the client never reads process.env directly. */
export type PriceIdMap = Record<TierSlug, Record<BillingInterval, string>>;

interface PricingCardsProps {
    defaultInterval?: BillingInterval;
    ctaLabel?: string;
    /** If set, all CTA buttons link to this static URL (e.g. '/auth/register').
     *  If omitted, buttons link to Stripe checkout with the appropriate priceId. */
    staticCtaHref?: string;
    showTrialNote?: boolean;
    currentTier?: TierSlug | null;
    /** Server-resolved Stripe price IDs. Required when staticCtaHref is not set. */
    priceIds?: PriceIdMap;
}

export function PricingCards({
    defaultInterval = 'monthly',
    ctaLabel = 'Get started now',
    staticCtaHref,
    showTrialNote = false,
    currentTier,
    priceIds,
}: PricingCardsProps) {
    const [interval, setInterval] = useState<BillingInterval>(defaultInterval);

    const getHref = (tier: TierSlug, int: BillingInterval) => {
        if (staticCtaHref) return staticCtaHref;
        const priceId = priceIds?.[tier]?.[int] ?? '';
        return `/api/stripe/checkout?priceId=${priceId}`;
    };

    return (
        <div className="w-full">
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-12">
                <button
                    onClick={() => setInterval('monthly')}
                    className={`cursor-pointer px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                        interval === 'monthly'
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setInterval('yearly')}
                    className={`cursor-pointer px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                        interval === 'yearly'
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Yearly
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        Save 20%
                    </span>
                </button>
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {TIER_DISPLAY.map((tier) => {
                    const isHighlighted = tier.highlighted;
                    const isCurrent = currentTier === tier.slug;
                    const price = interval === 'monthly' ? tier.monthlyPrice : tier.yearlyPricePerMonth;

                    return (
                        <motion.div
                            key={tier.slug}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: tier.slug === 'starter' ? 0 : tier.slug === 'pro' ? 0.1 : 0.2 }}
                            className={`relative p-8 rounded-2xl border-2 transition-all duration-300 ${
                                isHighlighted
                                    ? 'border-[#209CEE] shadow-xl bg-white scale-[1.02]'
                                    : 'border-gray-200 shadow-sm bg-white hover:shadow-lg hover:border-gray-300'
                            }`}
                        >
                            {/* Badge */}
                            {isHighlighted && !isCurrent && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#209CEE] text-white px-5 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg">
                                    Recommended
                                </div>
                            )}
                            {isCurrent && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-5 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg">
                                    Current Plan
                                </div>
                            )}

                            {/* Tier name & tagline */}
                            <h3 className="text-xl font-bold text-gray-900 text-left">{tier.name}</h3>
                            <p className="text-sm text-gray-500 mt-1 text-left">{tier.tagline}</p>

                            {/* Price */}
                            <div className="mt-6 mb-8 text-left">
                                <span className="text-4xl font-extrabold text-gray-900">${price}</span>
                                <span className="text-gray-400 text-base font-normal">/mo</span>
                                {interval === 'yearly' && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        ${tier.yearlyTotal}/yr billed annually
                                    </p>
                                )}
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-8 text-left">
                                {tier.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            {isCurrent ? (
                                <div className="w-full py-3 px-6 rounded-xl bg-gray-100 text-gray-500 font-semibold text-center text-sm">
                                    Current Plan
                                </div>
                            ) : (
                                <a
                                    href={getHref(tier.slug, interval)}
                                    className={`block w-full py-3 px-6 rounded-xl font-semibold text-center text-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                                        isHighlighted
                                            ? 'bg-[#209CEE] text-white hover:bg-[#209CEE]/90'
                                            : 'bg-gray-900 text-white hover:bg-gray-800'
                                    }`}
                                >
                                    {ctaLabel}
                                </a>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Trial note */}
            {showTrialNote && (
                <p className="text-center text-xs text-gray-400 mt-8 uppercase tracking-wide font-semibold">
                    14-day free trial &middot; No credit card required
                </p>
            )}
        </div>
    );
}
