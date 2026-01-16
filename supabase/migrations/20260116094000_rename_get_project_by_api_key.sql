-- Rename get_project_by_key to get_project_by_api_key
-- Drop the old function
drop function if exists get_project_by_key(text);

-- Create the new function
create or replace function get_project_by_api_key(key_param text)
returns table (name text, id uuid)
language plpgsql
security definer
as $$
begin
  return query select p.name, p.id from public.projects p where p.api_key = key_param;
end;
$$;
