# Data Breach Response Procedure

Internal operations document. Not published, not customer facing.

**Owner:** József Tar (e.v.), sole responsible person. There is no team to escalate to,
so every step below is yours.

**Why this exists:** the privacy policy commits us to notifying a supervisory authority
within 72 hours (GDPR Art. 33) and affected people without undue delay where the risk is
high (Art. 34). This document is what stops that promise being improvised at 2am.

---

## 0. What counts as a personal data breach

Wider than "we got hacked". Article 4(12) covers any accidental or unlawful destruction,
loss, alteration, unauthorised disclosure of, or access to personal data. All three of
these are breaches:

- **Confidentiality** — data seen by someone who should not see it
- **Integrity** — data altered without authorisation
- **Availability** — data lost or inaccessible, including accidental deletion and
  ransomware, even if nobody ever saw it

A dropped production table with no backup is a breach. So is a digest email sent to the
wrong recipient.

---

## 1. Contain first, assess second

Before anything else, stop the bleeding. Do not spend the first hour writing notifications.

- Rotate the compromised credential (Supabase service role key, Stripe key, Resend key,
  admin password, GitHub token)
- Revoke the affected sessions or widget identities
- If a code defect is exposing data, ship the fix or roll back the deployment
- If you cannot fix it quickly, take the affected surface offline

**Preserve the evidence before it disappears.** Vercel and Supabase log retention is short
on lower plans, and the logs that prove what happened are often gone within days. Export
the relevant window to a file immediately: Vercel function logs, Supabase Postgres and
auth logs, PostHog events, Stripe events. Do this in the first hour even if you have not
yet decided whether it is a notifiable breach.

---

## 2. The fork that decides everything: are you controller or processor?

Answer this before you contact anyone. It changes who you notify.

**You are the CONTROLLER** for account data, billing data, invitee email addresses, and
your own website analytics.
→ You notify NAIH yourself within 72 hours, and affected users directly if the risk is high.

**You are the PROCESSOR** for feedback content, reply threads, attachments, and widget
metadata belonging to a customer's end users.
→ You do **not** notify NAIH for this. You notify **the affected customer** without undue
delay, and they decide about notifying the authority. Your job is to give them everything
they need to make that decision.

A single incident can be both. A leaked service role key exposes your account table
(controller) and every customer's feedback (processor). In that case you run both tracks.

---

## 3. The 72-hour clock

The clock starts when you have a **reasonable degree of certainty** that a breach has
occurred, not at the moment of first suspicion. A short initial investigation to establish
whether anything actually happened is legitimate and does not consume the clock.

Once you are reasonably certain, the clock runs continuously, including weekends.

If you cannot gather all the facts in time, **notify anyway and say so.** Article 33(4)
explicitly permits phased notification. A late complete notification is worse than a
prompt incomplete one.

---

## 4. Assess the risk

Write down, in a file, before notifying:

1. What happened, and when did it start and end
2. Which categories of personal data (emails, names, feedback content, console logs,
   authentication tokens, IP addresses)
3. Approximately how many people, and how many records
4. Whose data: your account holders, your customers' end users, or both
5. Was the data encrypted or otherwise unintelligible to the person who got it
6. What is the realistic harm: identity theft, account takeover, exposure of private
   business communications, embarrassment, nothing meaningful
7. What you have already done, and what you will do next

That list is not busywork. Items 1 to 7 are close to verbatim what Article 33(3) requires
the notification to contain, so writing them down *is* drafting the notification.

---

## 5. Notify NAIH (controller-side breaches only)

Unless the breach is unlikely to result in a risk to people's rights and freedoms. If you
decide it is unlikely, you still document the decision (see step 7).

- Filed with the Nemzeti Adatvédelmi és Információszabadság Hatóság through their incident
  reporting system. Start at **naih.hu** and confirm the current form and contact address
  at the time of filing, since these have changed before.
- Required content is the list in step 4, plus a contact point. That is you, at
  support@vibe-vaults.com.
- Keep a copy of what you submitted and the confirmation.

---

## 6. Notify the people affected

**Customers (processor-side):** without undue delay, by email, to every workspace owner
whose data was involved. Do not wait until you have the full picture. Tell them what you
know, what you do not yet know, and when you will update them. They have their own 72-hour
clock that starts when you tell them, so silence from you actively harms them.

**End users or account holders (controller-side, high risk only):** required by Article 34
when the breach is likely to result in a **high** risk to them. Write in plain language,
no legal hedging: what happened, what data, what they should do now (change password,
watch for phishing), and how to reach you.

You can skip direct notification if the data was encrypted and the key was not
compromised, if you have since taken measures that make the high risk unlikely to
materialise, or if direct contact would take disproportionate effort, in which case you
make a public statement instead.

---

## 7. Log it, even if you notified nobody

Article 33(5) requires you to document **every** personal data breach, including the ones
you assessed as not notifiable, along with the reasoning for that decision. This register
is the first thing an authority asks for, and "we decided it was low risk" without a
contemporaneous record is indistinguishable from "we did not notice".

Keep it as an append-only file. Per entry: date detected, date resolved, what happened,
data and people affected, controller or processor, notified or not, reasoning, remediation.

---

## 8. Afterwards

- Fix the root cause, not just the symptom
- Add a regression test if a code defect caused it. The access matrix and account deletion
  safety suites in `tests/` are where cross-tenant exposure belongs
- If a permission or RLS bug was involved, re-check the SECURITY DEFINER helpers
- Update this document if the procedure did not survive contact with reality

---

## Likely scenarios for this codebase, and the first move

| Scenario | Role | First action |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` leaked (commit, log, screenshot) | Both | Rotate the key in Supabase immediately, then audit Postgres logs for use of it |
| RLS regression exposes data across workspaces | Both | Roll back the deployment, then determine which workspaces were readable by whom |
| Widget token leaked or brute forced | Processor | Delete the affected `widget_identities` rows, which self-hides the widget on that device |
| Digest or notification email sent to the wrong recipient | Both | Determine what the email body actually contained before assessing risk, since `esc()` output may be less than feared |
| Storage bucket exposes attachments beyond INSERT-only policy | Processor | Re-check bucket policy, then enumerate what was reachable |
| Laptop stolen with `.env.local` on it | Controller | Rotate every key in that file: Supabase, Stripe, Resend, PostHog, Turnstile |
| Stripe account compromised | Controller | Stripe support, rotate keys, check for altered payout details |

---

## Contacts

- **Supervisory authority:** NAIH, naih.hu (confirm current filing address before use)
- **Your contact point in any notification:** support@vibe-vaults.com
- **Vendor security contacts:** each provider's status and security page. Supabase, Vercel,
  Stripe, Resend, Cloudflare, PostHog.
- **Accountant:** for any incident touching billing or invoicing records

---

*Last reviewed: September 1, 2026*
