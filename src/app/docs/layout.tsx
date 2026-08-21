/**
 * Main Responsibility: Shared chrome for the /docs section — marketing header
 * and footer (so docs feel like part of the site, not a bolted-on subdomain)
 * plus the sticky sidebar nav.
 * Sensitive Dependencies: /docs must stay excluded from the auth gate in
 * src/lib/supabase/proxy.ts, otherwise these pages stop being crawlable.
 */
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { DocsNav } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            <SiteHeader />
            <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-16">
                <div className="flex gap-12">
                    <aside className="hidden lg:block w-60 shrink-0">
                        <div className="sticky top-28">
                            <DocsNav />
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1 max-w-3xl">{children}</main>
                </div>
            </div>
            <SiteFooter />
        </div>
    );
}
