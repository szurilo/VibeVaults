-- Fix missing cascade delete on feedback_replies user_id
-- This allows users to delete their accounts even if they have replied to feedbacks.
-- Previously, the foreign key to auth.users without ON DELETE CASCADE blocked account deletion.

ALTER TABLE "public"."feedback_replies" 
DROP CONSTRAINT IF EXISTS "feedback_replies_user_id_fkey";

ALTER TABLE "public"."feedback_replies"
ADD CONSTRAINT "feedback_replies_user_id_fkey" 
FOREIGN KEY ("user_id") 
REFERENCES "auth"."users"("id") 
ON DELETE CASCADE;
