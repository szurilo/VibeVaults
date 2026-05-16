-- Main Responsibility: Drop the broad authenticated SELECT policy on
--   workspace-logos that 20260516000000 added. Supabase Advisor flagged it
--   because it lets any logged-in user list every workspace's logo via the
--   storage list API — broader than necessary. The policy was added as a
--   hedge against supabase-js's `upsert: true` existence-check path, but
--   the only caller (workspace-settings-card.tsx) no longer passes upsert,
--   so the upload is a pure INSERT and the existing
--   "Authenticated users can upload logos" INSERT policy is sufficient.
-- Sensitive Dependencies: Bucket stays `public: true` so logo URLs continue
--   to resolve via the /object/public/... CDN endpoint without RLS. If a
--   future feature needs authenticated reads (e.g. an admin listing UI),
--   add a narrowly-scoped policy keyed off workspace membership, not a
--   blanket bucket-wide SELECT.

DROP POLICY IF EXISTS "Authenticated users can read workspace logos" ON storage.objects;
