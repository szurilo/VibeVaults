/**
 * Main Responsibility: Single source of truth for the /docs section — the page
 * list, their titles, summaries, and order. Drives the docs index, the sidebar
 * nav, the site footer's Docs column, and the sitemap, so adding a page here is
 * the only step needed for it to appear everywhere.
 *
 * Sensitive Dependencies:
 * - Each `slug` must match a directory under `src/app/docs/`. There is no
 *   runtime check; a mismatch ships a 404 link into the nav and the sitemap.
 * - `src/app/sitemap.ts` maps over this list.
 */

export interface DocPage {
    slug: string;
    title: string;
    /** One-line summary shown on the docs index and in nav tooltips. */
    summary: string;
}

export const docsPages: DocPage[] = [
    {
        slug: "quick-start",
        title: "Quick start",
        summary: "Create a project, embed one script tag, invite your client, and collect the first piece of feedback.",
    },
    {
        slug: "widget-access",
        title: "How widget access works",
        summary: "Invite-only access, per-device links, and what to do when someone loses theirs.",
    },
    {
        slug: "screenshots",
        title: "Screenshots and element tagging",
        summary: "How capture works, what a tagged element is, and the known Firefox rendering issue.",
    },
    {
        slug: "widget-data",
        title: "What the widget records",
        summary: "Console logs, failed requests, and why query strings are stripped from captured URLs.",
    },
    {
        slug: "roles-and-sharing",
        title: "Roles, workspaces and sharing",
        summary: "Owners, members and clients, how workspaces and projects nest, and public feedback boards.",
    },
    {
        slug: "troubleshooting",
        title: "Troubleshooting",
        summary: "The widget is not appearing, feedback is missing, notifications are quiet, and other common fixes.",
    },
];

export function getDocPage(slug: string): DocPage | undefined {
    return docsPages.find((p) => p.slug === slug);
}
