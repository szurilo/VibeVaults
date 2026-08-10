/**
 * Main Responsibility: Content model + data for the /compare/* SEO pages
 * (VibeVaults vs BugHerd, vs Marker.io). All page copy lives here so pages
 * stay data-driven and easy to edit without touching layout.
 * Sensitive Dependencies: Competitor pricing/features were verified from the
 * competitors' own sites in August 2026. Re-verify before major edits; the
 * comparison must stay factual (nominative fair use). Never add fabricated
 * testimonials or attributed quotes.
 */

/** A cell value: true -> check, false -> cross, string -> literal text. */
export type CompareValue = boolean | string;

export interface CompareRow {
    label: string;
    vibevaults: CompareValue;
    competitor: CompareValue;
}

export interface CompareFaq {
    question: string;
    answer: string;
}

export interface VibeWin {
    title: string;
    body: string;
}

export interface ComparisonData {
    slug: string;
    competitorName: string;
    metaTitle: string;
    metaDescription: string;
    hubBlurb: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    tldrVibe: string;
    tldrCompetitor: string;
    rows: CompareRow[];
    competitorWins: string[];
    vibevaultsWins: VibeWin[];
    faqs: CompareFaq[];
}

export const bugherdComparison: ComparisonData = {
    slug: "bugherd-alternative",
    competitorName: "BugHerd",
    metaTitle: "BugHerd Alternative for Agencies: VibeVaults vs BugHerd",
    metaDescription:
        "Looking for a BugHerd alternative? VibeVaults is a simpler, conversation-first visual feedback widget with unlimited clients on every plan from $29/mo. See the honest comparison.",
    hubBlurb:
        "A kanban bug tracker with deep integrations vs a simpler, real-time feedback widget. See where each one fits.",
    heroKicker: "VibeVaults vs BugHerd",
    heroTitle: "A simpler BugHerd alternative, built for the client conversation",
    heroSubtitle:
        "BugHerd is a mature bug tracker with a kanban board and 20+ integrations. VibeVaults takes a lighter path: a clean, real-time feedback widget your clients actually enjoy using, with unlimited clients on every plan.",
    tldrVibe:
        "You want the client-feedback conversation to happen right on the live site, in real time, with less to learn for your team and your clients, and unlimited clients at a lower price.",
    tldrCompetitor:
        "You need a kanban bug-tracker wired deeply into Jira, Trello and 20+ tools, plus extras like video feedback and a public feedback mode for anonymous visitors.",
    rows: [
        { label: "Core model", vibevaults: "Real-time chat on the live site", competitor: "Kanban / ticket board" },
        { label: "Client setup", vibevaults: "Invite link, no account, no extension", competitor: "No account; browser extension for live sites" },
        { label: "Uninvited visitors", vibevaults: "See nothing (invite-only)", competitor: "Optional public feedback mode" },
        { label: "Screenshot + browser context", vibevaults: true, competitor: true },
        { label: "Console logs captured", vibevaults: true, competitor: false },
        { label: "Works on staging / localhost / live", vibevaults: true, competitor: true },
        { label: "Native integrations (Jira, Trello, GitHub…)", vibevaults: "On roadmap", competitor: "20+ two-way" },
        { label: "Projects included", vibevaults: "30 on Pro (3 workspaces × 10); unlimited on Business", competitor: "Unlimited (all plans)" },
        { label: "Team members included", vibevaults: "10 on Pro ($49/mo)", competitor: "10 on Studio ($80/mo)" },
        { label: "Clients / reviewers", vibevaults: "Unlimited on every plan", competitor: "Unlimited on every plan" },
        { label: "Starting price", vibevaults: "$29/mo", competitor: "$50/mo" },
        { label: "Free trial", vibevaults: "14 days, no card", competitor: "7 days, no card" },
    ],
    competitorWins: [
        "20+ two-way integrations (Jira, Trello, Asana, ClickUp, GitHub, Linear, Slack) if your workflow lives in a bug tracker.",
        "A kanban task board for teams that manage feedback as a formal backlog.",
        "Extra capture modes like video feedback and inline text-edit suggestions.",
        "A public feedback mode for collecting input from any anonymous visitor (VibeVaults is invite-only by design).",
        "Years of maturity, a large user base, and an established track record.",
    ],
    vibevaultsWins: [
        {
            title: "Less to learn, for you and your clients",
            body: "VibeVaults is a focused feedback widget, not a bug tracker with a backlog to manage. Fewer screens, fewer settings, and a client experience that needs zero training. The screenshots above are the whole product, judge the simplicity for yourself.",
        },
        {
            title: "A real-time conversation, not a ticket queue",
            body: "Each piece of feedback opens a live thread on the exact spot on the site. You reply in real time inside the same widget the client is already using, so a review round feels like a chat, not a helpdesk.",
        },
        {
            title: "Unlimited clients, and cheaper for the same team",
            body: "Every plan includes unlimited clients and unlimited feedback, with no per-seat client fees. Ten team members cost $49/mo on VibeVaults Pro versus $80/mo on BugHerd Studio.",
        },
        {
            title: "No browser extension, invite-only by design",
            body: "Your clients click one invite link and start, with nothing to install. Uninvited visitors see nothing at all, so the feedback surface stays private to the people you chose.",
        },
        {
            title: "Console logs on every report",
            body: "Alongside the screenshot and browser context, VibeVaults captures the console logs on every plan, so “it’s broken” arrives with the technical detail your developers actually need.",
        },
    ],
    faqs: [
        {
            question: "Is VibeVaults a good BugHerd alternative?",
            answer: "Yes, if your priority is a simple, real-time feedback conversation with clients on live sites rather than a full kanban bug tracker. VibeVaults includes unlimited clients on every plan, needs no browser extension, and costs less for the same team size. If you depend on deep Jira/Trello integrations or a formal backlog board, BugHerd is the stronger fit.",
        },
        {
            question: "Do my clients need an account or a browser extension?",
            answer: "No. Clients click a single invite link, once per device, and the widget appears on the site. They never create an account or install an extension. Uninvited visitors see nothing, because VibeVaults is invite-only by design.",
        },
        {
            question: "Does VibeVaults integrate with Jira or Trello?",
            answer: "Not yet. Today all feedback lives in the VibeVaults dashboard where your team views, discusses, and resolves it. Native integrations are on the roadmap, and as a founding member you can tell us which one to build first. If you need two-way Jira/Trello sync today, BugHerd already offers it.",
        },
        {
            question: "Is VibeVaults cheaper than BugHerd?",
            answer: "For the same team size, yes. VibeVaults Pro is $49/month for 10 team members, versus $80/month for 10 members on BugHerd Studio, and both include unlimited clients. VibeVaults starts at $29/month. The honest tradeoff is that BugHerd offers more advanced features and integrations.",
        },
        {
            question: "Can I try VibeVaults for free?",
            answer: "Yes. Every plan starts with a 14-day free trial and no credit card required. You can have the widget live on a real project in about 30 seconds.",
        },
    ],
};

