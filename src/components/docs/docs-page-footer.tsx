/**
 * Main Responsibility: Bottom-of-page block for every /docs page — a "next
 * page" link derived from the ordered page list, plus the support contact.
 * Keeps the closing section identical across pages instead of each page
 * repeating its own.
 * Sensitive Dependencies: ordering comes from lib/docs-data.ts.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsPages } from "@/lib/docs-data";

export function DocsPageFooter({ slug }: { slug: string }) {
    const index = docsPages.findIndex((p) => p.slug === slug);
    const next = index >= 0 ? docsPages[index + 1] : undefined;

    return (
        <div className="mt-16 pt-8 border-t border-gray-100 space-y-6">
            {next && (
                <Link
                    href={`/docs/${next.slug}`}
                    className="group flex items-center justify-between gap-4 p-5 rounded-2xl border border-gray-200 hover:border-primary/40 hover:shadow-md transition-all duration-300 bg-white"
                >
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Next</div>
                        <div className="font-bold text-gray-900 group-hover:text-primary transition-colors">{next.title}</div>
                        <div className="text-sm text-gray-500 truncate">{next.summary}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
            )}
            <p className="text-sm text-gray-500">
                Something missing from this page? Email{" "}
                <a href="mailto:support@vibe-vaults.com" className="text-primary underline hover:opacity-80 transition-opacity">
                    support@vibe-vaults.com
                </a>{" "}
                and we will add it.
            </p>
        </div>
    );
}
