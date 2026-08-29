/**
 * Main Responsibility: Getting-started guide — project creation, the script
 * tag, inviting clients, and what the first feedback round looks like.
 *
 * Sensitive Dependencies:
 * - The embed snippet must match what `embed-widget-card.tsx` generates.
 * - The invite/bootstrap description must match `public/widget.js` and
 *   `/docs/widget-access`. If token handling changes, both pages change.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";

const page = getDocPage("quick-start")!;

export const metadata: Metadata = {
    title: page.title,
    description: page.summary,
};

export default function QuickStartDoc() {
    return (
        <>
            <DocsPageHeader title={page.title} summary={page.summary} />

            <div className="docs-prose">
                <h2 id="create-a-project">1. Create a project</h2>
                <p>
                    A <strong>project</strong> is one website. In the dashboard sidebar, open the project switcher and choose
                    <strong> Create project</strong>. You give it a name and the website address it will run on.
                </p>
                <p>
                    Projects live inside a <strong>workspace</strong>, which is usually one client or one team. You get a
                    workspace automatically when you sign up, so you can ignore this until you have a second client. How the
                    two nest is covered in <Link href="/docs/roles-and-sharing">Roles, workspaces and sharing</Link>.
                </p>

                <h2 id="embed-the-widget">2. Embed the widget</h2>
                <p>
                    Open the project&apos;s settings and copy the snippet from the <strong>Embed widget</strong> card. It looks
                    like this, with your own project key:
                </p>
                <pre><code>{`<script src="https://www.vibe-vaults.com/widget.js" data-key="YOUR_PROJECT_KEY" async></script>`}</code></pre>
                <p>
                    Paste it before the closing <code>&lt;/body&gt;</code> tag of the site. One tag, no build step, no plugin.
                    It works on WordPress, Webflow, Shopify, React, or plain HTML. The script is loaded asynchronously and does
                    not block your page.
                </p>
                <div className="docs-callout">
                    <p>
                        <strong>Nothing appears on the page yet, and that is correct.</strong> The widget stays completely
                        hidden for anonymous visitors. It only renders for people you have invited, on a device where they have
                        opened their access link. Your site&apos;s real visitors never see it.
                    </p>
                </div>

                <h2 id="see-it-yourself">3. See it on your own site</h2>
                <p>
                    In the same <strong>Embed widget</strong> card, click <strong>Open widget on site</strong>. That opens your
                    website with a one-time access link attached, which plants your access token in that browser. The widget
                    appears in the bottom corner and stays available on that device from then on.
                </p>

                <h2 id="invite-your-client">4. Invite your client</h2>
                <p>
                    Go to the <strong>Users</strong> page and invite people by email. There are two kinds of invitee:
                </p>
                <ul>
                    <li>
                        <strong>Clients</strong> leave feedback on the site through the widget. They never create an account,
                        never set a password, and never see your dashboard.
                    </li>
                    <li>
                        <strong>Members</strong> are your own team. They sign in to the dashboard, see all feedback, and can
                        reply and change status.
                    </li>
                </ul>
                <p>
                    Everyone invited gets an email with a link that opens the website and activates the widget for them. Every
                    plan includes unlimited clients, so invite the whole client team.
                </p>

                <h2 id="the-first-round">5. Run the first round</h2>
                <p>Once the widget is live for your client, the loop looks like this:</p>
                <ul>
                    <li>They click the <strong>Feedback</strong> button in the corner of the site.</li>
                    <li>
                        They click the spot on the page they mean, a pin lands there, and they type the problem into the dialog
                        that opens beside it. The widget captures a screenshot plus the technical context automatically.
                    </li>
                    <li>
                        The pin stays on the page, so everyone reviewing the site sees it in context rather than only in the
                        dashboard. See <strong>Pinning feedback</strong> for the details.
                    </li>
                    <li>The report lands in your dashboard, and you get a notification and an email.</li>
                    <li>
                        You reply from the dashboard. Your reply appears in their widget in real time, and they can answer back
                        from the same place, so a question does not become another email thread.
                    </li>
                    <li>
                        You move the report through <strong>open</strong>, <strong>in progress</strong>,{" "}
                        <strong>in review</strong>, and <strong>completed</strong>. Completed items disappear from the client&apos;s
                        widget so their list only shows what is still live.
                    </li>
                </ul>

                <h2 id="what-next">Where to go next</h2>
                <p>
                    If a client says the widget is not showing up, start with{" "}
                    <Link href="/docs/troubleshooting">Troubleshooting</Link>. If you want to understand exactly what gets
                    captured with each report, read <Link href="/docs/widget-data">What the widget records</Link>.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
