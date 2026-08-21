/**
 * Main Responsibility: Public reference page explaining exactly what the
 * embedded widget records with each feedback report — console logs, failed
 * requests, browser context — and why query strings are stripped from captured
 * URLs. Written for customers who need to answer their own users' questions,
 * and for us when we forget the reasoning.
 *
 * Sensitive Dependencies:
 * - Linked from the console-logs sheet in `feedback-detail.tsx`; keep the
 *   `#query-strings` anchor stable.
 * - Must stay public: excluded from the auth gate in `src/lib/supabase/proxy.ts`.
 * - If `public/widget.js` changes what it captures, this page is the contract
 *   that has to change with it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/CookiePreferencesLink";

export const metadata: Metadata = {
    title: "What the widget records",
    description:
        "Exactly what the VibeVaults feedback widget captures with each report: console logs, failed requests, and browser context — and why query strings are stripped from recorded URLs.",
};

export default function WidgetDataDocs() {
    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-8 py-6">
                    <Link href="/" className="font-bold text-xl tracking-tight text-primary hover:opacity-90 transition-opacity">
                        VibeVaults
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-8 py-12">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Documentation</p>
                <h1 className="text-4xl font-extrabold mb-4 text-gray-900">What the widget records</h1>
                <p className="text-gray-500 mb-8">
                    <strong>Last updated:</strong> August 21, 2026
                </p>

                <div className="prose prose-gray max-w-none">
                    <p className="mb-6 text-lg text-gray-600 leading-relaxed">
                        When someone submits feedback through the widget, VibeVaults attaches the technical context that
                        turns &#8220;it&#8217;s broken&#8221; into something a developer can act on. This page lists exactly what that
                        context contains, what it deliberately leaves out, and why.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">1. What travels with a report</h2>
                    <p className="mb-4">Every feedback submission carries:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Page URL</strong> — the address of the page the feedback was written on</li>
                        <li><strong>Browser and operating system</strong>, derived from the user agent string</li>
                        <li><strong>Screen and viewport size</strong>, and the browser language</li>
                        <li><strong>Console logs</strong> — the last 50 entries (see below)</li>
                        <li><strong>Failed requests</strong> — up to 15 entries (see below)</li>
                        <li><strong>The selected element</strong>, if the reporter pointed at something specific</li>
                        <li><strong>A screenshot and any files</strong> the reporter chose to attach</li>
                    </ul>
                    <p className="mb-6">
                        All of it is visible to you in the dashboard on the feedback detail view. Nothing is hidden from the
                        account that receives the report.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">2. Console logs</h2>
                    <p className="mb-4">
                        The widget keeps a rolling buffer of the last 50 <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">console.log</code>,{" "}
                        <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">console.warn</code>, and{" "}
                        <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">console.error</code> calls made on the page, and
                        attaches it to the report. Entries are recorded as your site produced them, so whatever your own code
                        chooses to log is what appears.
                    </p>
                    <p className="mb-6">
                        Worth knowing: if your application logs request payloads, user records, or tokens to the console, those
                        end up in the buffer. That is your logging decision, not something the widget adds. If it matters for
                        your site, keep sensitive values out of the console.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">3. Failed requests</h2>
                    <p className="mb-4">
                        Network failures never reach the console. When a request returns a 500 or is blocked, the browser writes
                        that straight into its developer tools and no JavaScript on the page can see it as a log line. Since a
                        failed request is the single most common cause of &#8220;I clicked the button and nothing happened,&#8221; the
                        widget watches for them directly and records them alongside the console entries, tagged{" "}
                        <strong className="text-violet-600">network</strong>.
                    </p>
                    <p className="mb-4">An entry looks like this:</p>
                    <pre className="bg-slate-950 text-slate-300 rounded-xl p-5 text-[13px] font-mono overflow-x-auto mb-4 ring-1 ring-white/10">
POST https://yoursite.com/api/checkout failed: 500 Internal Server Error</pre>
                    <p className="mb-4">That is the whole entry. It records:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>the HTTP method</li>
                        <li>the origin and path of the request, with no query string</li>
                        <li>the status code, or the reason it never completed (network error, timeout)</li>
                    </ul>
                    <p className="mb-6">
                        Only failures are recorded. Successful requests are ignored entirely. Repeated identical failures are
                        collapsed into one entry, so a retrying request cannot flood the report.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 id="query-strings" className="text-2xl font-bold mb-4 text-gray-900 scroll-mt-8">4. Why query strings are stripped</h2>
                    <p className="mb-4">
                        This is deliberate, and it is the one place where we knowingly give up diagnostic detail.
                    </p>
                    <p className="mb-4">
                        Query strings routinely carry secrets. A password reset that fails would put its reset token in the
                        report. An API call to <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">?access_token=&#8230;</code> would
                        put a live credential in it. Lookups like{" "}
                        <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">?email=jane@example.com</code> would put one of your
                        users&#8217; personal data into a bug report they never knew was being written.
                    </p>
                    <p className="mb-4">
                        None of that belongs in our database. So the widget removes the query string before the entry is created,
                        on the user&#8217;s device, before anything is sent. The values never leave the browser and we never receive
                        them. Path segments that look like email addresses are replaced with{" "}
                        <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">[redacted]</code> for the same reason, and very long
                        segments are truncated.
                    </p>
                    <p className="mb-6">
                        The practical consequence: you can see <em>which endpoint</em> failed and <em>how</em> it failed, but not
                        the exact parameters of that one call. In our experience the endpoint and status are what you need to
                        reproduce a bug, and the parameters are what you would have to explain to a data protection officer.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">5. What is never recorded</h2>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Query strings</strong> on failed requests, as described above</li>
                        <li><strong>Request and response bodies</strong> — the widget reads neither</li>
                        <li><strong>HTTP headers, cookies, and authorization tokens</strong> from your site&#8217;s requests</li>
                        <li><strong>Successful requests</strong> — no general traffic log is built</li>
                        <li><strong>Keystrokes, form contents, or session replay</strong> — the widget does not record the session</li>
                        <li><strong>The widget&#8217;s own calls</strong> to VibeVaults, which are filtered out so our traffic never clutters your reports</li>
                    </ul>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">6. Your obligations as the site owner</h2>
                    <p className="mb-4">
                        The widget only appears for people you have invited, and it collects this context at the moment someone
                        chooses to send you feedback. Even so, under the GDPR you are the data controller for your users&#8217; data
                        and VibeVaults is your processor. If you operate in the EU, your own privacy notice should mention that
                        submitting feedback shares page context and console output with a third-party provider.
                    </p>
                    <p className="mb-6">
                        Our side of that arrangement, including retention and deletion, is described in the{" "}
                        <Link href="/privacy-policy" className="text-primary underline hover:opacity-80 transition-opacity">
                            Privacy Policy
                        </Link>
                        .
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Questions</h2>
                    <p className="mb-4">
                        If you need detail this page does not cover, or your compliance review needs something in writing, reach
                        out:
                    </p>
                    <p className="mb-6">
                        <strong>Email:</strong> support@vibe-vaults.com
                    </p>
                </div>
            </main>

            <footer className="py-8 w-full border-t border-gray-100 bg-gray-50 mt-12">
                <div className="max-w-3xl mx-auto px-8 flex flex-col sm:flex-row justify-center items-center gap-3 text-sm text-gray-500">
                    <span>&copy; {new Date().getFullYear()} VibeVaults. All rights reserved.</span>
                    <span className="hidden sm:inline">&middot;</span>
                    <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">Privacy Policy</Link>
                    <span className="hidden sm:inline">&middot;</span>
                    <CookiePreferencesLink />
                </div>
            </footer>
        </div>
    );
}
