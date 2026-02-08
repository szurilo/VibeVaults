-- Add share_token and is_sharing_enabled columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS is_sharing_enabled BOOLEAN DEFAULT FALSE;

-- Ensure share_token is unique
ALTER TABLE projects ADD CONSTRAINT projects_share_token_unique UNIQUE (share_token);

-- Index for faster lookup by share_token
CREATE INDEX IF NOT EXISTS projects_share_token_idx ON projects (share_token);
