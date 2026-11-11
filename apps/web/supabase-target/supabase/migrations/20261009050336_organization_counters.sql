-- Per-organization numbering for Help Desk tickets (HD-000001) and Planning tasks (PT-000001).
--
-- Both used one global sequence shared by every organization (helpdesk_ticket_number_seq,
-- planning_task_number_seq): numbers had gaps whenever another organization created a ticket,
-- leaked how many tickets other tenants create, and could not be reset per organization.
-- Now each organization has its own counter per kind of number.
--
-- * organization_counters + next_organization_counter(org, key): atomic (INSERT .. ON CONFLICT
--   DO UPDATE takes the row lock), internal only (no API grants; called from SECURITY DEFINER
--   functions).
-- * Counters are seeded with the highest existing number + 1 per organization, so existing
--   numbers never repeat.
-- * helpdesk_create_ticket (both overloads) and the planning task trigger take the next
--   number from the counter. The helpdesk bodies are rewritten in place (only the nextval call
--   changes), so the rest of each function stays exactly as deployed.
-- * planning_tasks.task_number gets a per-organization unique index; the global one is dropped
--   by the follow-up migration. helpdesk_tickets is already unique per org.
-- The old sequences are left in place, unused.

CREATE TABLE public.organization_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  counter_key text NOT NULL CHECK (counter_key ~ '^[a-z_]+\.[a-z_]+$'),
  next_value bigint NOT NULL DEFAULT 1 CHECK (next_value >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, counter_key)
);

COMMENT ON TABLE public.organization_counters IS
  'Per-organization counters for user-facing numbers (helpdesk.ticket, planning.task). Use next_organization_counter().';

ALTER TABLE public.organization_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_counters FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_organization_counter(p_org uuid, p_key text)
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  INSERT INTO public.organization_counters AS c (organization_id, counter_key, next_value)
  VALUES (p_org, p_key, 2)
  ON CONFLICT (organization_id, counter_key)
  DO UPDATE SET next_value = c.next_value + 1, updated_at = now()
  RETURNING c.next_value - 1;
$$;

REVOKE ALL ON FUNCTION public.next_organization_counter(uuid, text) FROM PUBLIC, anon, authenticated;

-- Seed from existing numbers (digits at the end of the number).
INSERT INTO public.organization_counters (organization_id, counter_key, next_value)
SELECT org_id, 'helpdesk.ticket',
       COALESCE(MAX(NULLIF(substring(ticket_number FROM '(\d+)$'), '')::bigint), 0) + 1
FROM public.helpdesk_tickets
GROUP BY org_id
ON CONFLICT (organization_id, counter_key) DO NOTHING;

INSERT INTO public.organization_counters (organization_id, counter_key, next_value)
SELECT organization_id, 'planning.task',
       COALESCE(MAX(NULLIF(substring(task_number FROM '(\d+)$'), '')::bigint), 0) + 1
FROM public.planning_tasks
WHERE task_number IS NOT NULL
GROUP BY organization_id
ON CONFLICT (organization_id, counter_key) DO NOTHING;

-- Help Desk: swap the global sequence for the organization counter in both overloads.
DO $$
DECLARE
  f record;
  def text;
BEGIN
  FOR f IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'helpdesk_create_ticket'
  LOOP
    def := pg_get_functiondef(f.oid);
    IF position('nextval(''public.helpdesk_ticket_number_seq'')' IN def) = 0 THEN
      RAISE EXCEPTION 'helpdesk_create_ticket (%) does not use the global sequence as expected', f.oid::regprocedure;
    END IF;
    def := replace(def, 'nextval(''public.helpdesk_ticket_number_seq'')',
                   'public.next_organization_counter(p_org_id, ''helpdesk.ticket'')');
    EXECUTE def;
  END LOOP;
END;
$$;

-- Planning: per-organization task numbers.
CREATE OR REPLACE FUNCTION public.generate_planning_task_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.task_number IS NULL THEN
    NEW.task_number := 'PT-' || LPAD(
      public.next_organization_counter(NEW.organization_id, 'planning.task')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE UNIQUE INDEX planning_tasks_org_task_number_unique
  ON public.planning_tasks (organization_id, task_number);
-- The old global unique index is dropped in 20261009100100_drop_global_task_number_unique.sql
-- (run separately: the Supabase MCP refuses DROP statements).
