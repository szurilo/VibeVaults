import Link from "next/link";

/**
 * Main Responsibility: Shared sticky site header/nav used by the landing page
 * and the /compare marketing pages, so the top chrome stays identical everywhere.
 * Sensitive Dependencies: nav anchors use absolute /#... hrefs so they resolve
 * from any route (not just the landing page).
 */
export function SiteHeader() {
    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="px-4 md:px-8 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex-1">
                    <Link href="/" className="font-bold text-xl md:text-2xl tracking-tight text-primary hover:opacity-90 transition-opacity whitespace-nowrap">
                        VibeVaults
                    </Link>
                </div>
                <nav className="hidden md:flex gap-8 flex-1 justify-center">
                    <Link href="/#features" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
                        Features
                    </Link>
                    <Link href="/#how-it-works" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
                        How it works
                    </Link>
                    <Link href="/pricing" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
                        Pricing
                    </Link>
                </nav>
                <div className="flex gap-2 md:gap-4 items-center flex-1 justify-end">
                    <Link href="/auth/login" className="text-sm font-semibold px-3 py-2 md:px-4 text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap">
                        Sign In
                    </Link>
                    <Link href="/auth/register" className="inline-flex items-center justify-center px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap">
                        Get Started
                    </Link>
                </div>
            </div>
        </header>
    );
}
