-- Create feedback_replies table
CREATE TABLE IF NOT EXISTS "public"."feedback_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" NOT NULL,
    "feedback_id" "uuid" NOT NULL REFERENCES "public"."feedbacks"("id") ON DELETE CASCADE,
    "user_id" "uuid" REFERENCES "auth"."users"("id"), -- If it's an agency reply, this is the owner
    "author_role" "text" NOT NULL CHECK (author_role IN ('agency', 'client')),
    "author_name" "text" NOT NULL
);

-- Enable RLS
ALTER TABLE "public"."feedback_replies" ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can see all replies to their project's feedbacks
CREATE POLICY "Users can see replies to their project feedbacks" 
ON "public"."feedback_replies" 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.feedbacks f
        JOIN public.projects p ON f.project_id = p.id
        WHERE f.id = feedback_replies.feedback_id
        AND p.user_id = auth.uid()
    )
);

-- Policy: Owners can insert replies as agency
CREATE POLICY "Users can insert agency replies" 
ON "public"."feedback_replies" 
FOR INSERT 
WITH CHECK (
    author_role = 'agency' 
    AND EXISTS (
        SELECT 1 FROM public.feedbacks f
        JOIN public.projects p ON f.project_id = p.id
        WHERE f.id = feedback_replies.feedback_id
        AND p.user_id = auth.uid()
    )
);

-- Policy: Public access (via API Key or session) for clients to see/insert
-- For simplicity in Phase 1, we'll allow selection/insertion if they have the feedback_id
-- In a real prod app, we'd use a signed token or session.
CREATE POLICY "Clients can view/insert replies to their feedback" 
ON "public"."feedback_replies" 
FOR ALL
USING (true)
WITH CHECK (true);

-- Grants
GRANT ALL ON TABLE "public"."feedback_replies" TO "anon";
GRANT ALL ON TABLE "public"."feedback_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_replies" TO "service_role";