export const markerComparison: ComparisonData = {
    slug: "marker-io-alternative",
    competitorName: "Marker.io",
    metaTitle: "Marker.io Alternative for Agencies: VibeVaults vs Marker.io",
    metaDescription:
        "Looking for a Marker.io alternative? VibeVaults is a simpler, conversation-first feedback widget with unlimited clients and no page-view limits, from $29/mo. See the honest comparison.",
    hubBlurb:
        "An issue-tracker with session replay and metered plans vs a simpler widget with unlimited clients and no traffic caps.",
    heroKicker: "VibeVaults vs Marker.io",
    heroTitle: "A simpler Marker.io alternative, focused on the client conversation",
    heroSubtitle:
        "Marker.io is a powerful bug-reporting tool wired into issue trackers, with session replay and metered plans. VibeVaults keeps it light: a clean, real-time feedback widget with unlimited clients and no page-view limits.",
    tldrVibe:
        "You want a simpler, conversation-first widget with unlimited clients and feedback, no page-view caps, and a lower entry price, without the overhead of a full issue-tracker integration.",
    tldrCompetitor:
        "You need two-way sync into Jira, GitHub, GitLab and Linear, plus session replay and advanced developer tooling for a QA or product team.",
    rows: [
        { label: "Core model", vibevaults: "Real-time chat on the live site", competitor: "Issue tracker with two-way dev sync" },
        { label: "Client setup", vibevaults: "Invite link, no account, no extension", competitor: "No account; widget, extension or WP plugin" },
        { label: "Uninvited visitors", vibevaults: "See nothing (invite-only)", competitor: "Open or restricted (configurable)" },
        { label: "Screenshot + browser context", vibevaults: true, competitor: true },
        { label: "Console logs captured", vibevaults: true, competitor: "Higher tier (dev tools)" },
        { label: "Works on staging / localhost / live", vibevaults: true, competitor: true },
        { label: "Native integrations (Jira, Trello, GitHub…)", vibevaults: "On roadmap", competitor: "15+ two-way" },
        { label: "Projects included", vibevaults: "30 on Pro (3 workspaces × 10); unlimited on Business", competitor: "10 on Starter, 50 on Team" },
        { label: "Team members included", vibevaults: "10 on Pro ($49/mo)", competitor: "15 on Team ($149/mo)" },
        { label: "Clients / reviewers", vibevaults: "Unlimited on every plan", competitor: "Unlimited reporters; guests capped 10-50" },
        { label: "Starting price", vibevaults: "$29/mo", competitor: "$59/mo" },
        { label: "Free trial", vibevaults: "14 days, no card", competitor: "15 days, no card" },
    ],
    competitorWins: [
        "Two-way integrations with Jira, GitHub, GitLab, Linear, Trello and more.",
        "Session replay that records the exact user actions leading up to a bug.",
        "Advanced developer tooling, data masking, and workspace analytics.",
        "A broader, more mature feature set built for QA and product teams, not only agencies.",
    ],
    vibevaultsWins: [
        {
            title: "Less to learn, for you and your clients",
            body: "VibeVaults is a focused feedback widget, not an issue tracker with a developer toolchain to configure. Fewer screens, self-explanatory controls, and a client experience that needs zero training. Judge the simplicity from the screenshots above.",
        },
        {
            title: "A real-time conversation, not a ticket queue",
            body: "Each piece of feedback opens a live thread on the exact spot on the site. You reply in real time inside the same widget the client is already using, so a review round feels like a chat, not an issue backlog.",
        },
        {
            title: "Unlimited clients and no page-view limits",
            body: "Marker.io meters guests (10 to 50) and page views (5k to 25k per month) by plan. VibeVaults includes unlimited clients and unlimited feedback with no traffic caps, so a busy client site never forces you into a higher tier.",
        },
        {
            title: "No browser extension, invite-only by design",
            body: "Your clients click one invite link and start, with nothing to install. Uninvited visitors see nothing at all, so the feedback surface stays private to the people you chose.",
        },
        {
            title: "Console logs on every plan",
            body: "VibeVaults captures the console logs alongside the screenshot and browser context on every plan, while Marker.io gates developer tools to its higher tier.",
        },
    ],
    faqs: [
        {
            question: "Is VibeVaults a good Marker.io alternative?",
            answer: "Yes, if you want a simpler, conversation-first feedback tool with unlimited clients and no page-view caps, rather than a full issue tracker with session replay. If you need two-way Jira/GitHub sync or session replay for a QA team, Marker.io is the stronger fit.",
        },
        {
            question: "Do my clients need an account or a browser extension?",
            answer: "No. Clients click a single invite link, once per device, and the widget appears on the site. They never create an account or install an extension. Uninvited visitors see nothing, because VibeVaults is invite-only by design.",
        },
        {
            question: "Does VibeVaults have page-view or guest limits?",
            answer: "No. Every VibeVaults plan includes unlimited clients and unlimited feedback with no page-view limits. Marker.io meters both guests and monthly page views by plan, so a high-traffic client site can push you into a more expensive tier.",
        },
        {
            question: "Does VibeVaults integrate with Jira or GitHub?",
            answer: "Not yet. All feedback currently lives in the VibeVaults dashboard where your team views, discusses, and resolves it. Native integrations are on the roadmap. If you need two-way Jira or GitHub sync today, Marker.io already offers it.",
        },
        {
            question: "Can I try VibeVaults for free?",
            answer: "Yes. Every plan starts with a 14-day free trial and no credit card required. You can have the widget live on a real project in about 30 seconds.",
        },
    ],
};

export const allComparisons: ComparisonData[] = [bugherdComparison, markerComparison];
