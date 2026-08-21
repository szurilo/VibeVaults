/**
 * Main Responsibility: Explains the workspace/project hierarchy, the three
 * roles (owner, member, client), plan limits, and public share boards.
 *
 * Sensitive Dependencies:
 * - Plan names, prices and limits are READ from `src/lib/tier-config.ts`
 *   (TIER_DISPLAY + TIER_LIMITS), never restated here, so a pricing change
 *   cannot leave this page lying. Only the prose framing is hand-written.
 * - Public boards are tier-gated; keep in step with `toggleProjectSharing()`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DocsPageHeader } from "@/components/docs/docs-page-header";
import { DocsPageFooter } from "@/components/docs/docs-page-footer";
import { getDocPage } from "@/lib/docs-data";
import { TIER_DISPLAY, TIER_LIMITS, YEARLY_DISCOUNT } from "@/lib/tier-config";

const page = getDocPage("roles-and-sharing")!;

/** "Unlimited" for Infinity, plain number otherwise. */
const count = (n: number) => (Number.isFinite(n) ? String(n) : "unlimited");

/** Bytes as the same units the pricing table uses: 500 MB, 5 GB, 50 GB. */
function storage(bytes: number): string {
    const GB = 1024 * 1024 * 1024;
    return bytes >= GB ? `${bytes / GB} GB` : `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** One sentence of limits per tier, assembled from the live config. */
function planLine(slug: (typeof TIER_DISPLAY)[number]["slug"]): string {
    const l = TIER_LIMITS[slug];
    const workspaces = `${count(l.maxWorkspaces)} ${l.maxWorkspaces === 1 ? "workspace" : "workspaces"}`;
    const projects = `${count(l.maxProjects)} ${l.maxProjects === 1 ? "project" : "projects"}`;
    const members = `${count(l.maxTeamMembers)} team ${l.maxTeamMembers === 1 ? "member" : "members"}`;
    return `${workspaces}, ${projects}, ${members}, ${storage(l.storageBytes)} of attachment storage`;
}

export const metadata: Metadata = {
    title: page.title,
    description: page.summary,
};

export default function RolesAndSharingDoc() {
    return (
        <>
            <DocsPageHeader title={page.title} summary={page.summary} />

            <div className="docs-prose">
                <h2 id="hierarchy">Workspaces and projects</h2>
                <p>
                    A <strong>workspace</strong> holds people. A <strong>project</strong> holds one website and its feedback.
                    Projects belong to a workspace, and anyone in the workspace can work on any of its projects.
                </p>
                <p>
                    The arrangement most agencies land on is one workspace per client, with a project for each site or
                    environment you are reviewing. If you are a freelancer with a handful of sites, a single workspace with
                    several projects is simpler and works fine.
                </p>

                <h2 id="roles">The three roles</h2>
                <h3>Owner</h3>
                <p>
                    The person who created the workspace. Owners do everything members can do, plus invite and remove people,
                    manage the subscription, and turn public boards on or off. Plan limits are counted against the owner&apos;s
                    account.
                </p>
                <h3>Member</h3>
                <p>
                    Your team. Members sign in to the dashboard, see every project in the workspace, reply to feedback, change
                    status, create projects, and delete them. They cannot manage billing or invite people.
                </p>
                <h3>Client</h3>
                <p>
                    The people reviewing the website. Clients only ever see the widget on the site itself. They have no
                    account, no password, and no dashboard access, and they cannot see who else was invited. Clients are
                    unlimited on every plan and never affect your bill.
                </p>
                <div className="docs-callout">
                    <p>
                        A client is not a lesser dashboard user, it is a different thing entirely. If you want someone to see
                        the dashboard, invite them as a member instead. How each kind gets access to the widget is covered in{" "}
                        <Link href="/docs/widget-access">How widget access works</Link>.
                    </p>
                </div>

                <h2 id="limits">What each plan allows</h2>
                <p>
                    Limits are counted across your whole account, not per workspace, so ten projects means ten projects in
                    total. Team member counts exclude you and exclude clients.
                </p>
                <ul>
                    {TIER_DISPLAY.map((tier) => {
                        const limits = TIER_LIMITS[tier.slug];
                        const extras = [
                            limits.showBranding ? "shows a small VibeVaults badge on the widget" : "no badge on the widget",
                            limits.publicDashboard ? "public boards available" : null,
                            limits.prioritySupport ? "priority support" : null,
                        ].filter(Boolean);
                        const extraText = extras.join(", ");
                        return (
                            <li key={tier.slug}>
                                <strong>
                                    {tier.name}, ${tier.monthlyPrice}/month
                                </strong>{" "}
                                — {planLine(tier.slug)}. {extraText.charAt(0).toUpperCase() + extraText.slice(1)}
                                {"."}
                            </li>
                        );
                    })}
                </ul>
                <p>
                    Yearly billing saves {Math.round(YEARLY_DISCOUNT * 100)}% on all {TIER_DISPLAY.length} plans. Every plan
                    starts with a 14-day trial, and there are no per-client or per-feedback fees on any of them. Current
                    pricing always lives on the <Link href="/pricing">pricing page</Link>.
                </p>

                <h2 id="share-boards">Public feedback boards</h2>
                <p>
                    A project can publish a read-only board at a private link. Anyone with the link sees the feedback items and
                    their statuses without signing in and without being able to change anything.
                </p>
                <p>
                    This is for the people who want visibility but should not be in the loop: a client&apos;s manager, a
                    stakeholder who only wants to watch progress, or your own status page during a launch week. Turn it on from
                    the project&apos;s <strong>Share</strong> card, and turn it off whenever you like. Regenerating the link
                    immediately invalidates the old one.
                </p>
                <p>
                    Treat the link as semi-public. It is unguessable, but anyone it is forwarded to can read the board, so do
                    not enable it on a project whose feedback discusses anything confidential. Public boards are available on{" "}
                    {TIER_DISPLAY.filter((t) => TIER_LIMITS[t.slug].publicDashboard).map((t) => t.name).join(" and ")}.
                </p>

                <h2 id="leaving">People leaving</h2>
                <p>
                    Members can leave a workspace themselves, and owners can remove them. Either way the owner is notified, and
                    the person&apos;s widget access for that workspace&apos;s projects is revoked at the same moment. Their
                    feedback and replies stay where they are, so the history of a project does not develop holes when someone
                    moves on.
                </p>
            </div>

            <DocsPageFooter slug={page.slug} />
        </>
    );
}
