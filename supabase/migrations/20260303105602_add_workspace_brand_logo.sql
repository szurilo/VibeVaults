-- Add brand_logo_url column to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;

-- Create storage bucket for workspace logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for workspace-logos bucket
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'workspace-logos');

-- Allow authenticated users to insert objects
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'workspace-logos');

-- Allow authenticated users to update their own objects
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'workspace-logos');

-- Allow authenticated users to delete their own objects
CREATE POLICY "Authenticated users can delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'workspace-logos');
