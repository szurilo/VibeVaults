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

export const userbackComparison: ComparisonData = {
    slug: "userback-alternative",
    competitorName: "Userback",
    metaTitle: "Userback Alternative for Agencies: VibeVaults vs Userback",
    metaDescription:
        "Looking for a Userback alternative? VibeVaults is a simpler, real-time, invite-only feedback widget with console logs captured on every plan. See the honest comparison.",
    hubBlurb:
        "A kanban feedback board with a free tier vs a simpler, real-time, invite-only feedback widget. See where each fits.",
    heroKicker: "VibeVaults vs Userback",
    heroTitle: "A simpler Userback alternative, built for the client conversation",
    heroSubtitle:
        "Userback is a mature feedback-management platform with a kanban board, session replay, and a free tier. VibeVaults takes a lighter path: a clean, real-time feedback widget your clients talk to you through, private to the people you invite.",
    tldrVibe:
        "You want feedback to be a real-time conversation on the live site, private to invited clients, with the technical context (screenshot, browser, console logs) captured on every plan, and less tool to learn.",
    tldrCompetitor:
        "You want a free tier to start, a kanban board to manage feedback as a backlog, session replay, a mobile SDK, and a deep set of two-way integrations.",
    rows: [
        { label: "Core model", vibevaults: "Real-time chat on the live site", competitor: "Kanban feedback board + annotations" },
        { label: "Client setup", vibevaults: "Invite link, no account, no extension", competitor: "No account; widget or browser extension" },
        { label: "Uninvited visitors", vibevaults: "See nothing (invite-only)", competitor: "Open by default; can restrict to logged-in users" },
        { label: "Screenshot + browser context", vibevaults: true, competitor: true },
        { label: "Console logs captured", vibevaults: true, competitor: "Business plan and up" },
        { label: "Works on staging / localhost / live", vibevaults: true, competitor: true },
        { label: "Native integrations (Jira, Trello, GitHub…)", vibevaults: "On roadmap", competitor: "Jira 2-way, Slack, Zapier, ClickUp" },
        { label: "Projects included", vibevaults: "30 on Pro (3 workspaces × 10); unlimited on Business", competitor: "2 to 50 by tier" },
        { label: "Team members included", vibevaults: "10 on Pro ($49/mo)", competitor: "5 on Team ($39/mo); unlimited on Business" },
        { label: "Clients / reviewers", vibevaults: "Unlimited on every plan", competitor: "Unlimited on every plan" },
        { label: "Starting price", vibevaults: "$29/mo", competitor: "$39/mo (free tier exists)" },
        { label: "Free trial", vibevaults: "14 days, no card", competitor: "Free tier + 14-day trial" },
    ],
    competitorWins: [
        "A genuinely free Forever tier to start on.",
        "Session replay and video feedback on higher plans.",
        "A kanban board for managing feedback as a formal backlog.",
        "A mobile SDK for native app feedback.",
        "Deeper two-way integrations (Jira, ClickUp, Zapier, Slack) and more overall maturity.",
    ],
    vibevaultsWins: [
        {
            title: "A real-time conversation, not a backlog board",
            body: "Each piece of feedback opens a live thread on the exact spot on the site, and you reply in real time in the same widget the client is already using. Userback organizes feedback into a kanban backlog; VibeVaults keeps it a conversation.",
        },
        {
            title: "Invite-only out of the box",
            body: "VibeVaults is invite-only by default: each client gets a per-device link, and nobody else can see the widget, with zero setup. Userback's widget is open to all visitors by default, and making it private means configuring a logged-in-only mode or SSO on a higher plan.",
        },
        {
            title: "Console logs on every plan",
            body: "Userback gates console logs and network data to its Business plan and up. VibeVaults captures the console logs alongside the screenshot and browser context on every plan, so bug reports arrive with developer context from day one.",
        },
        {
            title: "Less to learn",
            body: "VibeVaults is a focused feedback widget, not a feedback-management suite with boards, workflows, and surveys to configure. The screenshots above are the whole product, judge the simplicity yourself.",
        },
    ],
    faqs: [
        {
            question: "Is VibeVaults a good Userback alternative?",
            answer: "Yes, if you want feedback to be a real-time, invite-only conversation on the live site, with console logs captured on every plan and less tool to learn. Userback is the stronger choice if you specifically need a free tier, session replay, a kanban backlog, or a mobile SDK.",
        },
        {
            question: "Do my clients need an account or a browser extension?",
            answer: "No. Clients click a single invite link, once per device, and the widget appears on the site. They never create an account or install an extension, and uninvited visitors see nothing because VibeVaults is invite-only by design.",
        },
        {
            question: "Does VibeVaults have a free tier like Userback?",
            answer: "No, and we would rather be upfront about it. VibeVaults is paid-only, starting at $29/month with a 14-day free trial (no card). Userback has a free Forever tier, though its free plan only keeps feedback available for 7 days, while VibeVaults never limits how long your feedback stays available. If a permanent free plan is essential, Userback wins there; VibeVaults' edge is the real-time model, invite-only privacy, console logs on every plan, and feedback that never expires.",
        },
        {
            question: "Does VibeVaults capture console logs?",
            answer: "Yes, on every plan, alongside the screenshot and browser context. Userback captures console logs only on its Business plan and above.",
        },
        {
            question: "Can I try VibeVaults for free?",
            answer: "Yes. Every plan starts with a 14-day free trial and no credit card required, and you can have the widget live on a real project in about 30 seconds.",
        },
    ],
};

