# Record of Processing Activities (ROPA)

Internal document required by GDPR Article 30. **Not published.** Kept so it can be
produced on request by a supervisory authority, and updated whenever processing changes.

**Why we cannot rely on the small-organisation exemption:** Article 30(5) exempts
organisations under 250 employees, but only where the processing is occasional, poses no
risk to rights and freedoms, and involves no special categories of data. VibeVaults
processes personal data continuously as the core of the service, so the "occasional" limb
fails and the exemption does not apply.

**Two records, because we wear two hats.** Section A is the Article 30(1) record for data
we control. Section B is the Article 30(2) record for data we process on our customers'
behalf. Section C covers what is common to both.

---

## Controller identity

| | |
|---|---|
| **Name** | József Tar |
| **Legal form** | Sole trader (egyéni vállalkozó, e.v.), Hungary |
| **Registration number** | 61558557 |
| **Tax number** | 91621728-1-33 |
| **Registered seat** | Zápolya utca 16. 1/a, 2120 Dunakeszi, Hungary |
| **Contact** | support@vibe-vaults.com |
| **Data Protection Officer** | None appointed. Not required under Art. 37: core activity is not large-scale systematic monitoring, and no special categories are processed at scale. |
| **EU representative** | Not required. Established in Hungary. |

Source of truth in code: `src/lib/legal-entity.ts`.

---

# Section A. Processing as CONTROLLER

Data where we decide the purpose and means. Broadly: our own customers, not their end users.

### A1. Account creation and authentication

- **Purpose:** let customers create and access an account
- **Data subjects:** account holders (workspace owners and members)
- **Data:** email address, hashed authentication credentials, Google OAuth profile data
  (name, avatar) where Google sign-in is used, session tokens, onboarding progress
- **Legal basis:** contractual necessity, Art. 6(1)(b)
- **Recipients:** Supabase (auth and database), Vercel (hosting)
- **Retention:** for the life of the account; deleted on account deletion
- **Tables:** `profiles`, `auth.users`, `workspace_members`

### A2. Workspace, project and invitation management

- **Purpose:** operate the multi-workspace product; invite colleagues and clients
- **Data subjects:** account holders, and invitees who may never create an account
- **Data:** names, workspace and project names, website URLs, logos, invitee email
  addresses, role assignments
- **Legal basis:** contractual necessity, Art. 6(1)(b); legitimate interest, Art. 6(1)(f),
  for inviting a third party at the customer's request
- **Recipients:** Supabase, Vercel, Resend (invitation email delivery)
- **Retention:** until the workspace, project, or invitation is deleted
- **Tables:** `workspaces`, `projects`, `workspace_invites`, `workspace_members`
- **Note:** invitations deliberately do **not** pre-create an account. No `auth.users` row
  exists until the invitee actively signs in, which minimises data collected without consent.

### A3. Billing and subscription management

- **Purpose:** take payment, manage plan tier, enforce limits
- **Data subjects:** paying account holders
- **Data:** email, Stripe customer and subscription identifiers, plan tier, trial end date,
  billing status. **No card numbers are stored by us.**
- **Legal basis:** contractual necessity, Art. 6(1)(b); legal obligation, Art. 6(1)(c), for
  accounting records
- **Recipients:** Stripe, accountant, Hungarian tax authority (NAV) via invoicing
- **Retention:** account lifetime; accounting and invoicing records kept 8 years as required
  by Hungarian accounting law, which survives an erasure request
- **Status as of 2026-09-01:** no invoice has been issued yet. The 8-year retention above
  begins with the first one. Invoicing is manual via the accountant for now, and must be
  reported to NAV Online Számla.
- **Tables:** `profiles` (`stripe_*`, `subscription_tier`, `trial_ends_at`)

### A4. Notifications and transactional email

- **Purpose:** tell people about new feedback, replies, project changes, departures
- **Data subjects:** account holders and invited clients
- **Data:** email address, notification content, per-recipient email preferences, digest
  queue entries
- **Legal basis:** contractual necessity, Art. 6(1)(b), for service messages
- **Recipients:** Resend
- **Retention:** notifications until cleared or the account is deleted; digest queue rows
  until processed
- **Tables:** `notifications`, `email_preferences`, `email_digest_queue`

### A5. Product analytics and session replay

- **Purpose:** understand usage of our own website and dashboard, improve the product
- **Data subjects:** website visitors and dashboard users
- **Data:** page views, interaction events, session replays with form inputs masked,
  device and browser data, IP-derived approximate location
- **Legal basis:** **consent**, Art. 6(1)(a). Not loaded until the cookie banner is accepted.
- **Recipients:** PostHog (EU hosting, `eu.i.posthog.com`)
- **Retention:** 1 year (PostHog retention setting)
- **Withdrawal:** "Cookie preferences" link in the footer; consent state in
  `src/lib/consent.ts`

### A6. Error and crash tracking

- **Purpose:** detect and diagnose faults
- **Data subjects:** dashboard users, and end users of customers' sites where the widget
  itself crashes
- **Data:** error message and stack trace, page URL, user agent, screen size, API key of
  the affected project
