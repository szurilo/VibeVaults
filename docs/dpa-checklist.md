# Sub-processor DPA verification checklist

Companion to `docs/records-of-processing.md` section C2. The Privacy Policy (section 7) and
Terms of Service (section 11) both state that each provider is under a data processing
agreement, so this file is the evidence that the statement is true.

Checked 2026-09-01 against each vendor's current legal page.

| # | Provider | Status | Action needed |
|---|---|---|---|
| 1 | **Supabase** | Automatic | None. "This DPA is effective as of the Effective Date of the Agreement", and "acceptance of the Agreement shall have the same effect as signing the SCCs". Save a PDF of `supabase.com/legal/dpa` for your file. |
| 2 | **Vercel** | Automatic **on Pro** | None. On the **Pro plan since ~August 2026**, which is what brings it into scope: the DPA "applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans", and becomes "legally binding upon Customer entering into the Agreement". **Never downgrade to Hobby**, see below. |
| 3 | **Stripe** | Automatic | None. The DPA "forms part of the Agreement". Note Stripe is an **independent controller**, not only a processor, for fraud prevention, AML screening and its banking relationships, so that part of the flow is on Stripe's own accountability, not ours. |
| 4 | **Resend** | Automatic | None. Binding "upon Customer entering into the Agreement", effective as of "the applicable customer's acceptance of the Terms of Service". |
| 5 | **Cloudflare** | Automatic | None. The DPA is incorporated by reference into the Self-Serve Subscription Agreement where customer content includes personal data of European data subjects, and the SCCs are auto-signed on acceptance. Covers the free plan Turnstile is on. |
| 6 | **PostHog** | **ACTION REQUIRED** | Not automatic. Go to `app.posthog.com/legal`, generate and countersign the DPA, download the PDF. The version published on their website is explicitly "not binding on its own, only the one you generate and countersign through the app counts." |

---

## Why the Vercel plan is a compliance control, not a billing choice

Resolved: the team is on **Pro**. Recording the reasoning so nobody ever downgrades to save
$20 a month.

Vercel's Fair Use Guidelines: **"Hobby teams are restricted to non-commercial personal use
only. All commercial usage of the platform requires either a Pro or Enterprise plan."**
Commercial usage is defined to include "any method of requesting or processing payment from
visitors of the site" and "advertising the sale of a product or service". VibeVaults takes
Stripe subscriptions and advertises paid plans, so it is squarely commercial.

Dropping to Hobby would therefore cause two failures at once:

1. **No Article 28 contract with the provider that hosts everything.** Vercel processes
   every request, so this would be the least acceptable gap in the list, and it would make
   the sentence in the Privacy Policy asserting that every provider is under a DPA false.
2. **Breach of Vercel's own terms**, with account pause as the documented consequence. A
   pause takes the dashboard and every customer's widget offline simultaneously.

Recorded in `CLAUDE.md` under Tech Stack so it survives a future cost-cutting pass.

---

## Keeping this current

Re-verify when adding any provider (Critical Rule 15 in `CLAUDE.md`), and at the annual
ROPA review.

Saving a PDF copy of each DPA is optional and low priority. The live vendor page is fine for
day-to-day reference. The only cases where a stored copy beats a link are a dispute about
processing done under an older version of the text, and a customer's legal team asking you
to evidence all six at once during a deal. Neither is urgent; both are cheap to prepare for.
