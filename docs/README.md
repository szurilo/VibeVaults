# docs/

Internal operations and compliance records are **not** kept here. They live in the
private repository `szurilo/VibeVaults-internal`, because this repository is public
and those are internal operations records.

Moved there on 2026-09-08:

- `records-of-processing.md` — GDPR Art. 30 record of processing activities
- `dpa-checklist.md` — evidence that each sub-processor is under a DPA
- `data-breach-response.md` — the 72-hour breach response procedure
- `breach-register.md` — GDPR Art. 33(5) breach register

Also moved there on 2026-09-09, for a different reason — not sensitivity, just
disuse (they had stopped being run):

- `testing/manual-test-plan.md` — 122-case pre-launch manual test plan
- `testing/manual-paywall-checklist.md` — manual checklist for the workspace
  paywall, sidebar lock and switcher; its multi-account billing combinations are
  awkward to seed, so they were never automated

Neither is maintained against this code any more. The paywall behaviour that
matters is pinned by `tests/workspace-paused.spec.ts`,
`tests/paywall-lock-sync.spec.ts` and `tests/access-matrix.spec.ts`.

Customer-facing documentation is a different thing entirely and lives in
`src/app/docs/`, driven by `src/lib/docs-data.ts`.
