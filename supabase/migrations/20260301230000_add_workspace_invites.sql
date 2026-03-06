-- Create Workspace Invites table for pending Team Member invitations

CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email text NOT NULL,
    role public.workspace_role NOT NULL DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE(workspace_id, email)
);

-- Enable RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspace owners can view and manage their own workspace's invites
CREATE POLICY "Workspace owners can manage invites" 
ON public.workspace_invites FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = workspace_invites.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role = 'owner'
    )
);
