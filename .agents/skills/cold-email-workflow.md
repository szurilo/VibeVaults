# Cold Email Personalization Workflow

Use this when József sends a batch of company URLs + Apollo contacts and asks for personalized cold emails ready to copy-paste. The goal is high-quality, personalized outreach at speed without him having to do the per-company research.

## Hard rules (do not violate)

- **No em dashes anywhere.** Not in subject, not in body, not in commentary text I write to him. Use commas, periods, colons, semicolons, parentheses, or line breaks. **Scan every draft for `—` and `–` before showing it.** See [[user-no-em-dashes]].
- **Only quote what's visibly prominent on the homepage.** Skip anything that requires reading source code, opening DevTools, or scrolling through buried subpages. If a normal visitor in 30 seconds wouldn't notice it, do not reference it.
- **Verify every specific claim by re-fetching** with a targeted extraction prompt if I am asserting names, numbers, or distinctive phrases. Generic WebFetch summaries can hallucinate. The verify-external-claims rule applies to website content too.
- **One ask per email.** Single offer (3-month Pro access as a reference customer), single CTA ("Worth 10 minutes to take a look?"). No menu of options.
- **Never lead with "free".** Not in the subject, not as the opening of the deal paragraph. Premium agencies respond to value and selection, not giveaways. The free part is compensation inside the trade, stated after the reference-customer framing.
- **Use Version B** (trade upfront) unless the user explicitly asks for Version A. Pre-agreed: case study trade has to be in the deal from day one, not introduced after they say yes.
- **Feature accuracy (do not overstate):** screenshots are **user-initiated and annotated** (the client takes one and marks the exact issue on it), NOT auto-captured. Never write "screenshots auto-captured." Browser context / metadata **is** attached automatically, that claim is accurate and fine to use.

## The standard email template (Version B)

**Subject rule: lead with the problem, never with "free".** Established agencies buy outcomes; "free" in the subject filters for bargain hunters and reads as low-value. The free Pro access is a detail inside the email, not the headline.

**Primary subject format (default):** a question naming their company.

- Where does client feedback go after launch at [Company]?

**Alternates (rotate if the question format was used recently or fits poorly):**

- Client feedback without the screenshot chaos
- UAT feedback in one thread instead of five inboxes
- A cleaner feedback loop for your client builds

**Body skeleton:**

```
Hi [Name],

[PERSONALIZED OPENER, 1-2 sentences referencing visible content from their site]

[PRODUCT DESCRIPTION, rotate V1/V2/V3]

[DEAL PARAGRAPH, rotate V1/V2/V3]

Worth 10 minutes to take a look?

Best,
József Tar
Founder, VibeVaults
vibe-vaults.com
```

## Product description variants (rotate across batch)

**V1:**

> Quick offer. I built a client feedback widget (vibe-vaults.com) that embeds with one line of JS. Clients and UAT testers submit bugs and ideas in-context, marking the exact issue on a screenshot, with browser context captured automatically. Your team replies in real time inside the same widget. Designed for the UAT and post-launch feedback phase that usually fragments across email, Slack, and random screenshots in Teams.

**V2:**

> Quick offer. I built VibeVaults (vibe-vaults.com): a feedback widget that drops onto any project with a single script tag. Clients and beta testers report bugs or ideas right inside the page, mark the issue on a screenshot, and the browser context comes attached automatically. Your team chats back in real time inside the same widget. The whole thing is built around the UAT and post-launch window, where feedback usually scatters across inboxes and Slack threads.

**V3:**

> Quick offer. My product, VibeVaults (vibe-vaults.com) is a one-line embed that turns scattered client feedback into a single thread. Bugs, ideas, and annotated screenshots come in with full browser context attached, and you respond in real time inside the widget the client is already using. Built for the messy phase right before launch and the support window after it, where most agencies lose track of who reported what.

## Deal paragraph variants (rotate independently)

**Framing rule: lead with the reference-customer selection, not with "free".** The recipient should feel picked for a launch cohort, not handed a giveaway. Free Pro access is the compensation detail, mentioned after the trade.

**V1:**

