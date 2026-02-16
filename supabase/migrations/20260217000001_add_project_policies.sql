
-- Add missing RLS policies for projects
CREATE POLICY "Users can update their own projects" ON "public"."projects" 
    FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own projects" ON "public"."projects" 
    FOR DELETE USING (("auth"."uid"() = "user_id"));
