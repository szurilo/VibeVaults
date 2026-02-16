ALTER TABLE "public"."feedbacks"
ADD COLUMN "status" "text" NOT NULL DEFAULT 'open';

ALTER TABLE "public"."feedbacks"
ADD CONSTRAINT "feedbacks_status_check" CHECK (status IN ('open', 'in progress', 'in review', 'completed'));