> I'm putting together a small group of reference agencies for the launch. The deal: you get full Pro access for 3 months on me, across your active client projects. In exchange, I ask for three small things along the way. Logo permission after week 1 if you find it useful, a short testimonial after month 1, and a 15-minute case study chat at month 3. I draft all of it, you approve or edit. No card, no auto-renewal, no obligation to continue past month 3.

**V2:**

> I'm collecting a handful of reference customers for the launch, and your kind of agency is exactly who I want feedback from. The trade: full Pro access for 3 months on me, and in return, logo permission at week 1 (only if you genuinely find it useful), a one-sentence quote at the end of month 1, and a quick 15-minute chat at month 3 so I can write a short case study. I prep every draft, you just approve or edit. No card on file, no auto-billing, no obligation past month 3.

**V3:**

> I'm selecting a few agencies as launch references. What you get: full Pro access for 3 months, on me, across your active projects. What I ask: logo permission week 1 (only if you want it on the landing page), a short testimonial month 1, and a 15-minute case study chat month 3. I draft everything, you approve or rewrite. No payment details, no auto-renewal, nothing forces you past month 3.

## Contact role selection

When the user provides multiple Apollo contacts, pick the best one based on the role priority list. Reference [outreach-role-priority] (in memory) for the full list. Quick rules:

- **5-20 people**: COO, Operations Director, or Founder/CEO. Skip Marketing/Design roles.
- **20-50 people**: Head of Delivery, Director of Operations, Head of Project Management. Skip CEO at this size.
- **50-150 people**: Head of Delivery, Director of Operations, Head of Product Ops, Senior PM. Skip CEO.
- **Always skip:** Marketing/Growth, Design roles (unless founder), HR, junior devs/PMs, Office Operations (admin/facilities).

If user provides contacts that all miss the priority list, flag this and suggest LinkedIn-searching for a better role.

## Personalization hierarchy

When researching a company for the personalized opener:

**Priority 1 (best):** Distinctive tagline or positioning statement visible on the homepage, used via the strength-to-pain pivot below.

**Priority 2:** Specific portfolio sector or niche the company is clearly known for (e.g. "B2B industrial," "DTC e-commerce," "healthcare apps"), or a distinctive service mix (e.g. print + signage + web under one roof).

**Priority 3:** Specific case study results visible on homepage (real numbers, not generic "increased conversions"). Reference the number, not the client it belongs to.

**Priority 4:** Their stated process or methodology, IF distinctively described (e.g. "1-week sprints," "30-day MVP method", "fixed scope").

**Do not use:**

- **Their clients' names. Never.** József is in Hungary and does not recognize most UK/US regional brands; name-dropping clients implies familiarity he does not have, and one reply asking "oh, you know [client]?" exposes the personalization as fake. Volume stats ("150+ launches") and result numbers are fine; named clients are not.
- Generic certifications (ISO, SOC 2) unless they're paired with something distinctive
- Technical metrics (PageSpeed, Lighthouse scores) unless framed as part of a broader craft story
- Phrases buried in source code but not visibly rendered
- Made-up praise ("really clean execution," "impressive portfolio") without specifics
- Anything you cannot verify with a re-fetch

**The strength-to-pain pivot (preferred opener structure, user-approved):**

The strongest openers take the company's own visible claim at face value, agree with it, then pivot their strength into the exact pain VibeVaults solves. No flattery, no criticism: "your strength creates the problem I fix."

Reference example (Toru Digital, whose tagline was "We don't just talk AI. We build it."):

> Saw Toru's positioning: "We don't just talk AI. We build it." Teams that actually ship AI features move fast, and in my experience the faster the shipping, the messier the client review rounds get.

Other applications of the same pivot:

- Fixed-scope positioning → "every messy feedback round comes straight out of your margin"
- High launch volume → "that volume only works if client review rounds are tight"
- High retention rate → "retention like that usually means the client experience during the build is taken seriously"

Aim for this structure whenever the company has a visible claim about speed, volume, scope, or client outcomes. Vary the wording per email; reuse the pattern, not the sentence.

## The fetch and verify pattern

For each company:

