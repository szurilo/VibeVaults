-- Drop project_invites table and its dependencies
DROP POLICY IF EXISTS "Users can manage their project invites" ON public.project_invites;
DROP TABLE IF EXISTS public.project_invites;

-- Add 'client' role to workspace_role enum
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'client';
