ALTER TABLE projects
DROP CONSTRAINT projects_user_id_fkey;

ALTER TABLE projects
ADD CONSTRAINT projects_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