1. **First fetch:** Use a general "what does this company do" prompt to get the broad picture.
2. **If the summary asserts specific quotes, names, or numbers I plan to use in the email**, re-fetch with a targeted extraction prompt asking for exact phrases and what's prominently visible.
3. **Only include in the email** content I have verified via the second fetch.
4. **If nothing distinctive shows up:** Flag to user that personalization will be weak. Suggest skipping the company, or use a softer non-quote opener (e.g. acknowledging their team size and stated focus without quoting them).

## Workflow expected from the user

User sends batches of:

```
1. [Company URL] — Apollo contact: [Name] [Role], [Name] [Role], [Name] [Role]
2. [Company URL] — Apollo contact: [Name] [Role], ...
```

For each company I return:

- The best contact name from the Apollo options + brief reasoning if ambiguous
- A bucket-fit verdict (A/B/skip) with one-line reasoning
- The full personalized email ready to copy-paste
- Rotated middle paragraph (V1/V2/V3) and deal paragraph (V1/V2/V3) so no two emails in the batch are identical
- A flag if the company looks like a poor fit despite being on the list

## Assembly-line mode (high-volume, default from 2026-06-13)

The per-company artisanal flow was for learning what converts. That phase is done. The bottleneck now is throughput: József needs 8-10 sends/day, not 5-6/week. Run three batched stages, not one mixed loop.

**Stage 1 — Qualify (one weekend sitting, ~2 hrs, produces a week of fuel).**
József runs Apollo filters and pastes a raw list of 15-25 companies + their contact options. I fetch all of them (in parallel, one message), return for each: best contact, A/B/skip verdict, one-line reason. He keeps the A/B rows in his tracking sheet. No emails written yet. Goal: a backlog of 40-50 qualified companies sitting ready.

**Stage 2 — Draft (batched, 10 at a time).**
József pastes 10 qualified companies + chosen contacts in one message. I fetch all 10 in parallel and return 10 ready-to-paste emails with rotated variants. One round-trip, not ten. This is the key speed unlock: parallel fetch + batch return.

**Stage 3 — Send (daily, ~15 min).**
József pastes each into Gmail, uses Schedule Send for staggered mid-morning UK slots, logs the row in his sheet. Done for the day.

When József is in a hurry or I am unavailable, he can self-serve the opener using the formula below and skip Stage 2.

## Self-serve opener formula (so I am optional)

A usable opener in under 5 minutes without me:

1. Open the company homepage. Find one visible claim about **speed, volume, scope, or client outcomes** (a tagline, a stat, a process line).
2. Write two sentences: sentence one quotes/paraphrases their claim and agrees with it; sentence two pivots that strength into the feedback-chaos pain. (The strength-to-pain pivot.)
3. Confirm the quoted phrase is visible in the browser (desktop or mobile).
4. Paste the standard product + deal paragraphs (rotate variants) and the subject "Where does client feedback go after launch at [Company]?"

If no visible claim exists, use a soft opener naming their team size + focus, no quote.

## Signature

Always:

```
Best,
József Tar
Founder, VibeVaults
vibe-vaults.com
```

Note: the URL goes on its own line, not appended with a comma or em dash to the previous line.

## Sending guidance to remind the user about

When user is about to start sending, remind them:

- 5-10 emails per day max for a new sender (do not blast a whole batch at once)
- Send from Gmail (warm) not from vibe-vaults.com (fresh domain) until the branded domain is warmed
- Track replies in a spreadsheet: Company, Contact, Date sent, Replied (Y/N), Status
- Wait 5-7 days before any follow-up
- Do not double-message the same prospect with different versions

## Final scan before delivery

Before sending any draft to the user, run this checklist:

1. Em dashes (`—` and `–`) anywhere? Fix all.
2. Are all specific claims verified against the actual visible page content?
3. Is the personalized opener something the recipient would recognize as visible on their own site?
4. Is the body exactly the rotated variant intended, with no leftover placeholders?
5. Is the contact name correct and the role appropriate?
6. Does the signature match the standard format?
7. **Hook/body phrasing overlap?** The product paragraph already names the channels feedback scatters across ("email, Slack, screenshots in Teams" / "inboxes and Slack threads"). The opener hook must NOT repeat that channel-list phrasing. Land the pain a different way in the hook (e.g. "harder to keep all of it in one place," "lands on you from every direction," "the part that usually gets messy"). The channel list belongs in the body only.

If any answer is no, fix before showing to user.
