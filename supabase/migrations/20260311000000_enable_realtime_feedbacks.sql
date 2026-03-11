-- Enable Realtime for feedbacks table so status changes stream to the widget
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;