export const usersnapComparison: ComparisonData = {
    slug: "usersnap-alternative",
    competitorName: "Usersnap",
    metaTitle: "Usersnap Alternative for Agencies: VibeVaults vs Usersnap",
    metaDescription:
        "Looking for a Usersnap alternative? VibeVaults is a simpler, real-time, invite-only feedback widget with console logs captured on every plan. See the honest comparison.",
    hubBlurb:
        "A feedback-management platform with a public upvote board and 50+ integrations vs a simpler, real-time, invite-only widget.",
    heroKicker: "VibeVaults vs Usersnap",
    heroTitle: "A simpler Usersnap alternative, focused on the client conversation",
    heroSubtitle:
        "Usersnap is a mature feedback-management platform with a kanban board, a public upvote portal, and 50+ integrations. VibeVaults keeps it light: a real-time feedback widget, private to the clients you invite.",
    tldrVibe:
        "You want a real-time conversation on the live site, private to invited clients, with console logs on every plan, and a tool with less to configure.",
    tldrCompetitor:
        "You want a public feature-request and upvote board, micro-surveys, a mobile SDK, and 50+ integrations for a product or QA team.",
    rows: [
        { label: "Core model", vibevaults: "Real-time chat on the live site", competitor: "Kanban feedback management + public board" },
        { label: "Client setup", vibevaults: "Invite link, no account, no extension", competitor: "No account; widget or browser extension" },
        { label: "Uninvited visitors", vibevaults: "See nothing (invite-only)", competitor: "Open by default; can restrict to logged-in users" },
        { label: "Screenshot + browser context", vibevaults: true, competitor: true },
        { label: "Console logs captured", vibevaults: true, competitor: "Professional plan and up" },
        { label: "Works on staging / localhost / live", vibevaults: true, competitor: true },
        { label: "Native integrations (Jira, Trello, GitHub…)", vibevaults: "On roadmap", competitor: "Jira/Linear 2-way, Slack, 50+" },
        { label: "Projects included", vibevaults: "30 on Pro (3 workspaces × 10); unlimited on Business", competitor: "5 to 50 by tier" },
        { label: "Team members included", vibevaults: "10 on Pro ($49/mo)", competitor: "5 to 50 seats by tier" },
        { label: "Clients / reviewers", vibevaults: "Unlimited on every plan", competitor: "Unlimited on every plan" },
        { label: "Starting price", vibevaults: "$29/mo", competitor: "€49/mo" },
        { label: "Free trial", vibevaults: "14 days, no card", competitor: "Trial: 20 feedback items" },
    ],
    competitorWins: [
        "A public feature-request portal where end users upvote and vote on ideas, not just a read-only shared board.",
        "50+ integrations, including two-way Jira, Linear, and Azure DevOps.",
        "Micro-surveys and a mobile SDK.",
        "A broader, more mature feature set for product and QA teams.",
    ],
    vibevaultsWins: [
        {
            title: "A real-time conversation, not a management suite",
            body: "Each piece of feedback opens a live thread on the exact spot on the site, and you reply in real time in the same widget the client is already using. Usersnap is built to organize and route feedback; VibeVaults keeps it a direct conversation.",
        },
        {
            title: "Invite-only out of the box",
            body: "VibeVaults is invite-only by default: each client gets a per-device link and nobody else sees the widget, with zero setup. Usersnap's widget is open to everyone by default, and restricting it to logged-in users means passing user IDs in the snippet code.",
        },
        {
            title: "Console logs on every plan",
            body: "Usersnap captures console logs only on its Professional plan and up. VibeVaults captures them alongside the screenshot and browser context on every plan, so bug reports arrive with developer context from day one.",
        },
        {
            title: "Less to configure",
            body: "VibeVaults is a focused feedback widget, not a feedback-management platform with boards, surveys, and 50+ integrations to set up. Fewer moving parts for you and your clients.",
        },
    ],
    faqs: [
        {
            question: "Is VibeVaults a good Usersnap alternative?",
            answer: "Yes, if you want a real-time, invite-only feedback conversation on the live site with console logs on every plan and less to configure. Usersnap is the stronger choice if you need a public upvote board, micro-surveys, or 50+ integrations for a product or QA team.",
        },
        {
            question: "Do my clients need an account or a browser extension?",
            answer: "No. Clients click a single invite link, once per device, and the widget appears on the site. They never create an account or install an extension, and uninvited visitors see nothing because VibeVaults is invite-only by design.",
        },
        {
            question: "Does VibeVaults or Usersnap have a free tier?",
            answer: "Neither has a permanent free tier. VibeVaults offers a 14-day free trial with no credit card and with no limitations. Usersnap offers a free trial that ends after 20 feedback items and deactivates the account after 90 days if you do not upgrade.",
        },
        {
            question: "Does VibeVaults capture console logs?",
            answer: "Yes, on every plan, alongside the screenshot and browser context. Usersnap captures console logs only on its Professional plan and above.",
        },
        {
            question: "Can I try VibeVaults for free?",
            answer: "Yes. Every plan starts with a 14-day free trial and no credit card required, and you can have the widget live on a real project in about 30 seconds.",
        },
    ],
};

export const allComparisons: ComparisonData[] = [
    bugherdComparison,
    markerComparison,
    userbackComparison,
    usersnapComparison,
];
