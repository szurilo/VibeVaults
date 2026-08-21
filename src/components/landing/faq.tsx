"use client";

/**
 * Main Responsibility: Landing page FAQ section with accordion UI and
 * FAQPage JSON-LD structured data for SEO/GEO. Answers stay mounted in the
 * DOM when collapsed (height-animated, not unmounted) so crawlers always
 * see the full text in the server-rendered HTML.
 * Sensitive Dependencies: Answer copy must stay in sync with pricing
 * ($29/$49/$149, 14-day trial) and the JSON-LD below must mirror the
 * visible Q&A text exactly per Google's structured data guidelines.
 */

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * `link` makes one substring of the answer clickable. The JSON-LD below still
 * uses the raw `answer` string, so the structured data mirrors the visible text
 * exactly, as Google requires.
 */
const faqs: { question: string; answer: string; link?: { match: string; href: string } }[] = [
    {
        question: "What is VibeVaults?",
        answer: "VibeVaults is a visual feedback widget for websites. It lets your clients click on any part of a live website and leave feedback exactly where it belongs, with a screenshot and technical details captured automatically. Agencies use it to replace scattered email threads, vague screenshots, and endless revision calls with one clear feedback stream.",
    },
    {
        question: "Who is VibeVaults for?",
        answer: "VibeVaults is built for web agencies, dev studios, and freelancers who build websites for clients. If you run feedback rounds with clients on live sites, VibeVaults is designed for you. It is not a survey tool or a bug tracker for end users; it is a client collaboration tool for the people who build and review websites.",
    },
    {
        question: "Does VibeVaults work on all websites?",
        answer: "Yes. VibeVaults works on any website where you can add a single script tag, including WordPress, Webflow, Shopify, React, and plain HTML sites. There are no plugins to maintain and no browser extensions for anyone to install.",
    },
    {
        question: "How easy is it to set up?",
        answer: "Setup takes minutes. You create a project in your dashboard, paste one script tag into the website's code, and invite your clients by email. They click the link in the invite and can start leaving feedback right away.",
    },
    {
        question: "Do clients need an account?",
        answer: "No. Clients never create an account, set a password, or install anything. They open the invite link you send them and the feedback widget appears on the site. You also never pay per client: every plan includes unlimited clients and unlimited feedback.",
    },
    {
        question: "How much does VibeVaults cost?",
        answer: "VibeVaults starts at $29/month for the Starter plan, $49/month for Pro, and $149/month for Business. Yearly billing saves 20%. Every plan starts with a 14-day free trial, no credit card required. There is no free tier, and there are never per-client or per-feedback fees.",
    },
    {
        question: "What does the widget collect from my client's site?",
        answer: "With each report the widget attaches the page URL, browser and screen details, a screenshot, the last 50 console log entries, and any failed network requests, so a bug arrives with the context a developer needs. Query strings are stripped from recorded request URLs before anything leaves the browser, because they often carry access tokens and email addresses. The widget never records keystrokes, form contents, request bodies, or a session replay. The full detail is documented at vibe-vaults.com/docs/widget-data.",
        link: { match: "vibe-vaults.com/docs/widget-data", href: "/docs/widget-data" },
    },
    {
        question: "Can I integrate VibeVaults with my project management tools?",
        answer: "Not yet. Today, all feedback lives in the VibeVaults dashboard, where your whole team can view, discuss, and resolve it. Direct integrations with project management tools are on our roadmap. As a founding member you can tell us which integration to build first.",
    },
];

/**
 * Renders an answer, turning `link.match` into an internal link when present.
 * Splits on the literal substring so the surrounding copy — and therefore the
 * JSON-LD text — stays byte-identical to what a reader sees.
 */
function renderAnswer(faq: (typeof faqs)[number]) {
    if (!faq.link) return faq.answer;
    const [before, ...rest] = faq.answer.split(faq.link.match);
    if (rest.length === 0) return faq.answer;
    return (
        <>
            {before}
            <Link href={faq.link.href} className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity">
                {faq.link.match}
            </Link>
            {rest.join(faq.link.match)}
        </>
    );
}

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
        },
    })),
};

export const Faq = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-24 md:py-32 w-full bg-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="max-w-3xl mx-auto px-4 md:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
                        Frequently asked questions
                    </h2>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                        Everything you need to know about collecting visual feedback with VibeVaults.
                    </p>
                </motion.div>

                <div className="flex flex-col gap-4">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <motion.div
                                key={faq.question}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className={`rounded-2xl border-2 bg-white transition-colors duration-300 ${
                                    isOpen
                                        ? "border-primary/30 shadow-lg shadow-primary/5"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                    aria-expanded={isOpen}
                                    className="cursor-pointer w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                                >
                                    <h3 className="text-base md:text-lg font-bold text-gray-900">
                                        {faq.question}
                                    </h3>
                                    <ChevronDown
                                        className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${
                                            isOpen ? "rotate-180 text-primary" : ""
                                        }`}
                                    />
                                </button>
                                <motion.div
                                    initial={false}
                                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <p className="px-6 pb-6 text-gray-500 leading-relaxed">
                                        {renderAnswer(faq)}
                                    </p>
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
