/**
 * Main Responsibility: Customer-facing explanation of screenshot capture and
 * pinning, including the known Firefox hardware-acceleration rendering
 * bug and its workaround. This is the page to send someone whose screenshot
 * came out with ghosted pill-shaped elements.
 *
 * Sensitive Dependencies:
 * - Mirrors the capture implementation in `public/widget.js` (snapdom, viewport
 *   crop, pin marker, JPEG encoding).
 * - The Firefox bug section must stay in sync with the "Known browser bug"
 *   entry in CLAUDE.md.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";

const page = getDocPage("screenshots")!;

export const metadata: Metadata = {
    title: page.title,
    description: page.summary,
};

export default function ScreenshotsDoc() {
    return (
        <>
            <DocsPageHeader title={page.title} summary={page.summary} />

            <div className="docs-prose">
                <h2 id="how-it-works">How capture works</h2>
                <p>
                    When someone chooses to attach a screenshot, the widget reads the page as it is currently rendered in their
                    browser and redraws it into an image. It crops to what they can actually see, so you get the viewport they
                    were looking at rather than a full-page image where the problem is somewhere in the middle.
                </p>
                <p>
                    Nothing is sent to a server to be rendered. The image is produced on their device from their own view of
                    the page, which is why it reflects their screen size, their zoom level, their cookie banner, and the state
                    they had the page in.
                </p>

                <h2 id="pointing">Pointing at the problem</h2>
                <p>
                    The reporter clicks the exact spot they are talking about and a pin lands there. The screenshot is captured
                    with that pin drawn onto it, so the image arrives already showing what they meant.
                </p>
                <p>
                    This is the difference between &quot;the button is broken&quot; and a picture with the button circled, and
                    it works for things that are not elements at all, such as the gap between two sections. The pin also stays
                    on the live page for everyone else to see, which is covered in{" "}
                    <Link href="/docs/pinning">Pinning feedback</Link>.
                </p>

                <h2 id="what-is-in-the-image">What ends up in the image</h2>
                <p>
                    Exactly what was on their screen. If the page was showing a logged-in account, a customer record, or a test
                    order, that is in the screenshot, because it was in the viewport when they pressed capture.
                </p>
                <p>
                    Screenshots are attached to the feedback item and visible to everyone with access to that project. If your
                    client works with genuinely sensitive data, it is worth telling them to close such views before reporting.
                    The rest of the captured context is deliberately narrower, and that is described in{" "}
                    <Link href="/docs/widget-data">What the widget records</Link>.
                </p>

                <h2 id="firefox-bug">Known issue: ghosted elements in Firefox</h2>
                <p>
                    On some Firefox installations, small rounded elements such as pill-shaped badges and buttons come out
                    hollow in the screenshot. The shadow around them renders, but the fill colour and the text inside are
                    missing, leaving an outline where the element should be. The rest of the image is correct.
                </p>
                <p>
                    This is a bug in how Firefox rasterizes pages using the graphics card, not in what the widget captures. We
                    confirmed that the page data handed to the browser is complete and correct; the colour is lost in Firefox&apos;s
                    own drawing step. It affects every screenshot tool built on this browser capability, not only VibeVaults.
                </p>
                <div className="docs-callout">
                    <p>
                        <strong>Workaround for the affected person:</strong> in Firefox, open Settings, go to the Performance
                        section, and uncheck <strong>Use recommended performance settings</strong>, then uncheck{" "}
                        <strong>Use hardware acceleration when available</strong>. Restart Firefox and capture again. Chrome,
                        Edge, and Safari are unaffected, so switching browsers for that one report also works.
                    </p>
                </div>
                <p>
                    We have not applied a code-level workaround because the available fix would reduce screenshot quality for
                    everyone in order to help an unknown number of Firefox users. We are measuring how often this actually
                    happens before making that trade. If it is hitting your clients, tell us and it moves up the list.
                </p>

                <h2 id="attachments">Attachments</h2>
                <p>
                    Reporters can also attach their own files: images, PDFs, documents, spreadsheets, and plain text. The limit
                    is 10 MB per file and 10 files per report. Total storage depends on your plan.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
