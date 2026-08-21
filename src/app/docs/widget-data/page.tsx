/**
 * Main Responsibility: Public reference explaining exactly what the embedded
 * widget records with each feedback report — console logs, failed requests,
 * browser context — and why query strings are stripped from captured URLs.
 * Written for customers who need to answer their own users' questions, and for
 * us when we forget the reasoning.
 *
 * Sensitive Dependencies:
 * - Linked from the console-logs sheet in `feedback-detail.tsx`; keep the
 *   `#query-strings` anchor stable.
 * - If `public/widget.js` changes what it captures, this page is the contract
 *   that has to change with it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";

const page = getDocPage("widget-data")!;

export const metadata: Metadata = {
    title: page.title,
    description:
        "Exactly what the VibeVaults feedback widget captures with each report: console logs, failed requests, and browser context, and why query strings are stripped from recorded URLs.",
};

export default function WidgetDataDoc() {
    return (
        <>
            <DocsPageHeader
                title={page.title}
                summary="When someone submits feedback, VibeVaults attaches the technical context that turns “it’s broken” into something a developer can act on. Here is exactly what that contains, what it leaves out, and why."
            />

            <div className="docs-prose">
                <h2 id="what-travels">What travels with a report</h2>
                <p>Every feedback submission carries:</p>
                <ul>
                    <li><strong>Page URL</strong> — the address of the page the feedback was written on</li>
                    <li><strong>Browser and operating system</strong>, derived from the user agent string</li>
                    <li><strong>Screen and viewport size</strong>, and the browser language</li>
                    <li><strong>Console logs</strong> — the last 50 entries</li>
                    <li><strong>Failed requests</strong> — up to 15 entries</li>
                    <li><strong>The selected element</strong>, if the reporter pointed at something specific</li>
                    <li><strong>A screenshot and any files</strong> the reporter chose to attach</li>
                </ul>
                <p>
                    All of it is visible to you in the dashboard on the feedback detail view. Nothing is hidden from the account
                    that receives the report.
                </p>

                <h2 id="console-logs">Console logs</h2>
                <p>
                    The widget keeps a rolling buffer of the last 50 <code>console.log</code>, <code>console.warn</code>, and{" "}
                    <code>console.error</code> calls made on the page and attaches it to the report. Entries are recorded as
                    your site produced them, so whatever your own code chooses to log is what appears.
                </p>
                <p>
                    Worth knowing: if your application logs request payloads, user records, or tokens to the console, those end
                    up in the buffer. That is your logging decision, not something the widget adds. If it matters for your site,
                    keep sensitive values out of the console.
                </p>

                <h2 id="failed-requests">Failed requests</h2>
                <p>
                    Network failures never reach the console. When a request returns a 500 or is blocked, the browser writes
                    that straight into its developer tools, and no JavaScript on the page can see it as a log line. Since a
                    failed request is the most common cause of “I clicked the button and nothing happened”, the widget watches
                    for them directly and records them alongside the console entries, tagged{" "}
                    <strong className="text-violet-600">network</strong>.
                </p>
                <p>An entry looks like this:</p>
                <pre><code>POST https://yoursite.com/api/checkout failed: 500 Internal Server Error</code></pre>
                <p>That is the whole entry. It records:</p>
                <ul>
                    <li>the HTTP method</li>
                    <li>the origin and path of the request, with no query string</li>
                    <li>the status code, or the reason it never completed, such as a network error or a timeout</li>
                </ul>
                <p>
                    Only failures are recorded. Successful requests are ignored entirely. Repeated identical failures are
                    collapsed into one entry, so a retrying request cannot flood the report.
                </p>

                <h2 id="query-strings">Why query strings are stripped</h2>
                <p>This is deliberate, and it is the one place where we knowingly give up diagnostic detail.</p>
                <p>
                    Query strings routinely carry secrets. A password reset that fails would put its reset token in the report.
                    A call to <code>?access_token=…</code> would put a live credential in it. A lookup like{" "}
                    <code>?email=jane@example.com</code> would put one of your users&apos; personal data into a bug report they
                    never knew was being written.
                </p>
                <p>
                    None of that belongs in our database. So the widget removes the query string before the entry is created,
                    on the user&apos;s device, before anything is sent. The values never leave the browser and we never receive
                    them. Path segments that look like email addresses are replaced with <code>[redacted]</code> for the same
                    reason, and very long segments are truncated.
                </p>
                <p>
                    The practical consequence: you can see <em>which endpoint</em> failed and <em>how</em> it failed, but not
                    the parameters of that one call. In our experience the endpoint and status are what you need to reproduce a
                    bug, and the parameters are what you would have to explain to a data protection officer.
                </p>

                <h2 id="never-recorded">What is never recorded</h2>
                <ul>
                    <li><strong>Query strings</strong> on failed requests, as described above</li>
                    <li><strong>Request and response bodies</strong> — the widget reads neither</li>
                    <li><strong>HTTP headers, cookies, and authorization tokens</strong> from your site&apos;s requests</li>
                    <li><strong>Successful requests</strong> — no general traffic log is built</li>
                    <li><strong>Keystrokes, form contents, or session replay</strong> — the widget does not record the session</li>
                    <li><strong>The widget&apos;s own calls</strong> to VibeVaults, filtered out so our traffic never clutters your reports</li>
                </ul>

                <h2 id="your-obligations">Your obligations as the site owner</h2>
                <p>
                    The widget only appears for people you have invited, and it collects this context at the moment someone
                    chooses to send you feedback. Even so, under the GDPR you are the data controller for your users&apos; data
                    and VibeVaults is your processor. If you operate in the EU, your own privacy notice should mention that
                    submitting feedback shares page context and console output with a third-party provider.
                </p>
                <p>
                    Our side of that arrangement, including retention and deletion, is described in the{" "}
                    <Link href="/privacy-policy">Privacy Policy</Link>.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
