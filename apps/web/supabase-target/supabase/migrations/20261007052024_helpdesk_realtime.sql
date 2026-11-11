-- Help Desk realtime (Ambra Help Desk + Ambra Zapytania portal).
-- postgres_changes are delivered per subscriber through RLS, so a client only receives
-- changes to rows it may already read. Idempotent: adds each table once.
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY ARRAY['helpdesk_tickets', 'app_comments', 'helpdesk_ticket_activity', 'app_attachments']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
