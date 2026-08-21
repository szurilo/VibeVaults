/**
 * Main Responsibility: Docs index — the landing page for /docs, listing every
 * documentation page with its summary.
 * Sensitive Dependencies: page list comes from lib/docs-data.ts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsPages } from "@/lib/docs-data";

export const metadata: Metadata = {
    title: "Documentation",
    description:
        "How VibeVaults works: embedding the feedback widget, invite-only client access, screenshots, what the widget records, roles and sharing, and troubleshooting.",
};

export default function DocsIndex() {
    return (
        <>
            <header className="mb-10">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Documentation</p>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">VibeVaults documentation</h1>
                <p className="text-lg text-gray-500 leading-relaxed">
                    Everything about running client feedback rounds with VibeVaults: getting the widget on a site, giving
                    the right people access, and understanding what gets captured along the way.
                </p>
            </header>

            <div className="grid gap-4">
                {docsPages.map((page) => (
                    <Link
                        key={page.slug}
                        href={`/docs/${page.slug}`}
                        className="group flex items-center justify-between gap-4 p-6 rounded-2xl border border-gray-200 bg-white hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    >
                        <div className="min-w-0">
                            <h2 className="font-bold text-gray-900 group-hover:text-primary transition-colors mb-1">
                                {page.title}
                            </h2>
                            <p className="text-sm text-gray-500 leading-relaxed">{page.summary}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                    </Link>
                ))}
            </div>

            <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200">
                <h2 className="font-bold text-gray-900 mb-2">Cannot find an answer?</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                    Email{" "}
                    <a href="mailto:support@vibe-vaults.com" className="text-primary underline hover:opacity-80 transition-opacity">
                        support@vibe-vaults.com
                    </a>
                    . Questions that come up twice end up on these pages.
                </p>
            </div>
        </>
    );
}
