-- Allow workspace owners to delete their workspaces
CREATE POLICY "Only owners can delete workspaces" 
ON public.workspaces FOR DELETE 
USING (
    owner_id = auth.uid()
);
