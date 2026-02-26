CREATE TABLE IF NOT EXISTS public.project_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE(project_id, email)
);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their project invites" ON public.project_invites
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_invites.project_id AND user_id = auth.uid()
    )
);

-- Note: We do not enable public access to this table from the client side.
-- The widget API uses the service_role key to verify access context if needed, but we don't need to expose it to anon.
