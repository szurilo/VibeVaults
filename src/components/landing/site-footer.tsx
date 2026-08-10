import Link from "next/link";
import { LinkedinIcon } from "@/components/icons/linkedin-icon";
import { CookiePreferencesLink } from "@/components/CookiePreferencesLink";
import { allComparisons } from "@/lib/compare-data";

/**
 * Main Responsibility: Shared site footer used by the landing page and the
 * /compare marketing pages. Includes a Compare section that links the hub and
 * every comparison page for internal linking / SEO discovery.
 * Sensitive Dependencies: CookiePreferencesLink is a client component; the
 * comparison links are derived from allComparisons (lib/compare-data.ts) so new
 * comparisons appear automatically.
 */
export function SiteFooter() {
    return (
        <footer className="py-8 w-full border-t border-gray-100 bg-white">
            <div className="max-w-7xl mx-auto px-8">
                {/* Compare section */}
                <div className="pb-8 mb-6 border-b border-gray-100 text-center">
                    <Link
                        href="/compare"
                        className="inline-block text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-primary transition-colors mb-3"
                    >
                        Compare
                    </Link>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        {allComparisons.map((c) => (
                            <Link
                                key={c.slug}
                                href={`/compare/${c.slug}`}
                                className="text-sm text-gray-500 hover:text-primary transition-colors"
                            >
                                VibeVaults vs {c.competitorName}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Legal / social row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} VibeVaults. All rights reserved.
                    </div>
                    <div className="flex gap-6 text-sm font-medium text-gray-600 items-center">
                        <Link href="/terms-of-service" className="hover:text-primary transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                            Privacy Policy
                        </Link>
                        <CookiePreferencesLink />
                        <a
                            href="https://www.linkedin.com/company/vibevaults/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="VibeVaults on LinkedIn"
                            className="hover:text-primary transition-colors inline-flex items-center md:ml-4"
                        >
                            <LinkedinIcon className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
