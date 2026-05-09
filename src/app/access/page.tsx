/**
 * Main Responsibility: Public self-service page where invited clients and
 * workspace members can request fresh widget access links by email when
 * they've lost their per-device token (cleared browser, new device, etc.).
 *
 * Sensitive Dependencies:
 * - requestWidgetAccessRecovery server action: rate-limited per IP and per
 *   email, looks up workspace_members + workspace_invites, mints fresh
 *   bootstrap URLs, and emails them. Always returns ok=true to prevent
 *   email enumeration; the form below renders a generic confirmation in
 *   either case.
 */
import Link from 'next/link';
import { AccessForm } from './AccessForm';

export const metadata = {
    title: 'Widget access — VibeVaults',
    description: "Request fresh widget access links if you've lost access on your device.",
};

export default function AccessPage() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-8 py-4 max-w-7xl mx-auto w-full">
                    <Link
                        href="/"
                        className="font-bold text-2xl tracking-tight text-primary hover:opacity-90 transition-opacity"
                    >
                        VibeVaults
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-[440px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold mb-2 text-gray-900">
                            Lost widget access?
                        </h1>
                        <p className="text-gray-500 text-sm">
                            Enter the email you were invited with and we&apos;ll send fresh links to activate the feedback widget on every project you have access to.
                        </p>
                    </div>

                    <AccessForm />

                    <p className="text-xs text-center text-gray-500 mt-6">
                        For security we&apos;ll always say the request was received, even if the email isn&apos;t on file. Check your inbox; if no email arrives, ask the workspace owner to re-invite you.
                    </p>
                </div>
            </main>
        </div>
    );
}