- **Legal basis:** legitimate interest, Art. 6(1)(f), in a working and secure service
- **Recipients:** PostHog, Supabase
- **Retention:** reviewed and cleared periodically; not retained beyond operational need
- **Tables:** `widget_errors`

### A7. Security, abuse prevention and rate limiting

- **Purpose:** stop spam, brute force, and abuse of public endpoints
- **Data subjects:** anyone calling our API or auth endpoints
- **Data:** IP address, request counts, Turnstile verification results
- **Legal basis:** legitimate interest, Art. 6(1)(f)
- **Recipients:** Cloudflare (Turnstile), Vercel
- **Retention:** rate-limit counters are held **in application memory only and are never
  written to the database**, expiring within minutes. No IP address is persisted in
  Postgres. This is why the published 30-day IP retention figure is a ceiling rather than
  an actual storage period.

### A8. Widget access recovery

- **Purpose:** let an invited person who lost their browser storage recover their access links
- **Data subjects:** invited clients and members
- **Data:** email address submitted on the public `/access` page, IP for rate limiting
- **Legal basis:** legitimate interest, Art. 6(1)(f)
- **Recipients:** Resend
- **Retention:** not stored beyond the request; the response is deliberately generic so it
  cannot be used to test whether an address is on file

### A9. Marketing and sales outreach

- **Purpose:** contact prospective customers (small design and web agencies) about VibeVaults
- **Data subjects:** employees and owners of prospect companies who have no prior relationship
  with us
- **Data:** name, job title, business email address, employer, LinkedIn profile, notes from
  public research on the company website
- **Source:** **not collected from the data subject.** Contact details are sourced from
  Apollo and from publicly available company websites and LinkedIn profiles.
- **Legal basis:** legitimate interest, Art. 6(1)(f), in direct marketing to business
  contacts in a professional capacity. Balancing test: business contact data only, no
  personal addresses, relevance limited to people whose stated role covers buying or using
  this category of tool, and an opt-out honoured on first request.
- **ePrivacy note:** unsolicited commercial email to business contacts is permitted in
  Hungary on a legitimate-interest basis, unlike email to consumers which requires prior
  consent. Every message must still identify the sender and carry a working opt-out.
- **Recipients:** Apollo (as data source), email delivery provider used for outreach
- **Retention:** prospects are held in a CRM with a `stage` field. An objection sets the
  stage to `Closed` with a reason; Closed records are hidden from the default view, so they
  cannot be pulled into a later campaign by accident. Opt-out records are kept indefinitely
  on purpose, since the record is what prevents re-contact.
- **Non-engaging prospects are currently kept in full, with no pruning schedule** (decision
  2026-09-01). Accepted deliberately: outreach began recently, so nothing in the list is
  old enough for staleness to weaken the legitimate-interest balance yet. **Revisit at the
  annual review.** The intended approach when it matters is to minimise rather than delete:
  keep email, date contacted, and outcome, and strip the enrichment (job title, LinkedIn,
  research notes), which preserves the do-not-repeat memory while dropping the bulk of what
  is held on someone who never replied.
- **⚠ Open obligation:** because this data is **not obtained from the data subject**,
  Article 14 applies rather than Article 13. That means a prospect must be told, at the
  latest with the first communication, who we are, what data we hold, where it came from,
  the legal basis, and their right to object. In practice this is a short line in the first
  email pointing at the privacy policy. **Verify the current outreach template does this,
  and add a section to the privacy policy covering prospect data, which it does not
  currently address.**

### A10. Support correspondence

- **Purpose:** answer questions sent to support@vibe-vaults.com
- **Data:** whatever the sender includes
- **Legal basis:** legitimate interest, Art. 6(1)(f); contractual necessity where it
  concerns an existing account
- **Retention:** kept indefinitely in the mailbox, deliberately, so an old thread can be picked up if the person writes again. Deleted on request.

---

# Section B. Processing as PROCESSOR

Data belonging to our customers' end users. **Our customers determine the purpose; we act
only on their instructions**, which are constituted by these terms and their use of the
product.

**Controllers on whose behalf we process:** our account holders. We do not maintain a
separate list here; the authoritative record is the `workspaces` and `profiles` tables,
plus Stripe for paying customers.

**Instrument:** Terms of Service section 8, together with the Privacy Policy, forms the
Article 28 data processing agreement.

### B1. Feedback collection and storage

- **Categories of processing:** collection, storage, display, retrieval, deletion
- **Data subjects:** end users of our customers' websites (their clients, testers, staff)
- **Data:** feedback content, self-declared name (review links), email address, status,
  reply threads, uploaded attachments and screenshots
- **Tables:** `feedbacks`, `feedback_replies`, `feedback_attachments`

### B2. Widget session context

- **Categories of processing:** collection, storage, display
- **Data:** page URL with query string stripped client side, user agent, screen and viewport
  size, browser language, up to 50 console log entries produced by the customer's own site,
  up to 15 failed network requests, pin anchor selector and offset
