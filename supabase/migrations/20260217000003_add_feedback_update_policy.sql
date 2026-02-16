CREATE POLICY "Users can update feedbacks for their projects" ON "public"."feedbacks"
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "public"."projects"
    WHERE "projects"."id" = "feedbacks"."project_id"
    AND "projects"."user_id" = "auth"."uid"()
  )
);
