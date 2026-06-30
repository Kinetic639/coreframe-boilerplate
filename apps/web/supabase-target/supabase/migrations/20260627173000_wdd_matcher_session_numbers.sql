-- Stable, org-scoped numbers for authenticated SVWMS matcher sessions.

ALTER TABLE public.wdd_matcher_sessions
  ADD COLUMN IF NOT EXISTS session_number text NULL;

CREATE TABLE IF NOT EXISTS public.wdd_matcher_session_number_counters (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'SVWMS',
  next_number bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT wdd_matcher_session_counter_next_positive CHECK (next_number > 0),
  CONSTRAINT wdd_matcher_session_counter_prefix_not_empty CHECK (length(trim(prefix)) > 0)
);

CREATE OR REPLACE TRIGGER wdd_matcher_session_number_counters_updated_at
  BEFORE UPDATE ON public.wdd_matcher_session_number_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wdd_matcher_session_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wdd_matcher_session_number_counters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wdd_matcher_session_number_counters_select
  ON public.wdd_matcher_session_number_counters;
CREATE POLICY wdd_matcher_session_number_counters_select
  ON public.wdd_matcher_session_number_counters
  FOR SELECT
  USING (public.has_permission(organization_id, 'wdd_matcher.read'));

WITH ranked_sessions AS (
  SELECT
    id,
    organization_id,
    row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS sequence_number
  FROM public.wdd_matcher_sessions
  WHERE session_number IS NULL
)
UPDATE public.wdd_matcher_sessions sessions
SET session_number = 'SVWMS-' || lpad(ranked_sessions.sequence_number::text, 6, '0')
FROM ranked_sessions
WHERE sessions.id = ranked_sessions.id;

CREATE UNIQUE INDEX IF NOT EXISTS wdd_matcher_sessions_org_session_number_uidx
  ON public.wdd_matcher_sessions (organization_id, session_number)
  WHERE session_number IS NOT NULL;

INSERT INTO public.wdd_matcher_session_number_counters (organization_id, next_number)
SELECT
  sessions.organization_id,
  coalesce(
    max(
      CASE
        WHEN sessions.session_number LIKE 'SVWMS-%'
          AND substring(sessions.session_number from length('SVWMS') + 2) ~ '^[0-9]+$'
          THEN substring(sessions.session_number from length('SVWMS') + 2)::bigint
        ELSE 0
      END
    ),
    0
  ) + 1 AS next_number
FROM public.wdd_matcher_sessions sessions
WHERE sessions.session_number IS NOT NULL
GROUP BY sessions.organization_id
ON CONFLICT (organization_id) DO UPDATE
SET next_number = greatest(
      public.wdd_matcher_session_number_counters.next_number,
      excluded.next_number
    ),
    updated_at = now();

CREATE OR REPLACE FUNCTION public.wdd_matcher_allocate_session_number(
  p_organization_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_counter public.wdd_matcher_session_number_counters%ROWTYPE;
  v_existing_next bigint;
  v_next bigint;
  v_session_number text;
BEGIN
  IF NOT public.has_permission(p_organization_id, 'wdd_matcher.upload') THEN
    RAISE EXCEPTION 'Missing wdd_matcher.upload permission';
  END IF;

  INSERT INTO public.wdd_matcher_session_number_counters (
    organization_id,
    created_by,
    updated_by
  )
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT *
  INTO v_counter
  FROM public.wdd_matcher_session_number_counters
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVWMS matcher session counter unavailable';
  END IF;

  SELECT coalesce(
    max(substring(sessions.session_number from length(v_counter.prefix) + 2)::bigint),
    0
  ) + 1
  INTO v_existing_next
  FROM public.wdd_matcher_sessions sessions
  WHERE sessions.organization_id = p_organization_id
    AND sessions.session_number LIKE v_counter.prefix || '-%'
    AND substring(sessions.session_number from length(v_counter.prefix) + 2) ~ '^[0-9]+$';

  v_next := greatest(v_counter.next_number, v_existing_next);
  v_session_number := v_counter.prefix || '-' || lpad(v_next::text, 6, '0');

  UPDATE public.wdd_matcher_session_number_counters
  SET next_number = v_next + 1,
      updated_by = p_actor_user_id
  WHERE organization_id = p_organization_id;

  RETURN v_session_number;
END;
$$;