- **Note on minimisation:** query strings are removed **in the browser before the record
  exists**, and email-shaped path segments are redacted, because host-site query strings
  routinely carry reset tokens and email addresses. The discarded portion never reaches our
  infrastructure. Implemented in `public/widget.js`; documented publicly at `/docs/widget-data`.

### B3. Widget identity and access tokens

- **Categories of processing:** collection, storage, authentication, revocation
- **Data:** email address, display name, per-device access token stored as a hash, device
  first-use and last-use timestamps
- **Tables:** `widget_identities`
- **Automated erasure:** a nightly job deletes identities never used and older than 30 days.
  Deleting an invitation cascade-deletes the associated identities; removing a member
  triggers revocation of theirs.

### B4. Notification delivery to the customer's people

- **Categories of processing:** transmission
- **Data:** recipient email address, feedback or reply content included in the message
- **Recipient:** Resend
- **Note:** all user content in outbound email is escaped before rendering

**Retention across Section B:** for as long as the customer keeps it. Customers delete
feedback, projects, or their whole account from the dashboard. On termination we delete or
return the data, subject to legal retention.

**Sub-processor changes:** customers receive advance notice before a new sub-processor
begins processing their data, and may object. Enforced procedurally by Critical Rule 15 in
`CLAUDE.md`.

---

# Section C. Common to both roles

## C1. Recipients and sub-processors

| Provider | Function | Role |
|---|---|---|
| Supabase | Database, authentication, file storage | Processor |
| Vercel | Hosting, serverless execution | Processor (**Pro plan**, required for the DPA to apply) |
| Stripe | Payment processing, subscription billing | Processor for some purposes, **independent controller** for fraud prevention, AML screening and its banking relationships |
| Resend | Transactional email delivery | Processor |
| Cloudflare | Turnstile anti-bot verification | Processor |
| PostHog | Product analytics, session replay, error tracking | Processor |
| Accountant / NAV | Invoicing and statutory accounting | Separate controller |

Published list: Privacy Policy section 7, Terms of Service section 11. These three lists
must be updated together.

## C2. Transfers to third countries

Several providers above are established in the United States and may process data outside
the EEA.

- **Safeguard:** European Commission Standard Contractual Clauses, incorporated through
  each provider's data processing agreement, and the EU-U.S. Data Privacy Framework where
  the provider is certified.
- **PostHog** is configured to EU hosting, so analytics data stays in the EU.
- **Verification status of each provider's DPA:** verified 2026-09-01, see
  `docs/dpa-checklist.md`. Five of six are automatic on acceptance of the vendor's terms.
  PostHog requires a countersigned DPA generated at `app.posthog.com/legal`. Vercel's
  applies only on Pro or Enterprise, which is why the Pro plan is a compliance control.

## C3. Erasure time limits, summarised

| Data | Retention |
|---|---|
| Account and profile | Life of account, deleted on account deletion |
| Feedback, replies, attachments | Until the customer deletes it |
| Accounting and invoicing records | 8 years (Hungarian accounting law) |
| Rate-limit IP data | In memory only, minutes, never persisted |
| Unused widget access tokens | Deleted automatically after 30 days |
| Notifications | Until cleared or account deletion |
| Analytics | 1 year |

## C4. Technical and organisational security measures

General description as required by Art. 30(1)(g) and 30(2)(d).

- **Transport:** TLS everywhere; the widget communicates only over HTTPS
- **Access control in the database:** PostgreSQL row level security on all tenant tables,
  with SECURITY DEFINER helper functions used to avoid recursive policy evaluation
- **Widget authorisation:** per-device opaque tokens, stored as hashes, scoped to one
  project, revocable individually and cascade-revoked when an invitation or membership ends
- **Anonymous visitors see nothing:** the widget stays hidden until a valid identity loads,
  so there is no public feedback surface to abuse
- **Session cookies:** encoded tokens-only, so OAuth profile metadata is not carried in
  cookies
- **Uploads:** presigned direct-to-storage URLs with server-side verification of actual file
  size and MIME type after upload; storage bucket policy is insert-only with no
  bucket-wide read access
- **Rate limiting:** 30 requests per minute per IP on all widget endpoints
- **Data minimisation at the point of capture:** query string stripping and email redaction
  happen in the browser, before transmission
- **Output escaping:** all user content in outbound email is escaped
- **Payment data:** never stored; handled entirely by Stripe
- **Backups:** automated database backups via GitHub Actions (`supabase-backup.yml`)
- **Change control:** migrations deploy through GitHub Actions, expand/contract pattern
  required for schema changes against live data
- **Testing:** Playwright end-to-end suite with zero retries, including an access matrix
  suite and an account deletion safety suite that specifically guard cross-tenant exposure
  and incomplete erasure
- **Secrets:** environment variables held in Vercel and GitHub, not in the repository

## C5. Review

Review at least annually, and immediately whenever a new sub-processor is added, a new
category of data is collected, or a retention period changes.

| Date | Reviewer | Change |
|---|---|---|
| 2026-09-01 | József Tar | Initial record created |
| 2026-09-01 | József Tar | Sub-processor DPAs verified against vendor legal pages; Vercel confirmed on Pro |

---

*Related internal documents: `docs/data-breach-response.md`.*
