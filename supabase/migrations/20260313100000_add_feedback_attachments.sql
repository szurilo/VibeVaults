-- Main Responsibility: Create feedback_attachments table and storage bucket
-- Sensitive Dependencies: References feedbacks, feedback_replies, projects tables

-- Create feedback_attachments table
CREATE TABLE IF NOT EXISTS public.feedback_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    feedback_id uuid REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    reply_id uuid REFERENCES public.feedback_replies(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    uploaded_by text NOT NULL, -- email or user_id
    created_at timestamp with time zone DEFAULT now() NOT NULL,

    -- At least one of feedback_id or reply_id should be set (enforced at app level)
    CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760), -- 10MB max
    CONSTRAINT valid_mime_type CHECK (mime_type IN (
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'
    ))
);

-- Index for fast lookups
CREATE INDEX idx_feedback_attachments_feedback_id ON public.feedback_attachments(feedback_id);
CREATE INDEX idx_feedback_attachments_reply_id ON public.feedback_attachments(reply_id);
CREATE INDEX idx_feedback_attachments_project_id ON public.feedback_attachments(project_id);

-- RLS
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;

-- Members can view attachments for projects in their workspaces
CREATE POLICY "Members can view attachments"
    ON public.feedback_attachments FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            WHERE p.workspace_id IN (SELECT get_user_workspaces())
        )
    );

-- Members can insert attachments for projects in their workspaces
CREATE POLICY "Members can insert attachments"
    ON public.feedback_attachments FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM public.projects p
            WHERE p.workspace_id IN (SELECT get_user_workspaces())
        )
    );

-- Members can delete attachments for projects in their workspaces
CREATE POLICY "Members can delete attachments"
    ON public.feedback_attachments FOR DELETE
    USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            WHERE p.workspace_id IN (SELECT get_user_workspaces())
        )
    );

-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read access for feedback attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'feedback-attachments');

CREATE POLICY "Authenticated users can upload feedback attachments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "Authenticated users can update feedback attachments"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'feedback-attachments');

CREATE POLICY "Authenticated users can delete feedback attachments"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'feedback-attachments');

-- Enable realtime for feedback_attachments (for live attachment updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_attachments;
