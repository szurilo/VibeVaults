-- Main Responsibility: Drop overly-broad public SELECT policies on storage.objects
--   that let anonymous clients enumerate every file in the feedback-attachments
--   and workspace-logos buckets via the storage list API.
-- Sensitive Dependencies: Both buckets remain `public: true`, so file fetches via
--   the /object/public/... CDN endpoint continue to work without RLS. Server-side
--   .list() calls in upload-confirm routes use the service-role admin client and
--   bypass RLS — they are unaffected.

DROP POLICY IF EXISTS "Public read access for feedback attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
