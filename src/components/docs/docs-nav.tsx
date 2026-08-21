"use client";

/**
 * Main Responsibility: Sidebar navigation for the /docs section, highlighting
 * the current page. Client component only because it needs usePathname for the
 * active state.
 * Sensitive Dependencies: page list comes from lib/docs-data.ts — do not
 * hardcode links here.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { docsPages } from "@/lib/docs-data";

export function DocsNav() {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-1">
            <Link
                href="/docs"
                className={cn(
                    "text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg transition-colors",
                    pathname === "/docs" ? "text-primary bg-primary/5" : "text-gray-400 hover:text-primary"
                )}
            >
                Documentation
            </Link>
            {docsPages.map((page) => {
                const href = `/docs/${page.slug}`;
                const active = pathname === href;
                return (
                    <Link
                        key={page.slug}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "text-sm px-3 py-2 rounded-lg transition-all duration-200 border-l-2",
                            active
                                ? "border-primary bg-primary/5 text-primary font-semibold"
                                : "border-transparent text-gray-600 hover:text-primary hover:bg-gray-50 font-medium"
                        )}
                    >
                        {page.title}
                    </Link>
                );
            })}
        </nav>
    );
}
