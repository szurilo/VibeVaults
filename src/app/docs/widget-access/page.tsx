/**
 * Main Responsibility: Explains the invite-only, per-device widget access model
 * to customers — why the widget is invisible by default, how bootstrap links
 * work, and the /access self-service recovery path.
 *
 * Sensitive Dependencies:
 * - Must match the token flow in `public/widget.js` and
 *   `src/actions/widget-access.ts` (`?vv_invite=`, `?vv_token=`, localStorage).
 * - The /access recovery page it points at must stay public in
 *   `src/lib/supabase/proxy.ts`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";

const page = getDocPage("widget-access")!;

export const metadata: Metadata = {
    title: page.title,
    description: page.summary,
};

export default function WidgetAccessDoc() {
    return (
        <>
            <DocsPageHeader title={page.title} summary={page.summary} />

            <div className="docs-prose">
                <h2 id="invite-only">The widget is invisible by default</h2>
                <p>
                    The script tag is on every page of the site, but the widget renders for nobody until it recognises the
                    person looking at it. A customer browsing your client&apos;s shop sees nothing at all: no button, no badge,
                    no prompt asking for an email address.
                </p>
                <p>
                    This is the core difference from a public feedback tool. You are running a review round with named people,
                    not collecting opinions from the internet, so access is by invitation only.
                </p>

                <h2 id="access-links">How someone gets access</h2>
                <p>
                    When you invite a client or a member, they receive an email containing a link to the website with an access
                    code attached. Opening it once does three things: the widget exchanges the code for a private access token,
                    stores that token in the browser, and removes the code from the address bar so it cannot leak through a
                    shared link or a referrer header.
                </p>
                <p>
                    From then on, the widget simply appears whenever that person visits the site in that browser. There is
                    nothing to install, no account to create, and no password.
                </p>

                <h2 id="per-device">Access is per device, on purpose</h2>
                <p>
                    The token lives in the browser that opened the link. Someone who opens their invite on a laptop and later
                    visits the site on their phone will not see the widget on the phone until they open the link there too.
                </p>
                <p>
                    The same invite link works on as many devices as they like, so the fix is usually just forwarding the
                    original email to themselves. We chose per-device tokens over accounts because it keeps clients out of
                    password resets entirely, which is the part of client onboarding that actually costs you time.
                </p>
                <div className="docs-callout">
                    <p>
                        Access also disappears when the browser data does. Clearing site data, a fresh reinstall, or a strict
                        privacy setting that wipes storage will all remove the token, and the widget goes quiet again.
                    </p>
                </div>

                <h2 id="recovery">When someone loses access</h2>
                <p>
                    Anyone who has lost their link can recover it themselves at{" "}
                    <Link href="/access">vibe-vaults.com/access</Link>. They enter the email address you invited, and they
                    receive fresh links for every project they have access to.
                </p>
                <p>
                    The page always shows the same confirmation whether or not the address is on file, so it cannot be used to
                    discover who your clients are. It is rate limited as well, which is worth knowing if you are testing it
                    repeatedly and stop receiving mail for a few minutes.
                </p>
                <p>You can also fix it from your side, without involving them:</p>
                <ul>
                    <li>Re-send the invite from the <strong>Users</strong> page.</li>
                    <li>
                        For yourself or a team member, use <strong>Open widget on site</strong> in the project&apos;s embed card,
                        which issues a new link for the browser you are in.
                    </li>
                </ul>

                <h2 id="revoking">Removing access</h2>
                <p>
                    Deleting a client&apos;s invite removes their widget access on every device immediately. Removing a member
                    from a workspace does the same for that workspace&apos;s projects. There is no waiting period and no
                    lingering session: the next time their widget calls us, it is turned away, hides itself, and clears the
                    stored token.
                </p>
                <p>
                    This matters at the end of an engagement. When a project wraps and you remove the client, they stop being
                    able to file feedback on the live site that same minute.
                </p>

                <h2 id="trial-expiry">One more reason the widget can vanish</h2>
                <p>
                    The widget is disabled on every project belonging to an account whose trial has ended without a
                    subscription. Your clients are not told why; the widget simply stops appearing. If a client reports that
                    the widget disappeared for everyone at once, check your billing status first.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
