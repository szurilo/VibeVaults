CREATE TABLE IF NOT EXISTS public.email_preferences (
    email text PRIMARY KEY,
    unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    notify_new_feedback boolean DEFAULT true NOT NULL,
    notify_replies boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
