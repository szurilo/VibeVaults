import Link from "next/link";
import { LinkedinIcon } from "@/components/icons/linkedin-icon";
import { CookiePreferencesLink } from "@/components/CookiePreferencesLink";
import { allComparisons } from "@/lib/compare-data";
import { docsPages } from "@/lib/docs-data";

/**
 * Main Responsibility: Shared site footer used by the landing page, the
 * /compare marketing pages and /docs. Four-column link layout (Product,
 * Documentation, Compare, Legal) over a brand/copyright bar, which is the
 * convention across this category and keeps every internal link crawlable.
 * Sensitive Dependencies: CookiePreferencesLink is a client component; the
 * Compare links derive from allComparisons (lib/compare-data.ts) and the docs
 * links from docsPages (lib/docs-data.ts), so new entries appear automatically.
 */

const productLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
    { href: "/compare", label: "Compare" },
];

function FooterColumn({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
    return (
        <div>
            {href ? (
                <Link
                    href={href}
                    className="inline-block text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-primary transition-colors mb-4"
                >
                    {title}
                </Link>
            ) : (
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{title}</div>
            )}
            <ul className="flex flex-col gap-2.5">{children}</ul>
        </div>
    );
}

function FooterLink({ href, label }: { href: string; label: string }) {
    return (
        <li>
            <Link href={href} className="text-sm text-gray-500 hover:text-primary transition-colors">
                {label}
            </Link>
        </li>
    );
}

export function SiteFooter() {
    return (
        <footer className="pt-12 pb-8 w-full border-t border-gray-100 bg-white">
            <div className="max-w-7xl mx-auto px-8">
                {/* Link columns */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pb-10 mb-8 border-b border-gray-100">
                    <FooterColumn title="Product">
                        {productLinks.map((l) => (
                            <FooterLink key={l.href} href={l.href} label={l.label} />
                        ))}
                    </FooterColumn>

                    <FooterColumn title="Documentation" href="/docs">
                        {docsPages.map((page) => (
                            <FooterLink key={page.slug} href={`/docs/${page.slug}`} label={page.title} />
                        ))}
                    </FooterColumn>

                    <FooterColumn title="Compare" href="/compare">
                        {allComparisons.map((c) => (
                            <FooterLink
                                key={c.slug}
                                href={`/compare/${c.slug}`}
                                label={`VibeVaults vs ${c.competitorName}`}
                            />
                        ))}
                    </FooterColumn>

                    <FooterColumn title="Legal">
                        <FooterLink href="/terms-of-service" label="Terms of Service" />
                        <FooterLink href="/privacy-policy" label="Privacy Policy" />
                        <li>
                            <CookiePreferencesLink className="text-sm text-gray-500 hover:text-primary transition-colors cursor-pointer" />
                        </li>
                        <FooterLink href="/access" label="Lost widget access?" />
                    </FooterColumn>
                </div>

                {/* Brand / social row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} VibeVaults. All rights reserved.
                    </div>
                    <a
                        href="https://www.linkedin.com/company/vibevaults/"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="VibeVaults on LinkedIn"
                        className="text-gray-600 hover:text-primary transition-colors inline-flex items-center"
                    >
                        <LinkedinIcon className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </footer>
    );
}
