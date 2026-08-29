/**
 * Main Responsibility: Public reference for the widget's pinning model — the
 * Browse/Feedback modes, dropping a pin anywhere on the page, and how a pin
 * stays attached to the right place after the site changes or is viewed at a
 * different width. Written for the agency handing this to a client.
 *
 * Sensitive Dependencies:
 * - Mirrors the anchoring behaviour in `public/widget.js` (resolveAnchor,
 *   pickAnchorElement, resolvePinPosition). If the anchoring model changes,
 *   the "when a pin loses its place" section is the claim that goes stale.
 * - The pin data that gets stored is documented in `/docs/widget-data`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";

const page = getDocPage("pinning")!;

export const metadata: Metadata = {
    title: page.title,
    description:
        "How pinned feedback works in VibeVaults: drop a pin anywhere on the page, switch between browsing and commenting, and see everyone's pins in context on the live site.",
};

export default function PinningDoc() {
    return (
        <>
            <DocsPageHeader
                title={page.title}
                summary="Feedback is attached to a point on the page, not just to a page. Your client clicks the spot they mean, types what is wrong, and the pin stays there for everyone who opens the site afterwards."
            />

            <div className="docs-prose">
                <h2 id="dropping-a-pin">Dropping a pin</h2>
                <p>
                    In the widget, click anywhere on the page and a small dialog opens right next to where you clicked. Write
                    the feedback, press send, and the pin stays on the page.
                </p>
                <p>
                    You can pin <em>anything</em>, not only buttons and images. The empty gap between two sections, the space
                    around a heading, a stretch of margin that looks wrong: all of it can carry a pin. That matters because
                    spacing problems are some of the most common things a designer needs to flag, and they are exactly the
                    things that are not an element you can point at.
                </p>
                <p>
                    A screenshot of the page is captured automatically in the background while you type, with the pin drawn onto
                    it. You do not have to ask for one.
                </p>

                <h2 id="modes">Browsing versus commenting</h2>
                <p>The widget has two modes, and the toggle sits at the top of the panel.</p>
                <ul>
                    <li>
                        <strong>Feedback</strong> shows every pin on the page and lets you add more. Clicking the page drops a
                        pin rather than following a link.
                    </li>
                    <li>
                        <strong>Browse</strong> hides the pins and gives the site back. Links, buttons and forms behave
                        normally, so this is the mode for clicking through to the page you actually want to review.
                    </li>
                </ul>
                <p>
                    The widget opens in Feedback mode so pins are visible straight away, and it remembers whichever mode you
                    picked last.
                </p>

                <h2 id="reading-pins">Reading what other people left</h2>
                <p>
                    Pins are numbered in the order they were created, so pin 1 is the oldest. Click one to open its
                    conversation in the panel and reply there. Replies appear live for everyone with the site open.
                </p>
                <p>
                    When several pins land close together they collapse into a single dark marker showing how many are stacked
                    there. Click it and they fan out so you can pick the one you want.
                </p>
                <p>
                    Pins only appear on the page they were left on. The page is matched on its address without the query
                    string, so arriving with a tracking parameter such as <code>?utm_source=…</code> still shows the same pins.
                </p>

                <h2 id="staying-in-place">How a pin stays in place</h2>
                <p>
                    A pin is not stored as a pair of screen coordinates. Coordinates stop meaning anything the moment the page
                    scrolls, the window is resized, or the site is deployed again.
                </p>
                <p>
                    Instead, each pin remembers the element it was placed on or beside, and its position relative to that
                    element. A pin dropped in the gap to the right of a button remembers that it sits a fixed distance from
                    that button&apos;s edge, so the gap it is describing survives a narrower window. A pin dropped inside a
                    panel that stretches with the viewport remembers its position proportionally, so it stays on the same part
                    of that panel.
                </p>
                <p>
                    The practical result is that a client can report a spacing problem on a wide monitor and you can open the
                    same pin on a laptop and find it pointing at the same thing.
                </p>

                <h2 id="losing-place">When a pin loses its place</h2>
                <p>
                    If the element a pin was attached to no longer exists, usually because the section was rebuilt or removed,
                    the pin falls back to roughly where it was and is drawn in grey with a dashed edge. That styling is a
                    warning: treat its position as approximate and rely on the screenshot, which still shows the page exactly as
                    it looked when the feedback was written.
                </p>
                <p>
                    This is also why the screenshot is captured automatically rather than being optional. The pin tells you
                    where; the screenshot proves what.
                </p>

                <h2 id="unpinned">Feedback without a pin</h2>
                <p>
                    Every report made from the widget is pinned, because a report made while looking at the site almost always
                    has a place it belongs. If you want to raise something general that is not tied to a spot on a page, add it
                    from the dashboard instead.
                </p>
                <p>
                    What the pin stores alongside your message is listed in{" "}
                    <Link href="/docs/widget-data">What the widget records</Link>.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
