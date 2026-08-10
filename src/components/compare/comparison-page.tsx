/**
 * Main Responsibility: Renders a data-driven "VibeVaults vs <competitor>"
 * comparison page (hero, self-select, visual proof, feature table, honest
 * concessions, wins, pricing, honest social-proof, FAQ + JSON-LD, CTA).
 * Server component so all copy is in the server-rendered HTML for SEO.
 * Sensitive Dependencies: consumes ComparisonData from lib/compare-data.ts;
 * reuses PricingCards (client) and the /screenshots assets. The social-proof
 * block is an honest, unattributed paraphrase, do not swap in fabricated or
 * unpermitted quotes.
 */

import Image from "next/image";
import Link from "next/link";
import { Check, X, ChevronDown, Maximize2 } from "lucide-react";
import { PricingCards } from "@/components/landing/pricing-cards";
import { ZoomableImage } from "@/components/zoomable-image";
import type { ComparisonData, CompareValue } from "@/lib/compare-data";

function Cell({ value }: { value: CompareValue }) {
    if (value === true) return <Check className="w-5 h-5 text-green-500 mx-auto" aria-label="Yes" />;
    if (value === false) return <X className="w-5 h-5 text-gray-300 mx-auto" aria-label="No" />;
    return <span className="text-sm text-gray-700">{value}</span>;
}

