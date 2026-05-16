-- Main Responsibility: Restore an authenticated-only SELECT policy on
--   storage.objects for the workspace-logos bucket. The earlier cleanup
--   migration (20260510000000) dropped the broad "Public Access" SELECT
--   policy to prevent anonymous listing, but it also removed the path used
--   by supabase-js's storage.upload() existence check, which on some code
--   paths surfaced as opaque "Failed to upload logo" errors with no other
--   hint. Anonymous read still works through the public CDN endpoint
--   because the bucket itself is `public: true`; this policy only re-opens
--   RLS-checked SELECTs to authenticated users.
-- Sensitive Dependencies: workspace-logos bucket must remain public:true
--   for the /object/public/... endpoint to serve logo URLs without auth.
--   Anonymous listing via the storage list API stays blocked because no
--   policy grants SELECT to the anon role.

CREATE POLICY "Authenticated users can read workspace logos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'workspace-logos');
