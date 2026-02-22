-- Enable Supabase Realtime for feedback_replies table
-- This allows subscribing to INSERT/UPDATE/DELETE events on feedback_replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_replies;