export function ComparisonPage({ data }: { data: ComparisonData }) {
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: data.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

            {/* Hero */}
            <section className="max-w-4xl mx-auto px-4 md:px-8 pt-20 pb-16 text-center">
                <span className="inline-block text-sm font-bold uppercase tracking-wider text-primary mb-4">
                    {data.heroKicker}
                </span>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900">
                    {data.heroTitle}
                </h1>
                <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto mb-10 leading-relaxed">
                    {data.heroSubtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/auth/register"
                        className="inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-base transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Start your 14-day trial
                    </Link>
                    <Link
                        href="#compare"
                        className="inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-base transition-all duration-300 border-2 border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                    >
                        See the comparison
                    </Link>
                </div>
            </section>

            {/* Which is right for you (honest self-select) */}
            <section className="max-w-5xl mx-auto px-4 md:px-8 py-8">
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border-2 border-primary/30 bg-white p-8 shadow-lg shadow-primary/5">
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Choose VibeVaults if…</h2>
                        <p className="text-gray-500 leading-relaxed">{data.tldrVibe}</p>
                    </div>
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Choose {data.competitorName} if…</h2>
                        <p className="text-gray-500 leading-relaxed">{data.tldrCompetitor}</p>
                    </div>
                </div>
            </section>

            {/* Visual proof (show, don't tell) */}
            <section id="proof" className="bg-gray-50 py-20 mt-8">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">See it, don&apos;t take our word for it</h2>
                        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                            The whole pitch is simplicity, so here is exactly what your clients and your team see.
                        </p>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-10 items-start">
                        <figure>
                            <ZoomableImage
                                src="/screenshots/feature-widget.png"
                                alt="The VibeVaults feedback widget open on a live webshop, with a screenshot attached and a feedback message"
                                className="group relative block w-full rounded-xl overflow-hidden border border-gray-200 shadow-2xl cursor-zoom-in"
                            >
                                <Image
                                    src="/screenshots/feature-widget.png"
                                    alt="The VibeVaults feedback widget open on a live webshop, with a screenshot attached and a feedback message"
                                    width={994}
                                    height={680}
                                    className="block w-full h-auto"
                                />
                                <span className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm">
                                    <Maximize2 className="w-4 h-4" />
                                </span>
                            </ZoomableImage>
                            <figcaption className="mt-4 text-center text-sm text-gray-500 leading-relaxed">
                                What your client sees: they tag the problem on the live site, and a screenshot, browser
                                context, and console logs attach automatically. No account, no extension.
                            </figcaption>
                        </figure>
                        <figure>
                            <ZoomableImage
                                src="/screenshots/feature-team.png"
                                alt="The VibeVaults dashboard showing workspace users, role-based access, and a real-time reply notification"
                                className="group relative block w-full rounded-xl overflow-hidden border border-gray-200 shadow-2xl cursor-zoom-in"
                            >
                                <Image
                                    src="/screenshots/feature-team.png"
                                    alt="The VibeVaults dashboard showing workspace users, role-based access, and a real-time reply notification"
                                    width={1520}
                                    height={700}
                                    className="block w-full h-auto"
                                />
                                <span className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm">
                                    <Maximize2 className="w-4 h-4" />
                                </span>
                            </ZoomableImage>
                            <figcaption className="mt-4 text-center text-sm text-gray-500 leading-relaxed">
                                What your team sees: every project, role-based access for members and clients, and
                                real-time replies in one dashboard.
                            </figcaption>
                        </figure>
                    </div>
                </div>
            </section>

            {/* Comparison table */}
            <section id="compare" className="max-w-5xl mx-auto px-4 md:px-8 py-20 scroll-mt-24">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-4">VibeVaults vs {data.competitorName}</h2>
                    <p className="text-gray-500 max-w-2xl mx-auto">
                        An honest, feature-by-feature comparison. Competitor pricing and features verified August 2026.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[560px]">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-4 pr-4 text-sm font-bold text-gray-900">Feature</th>
                                <th className="py-4 px-4 text-center text-sm font-bold text-primary">VibeVaults</th>
                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">{data.competitorName}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((row) => (
                                <tr key={row.label} className="border-t border-gray-100">
                                    <td className="py-4 pr-4 text-sm font-medium text-gray-700">{row.label}</td>
                                    <td className="py-4 px-4 text-center bg-primary/5">
                                        <Cell value={row.vibevaults} />
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <Cell value={row.competitor} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Where the competitor wins (honest concession) */}
            <section className="bg-gray-50 py-20">
                <div className="max-w-3xl mx-auto px-4 md:px-8">
                    <h2 className="text-2xl md:text-3xl font-extrabold mb-3">
                        Where {data.competitorName} is the better choice
                    </h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        We would rather be honest than oversell. {data.competitorName} genuinely wins on these, and if
                        you need them, use it.
                    </p>
                    <ul className="space-y-4">
                        {data.competitorWins.map((win) => (
                            <li key={win} className="flex gap-3">
                                <Check className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                                <span className="text-gray-600 leading-relaxed">{win}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Where VibeVaults wins */}
            <section className="max-w-6xl mx-auto px-4 md:px-8 py-20">
                <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-12">Where VibeVaults wins</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    {data.vibevaultsWins.map((win) => (
                        <div
                            key={win.title}
                            className="rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{win.title}</h3>
                            <p className="text-gray-500 leading-relaxed">{win.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Honest social proof (no fabricated/attributed quotes) */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-3xl mx-auto px-4 md:px-8 text-center">
                    {/* TODO(jozsef): replace with real, named, permission-granted testimonials
                        once founding customers agree to be quoted. Never invent quotes. */}
                    <p className="text-lg text-gray-600 leading-relaxed">
                        We are early, and we will not fake reviews. Honestly: the reaction we hear most on demo calls is
                        how clean the interface feels, and that it is live on a real site in about 30 seconds. Named
                        customer stories are coming as our founding cohort goes live.
                    </p>
                </div>
            </section>

            {/* Pricing */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Simple pricing, unlimited clients</h2>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                        Every plan includes unlimited clients and unlimited feedback. No per-seat client fees, ever.
                    </p>
                </div>
                <PricingCards ctaLabel="Start your 14-day trial" staticCtaHref="/auth/register" showTrialNote />
            </section>

            {/* FAQ (native details for zero-JS, crawlable SSR) */}
            <section className="max-w-3xl mx-auto px-4 md:px-8 py-20">
                <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-12">
                    {data.competitorName} alternative FAQ
                </h2>
                <div className="flex flex-col gap-4">
                    {data.faqs.map((faq) => (
                        <details
                            key={faq.question}
                            className="group rounded-2xl border-2 border-gray-200 bg-white open:border-primary/30 open:shadow-lg open:shadow-primary/5 transition-colors"
                        >
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 px-6 py-5 text-base md:text-lg font-bold text-gray-900">
                                {faq.question}
                                <ChevronDown className="w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 group-open:rotate-180 group-open:text-primary" />
                            </summary>
                            <p className="px-6 pb-6 text-gray-500 leading-relaxed">{faq.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section className="bg-linear-to-r from-primary to-secondary py-20">
                <div className="max-w-3xl mx-auto px-4 md:px-8 text-center text-white">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-4">See if VibeVaults fits your feedback rounds</h2>
                    <p className="text-lg text-white/90 mb-8">
                        14-day free trial. No credit card. Unlimited clients on every plan.
                    </p>
                    <Link
                        href="/auth/register"
                        className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg bg-white text-primary hover:-translate-y-1 transition-all duration-300 shadow-2xl"
                    >
                        Start your free trial
                    </Link>
                </div>
            </section>
        </>
    );
}
