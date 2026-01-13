
-- Create projects table
create table public.projects (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  api_key text not null default encode(gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users(id),
  constraint projects_pkey primary key (id),
  constraint projects_api_key_key unique (api_key)
);

-- Create feedbacks table
create table public.feedbacks (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  type text not null default 'Feature',
  sender text,
  project_id uuid not null references public.projects(id) on delete cascade,
  constraint feedbacks_pkey primary key (id)
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.feedbacks enable row level security;

-- Policies for projects
create policy "Users can view their own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

-- Policies for feedbacks
-- Users can view feedbacks for their projects
create policy "Users can view feedbacks for their projects"
  on public.feedbacks
  for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = feedbacks.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Public (API) can insert feedback via API Key (handled by app logic potentially, or we allow public insert if we want to bypass app logic, but app logic validates API key usually)
-- For now, we'll allow public insert to feedbacks if they know the project_id? 
-- Actually, the API route handles the insertion using the SERVICE_ROLE or the App's context?
-- Wait, we are using Supabase Client on the server side in the API route.
-- If we use `createClient` (server), it uses the anon key by default unless we pass service role.
-- BUT the API route validates the API Key from the query param, finds the project, then inserts.
-- The API route will need to be able to insert.
-- Since the API route runs on the server, we can use the Service Role Key?
-- User didn't provide Service Role Key.
-- We can use RLS to allow "Public" insert? No, that's spammy.
-- Best approach: The App API route acts as the gatekeeper.
-- The App API route currently effectively uses "Prisma" which has full access.
-- Using Supabase Client (standard) in API route: it acts as "anon" user.
-- So we need a policy that allows "anon" to insert into feedbacks IF they provide a valid project_id?
-- OR we allow anyone to insert into feedbacks (CSRF risk?)
-- BETTER: The API route should probably use the Service Role key to bypass RLS for insertion if we want to be secure, OR we configure RLS to allow insert for anyone (since it's a feedback widget).
-- Let's go with: Allow public insert for feedbacks. The Widget is public.
create policy "Public can insert feedback"
  on public.feedbacks
  for insert
  with check (true);

-- API Key generation helper (optional, handled by default in table definition)

-- Secure function to get project details by API key (for public widget)
create or replace function get_project_by_key(key_param text)
returns table (name text, id uuid)
language plpgsql
security definer
as $$
begin
  return query select p.name, p.id from public.projects p where p.api_key = key_param;
end;
$$;
