import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { allComparisons } from "@/lib/compare-data";

export const metadata: Metadata = {
    title: "Compare VibeVaults to Other Feedback Tools",
    description:
        "Honest, up-to-date comparisons of VibeVaults against popular visual feedback and bug reporting tools for agencies, including BugHerd and Marker.io.",
    alternates: { canonical: "/compare" },
};

export default function CompareHubPage() {
    return (
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-24">
            <div className="text-center mb-16">
                <span className="inline-block text-sm font-bold uppercase tracking-wider text-primary mb-4">
                    Comparisons
                </span>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900">
                    How VibeVaults compares
                </h1>
                <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                    Honest, up-to-date comparisons against the tools agencies actually evaluate. We name where the other
                    tool wins, too.
                </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                {allComparisons.map((c) => (
                    <Link
                        key={c.slug}
                        href={`/compare/${c.slug}`}
                        className="group rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    >
                        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                            VibeVaults vs {c.competitorName}
                            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </h2>
                        <p className="text-gray-500 leading-relaxed">{c.hubBlurb}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
