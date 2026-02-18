ALTER TABLE "public"."feedbacks"
ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
