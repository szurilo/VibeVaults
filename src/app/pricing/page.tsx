import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { PricingCards } from '@/components/landing/pricing-cards';
import { CookiePreferencesLink } from '@/components/CookiePreferencesLink';
import { FEATURE_COMPARISON } from '@/lib/tier-config';

export const metadata = {
    title: 'Pricing — VibeVaults',
    description: 'Simple, transparent pricing for teams of all sizes. Start with a 14-day free trial.',
};

export default function PricingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-4 md:px-8 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
                    <Link href="/" className="font-bold text-xl md:text-2xl tracking-tight text-primary hover:opacity-90 transition-opacity">
                        VibeVaults
                    </Link>
                    <div className="flex gap-2 md:gap-4 items-center">
                        <Link href="/auth/login" className="text-sm font-semibold px-3 py-2 md:px-4 text-gray-700 hover:text-gray-900 transition-colors">
                            Sign In
                        </Link>
                        <Link href="/auth/register" className="inline-flex items-center justify-center px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero + Cards */}
                <section className="py-20 md:py-28">
                    <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
                        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-gray-900">
                            Simple, Transparent Pricing
                        </h1>
                        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-14">
                            Choose the plan that fits your team. All plans include a 14-day free trial with Pro features.
                        </p>
                        <PricingCards
                            ctaLabel="Get started now"
                            staticCtaHref="/auth/register"
                            showTrialNote={true}
                        />
                    </div>
                </section>

                {/* Feature comparison table */}
                <section id="comparison" className="py-20 bg-gray-50">
                    <div className="max-w-4xl mx-auto px-4 md:px-8">
                        <h2 className="text-3xl font-extrabold text-center mb-12 text-gray-900">
                            Full Feature Comparison
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b-2 border-gray-200">
                                        <th className="text-left py-4 px-4 font-semibold text-gray-500 uppercase text-xs tracking-wider">
                                            Feature
                                        </th>
                                        <th className="text-center py-4 px-4 font-semibold text-gray-900">
                                            Starter
                                        </th>
                                        <th className="text-center py-4 px-4 font-semibold text-[#209CEE]">
                                            Pro
                                        </th>
                                        <th className="text-center py-4 px-4 font-semibold text-gray-900">
                                            Business
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FEATURE_COMPARISON.map((feature, i) => (
                                        <tr key={i} className="border-b border-gray-100 last:border-b-0">
                                            <td className="py-4 px-4 text-gray-700 font-medium">
                                                {feature.label}
                                            </td>
                                            {(['starter', 'pro', 'business'] as const).map((tier) => {
                                                const value = feature[tier];
                                                return (
                                                    <td key={tier} className="text-center py-4 px-4">
                                                        {value === true ? (
                                                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                                                        ) : value === false ? (
                                                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                                                        ) : (
                                                            <span className="text-gray-700 font-medium">{value}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-20">
                    <div className="max-w-3xl mx-auto px-4 md:px-8">
                        <h2 className="text-3xl font-extrabold text-center mb-12 text-gray-900">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-8">
                            {[
                                {
                                    q: 'What happens during the 14-day trial?',
                                    a: 'You get full access to Pro features for 14 days — no credit card required. At the end of your trial, choose the plan that fits your team.',
                                },
                                {
                                    q: 'What happens when I upgrade during an already paid subscription?',
                                    a: 'We charge the new price only for the remaining time in your current billing period. You get immediate access to the higher tier — no double-charging.',
                                },
                                {
                                    q: 'What happens when I downgrade? Will I lose access to my current tier?',
                                    a: 'No — you keep full access to your current tier until the end of your billing cycle. The downgrade takes effect on your next renewal, and your existing data is always preserved.',
                                },
                                {
                                    q: 'What payment methods do you accept?',
                                    a: 'We accept all major credit cards through Stripe. For annual billing, you save 20% compared to monthly pricing.',
                                },
                                {
                                    q: 'Is there a free plan?',
                                    a: 'We don\'t offer a free plan, but every account starts with a 14-day free trial with full Pro features so you can evaluate VibeVaults risk-free.',
                                },
                            ].map((faq, i) => (
                                <div key={i}>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                                    <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-8 w-full border-t border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} VibeVaults. All rights reserved.
                    </div>
                    <div className="flex gap-6 text-sm font-medium text-gray-600">
                        <Link href="/terms-of-service" className="hover:text-primary transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                            Privacy Policy
                        </Link>
                        <CookiePreferencesLink />
                    </div>
                </div>
            </footer>
        </div>
    );
}
