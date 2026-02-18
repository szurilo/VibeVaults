CREATE POLICY "Users can delete feedbacks for their projects" ON "public"."feedbacks"
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM "public"."projects"
    WHERE "projects"."id" = "feedbacks"."project_id"
    AND "projects"."user_id" = "auth"."uid"()
  )
);
