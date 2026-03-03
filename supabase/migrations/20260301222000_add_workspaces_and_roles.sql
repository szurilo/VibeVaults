-- Create ENUM for workspace roles
CREATE TYPE public.workspace_role AS ENUM ('owner', 'member');

-- Create Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'My Workspace' NOT NULL,
    owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

-- Create Workspace Members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.workspace_role NOT NULL DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

-- Alter Projects table
ALTER TABLE public.projects 
ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Auto-create workspace for new users
CREATE OR REPLACE FUNCTION public.handle_new_workspace_for_user()
RETURNS trigger AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    -- Only create a workspace if we successfully inserted the user
    -- (The existing handle_new_user trigger creates the profile)
    
    INSERT INTO public.workspaces (name, owner_id)
    VALUES ('My Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_workspace
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_for_user();

-- Enable RLS on new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace RLS
CREATE OR REPLACE FUNCTION public.get_user_workspaces()
RETURNS SETOF uuid AS $$
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_owned_workspaces()
RETURNS SETOF uuid AS $$
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'owner';
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view workspaces they belong to" 
ON public.workspaces FOR SELECT 
USING (
    id IN (SELECT public.get_user_workspaces())
);

CREATE POLICY "Only owners can update workspaces" 
ON public.workspaces FOR UPDATE 
USING (
    owner_id = auth.uid()
);

-- Workspace Members RLS
CREATE POLICY "Users can view members of their workspaces" 
ON public.workspace_members FOR SELECT 
USING (
    workspace_id IN (SELECT public.get_user_workspaces())
);

CREATE POLICY "Workspace owners can manage members" 
ON public.workspace_members FOR ALL 
USING (
    workspace_id IN (SELECT public.get_user_owned_workspaces())
);

-----------------------------------------
-- UPDATE PROJECTS & FEEDBACKS RLS
-----------------------------------------

-- Drop old project policies
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Drop old feedback policies (except "Public can insert feedback")
DROP POLICY IF EXISTS "Users can view feedbacks for their projects" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can update feedbacks for their projects" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can delete feedbacks for their projects" ON public.feedbacks;

-- Clean up broken project_invites policy from older migration
DROP POLICY IF EXISTS "Users can manage their project invites" ON public.project_invites;

-- Add helper function for client invites (SECURITY DEFINER to prevent loops!)
CREATE OR REPLACE FUNCTION public.get_client_project_ids()
RETURNS SETOF uuid AS $$
    SELECT pi.project_id FROM public.project_invites pi
    JOIN public.profiles pr ON pr.email = pi.email
    WHERE pr.id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;


-- New Project Policies
CREATE POLICY "Workspace members and invited clients can view projects" 
ON public.projects FOR SELECT 
USING (
    workspace_id IN (SELECT public.get_user_workspaces())
    OR 
    id IN (SELECT public.get_client_project_ids())
);

CREATE POLICY "Workspace members can insert projects" 
ON public.projects FOR INSERT 
WITH CHECK (
    workspace_id IN (SELECT public.get_user_workspaces())
);

CREATE POLICY "Workspace members can update projects" 
ON public.projects FOR UPDATE 
USING (
    workspace_id IN (SELECT public.get_user_workspaces())
);

CREATE POLICY "Only workspace owners can delete projects" 
ON public.projects FOR DELETE 
USING (
    workspace_id IN (SELECT public.get_user_owned_workspaces())
);

-- Fix project_invites policy now that projects has a clean RLS
CREATE POLICY "Workspace members manage project invites" 
ON public.project_invites FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_invites.project_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);

-- New Feedback Policies
CREATE POLICY "Workspace members and clients can view feedbacks" 
ON public.feedbacks FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND (
            p.workspace_id IN (SELECT public.get_user_workspaces())
            OR 
            p.id IN (SELECT public.get_client_project_ids())
        )
    )
);

CREATE POLICY "Workspace members and clients can update feedbacks" 
ON public.feedbacks FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND (
            p.workspace_id IN (SELECT public.get_user_workspaces())
            OR 
            p.id IN (SELECT public.get_client_project_ids())
        )
    )
);

CREATE POLICY "Workspace members can delete feedbacks" 
ON public.feedbacks FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);
