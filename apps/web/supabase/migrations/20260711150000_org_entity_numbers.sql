-- ============================================================================
-- Organization Entity Numbers
-- ============================================================================
-- Purpose:
-- - Keep CRM party numbers and branch numbers in one org-wide number space.
-- - Preserve existing crm_parties.counterparty_number values.
-- - Backfill branches with the next free numbers per organization.
-- - Prevent future collisions such as branch #6 and kontrahent #6.

CREATE TABLE IF NOT EXISTS public.organization_entity_number_sequences (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  next_value integer NOT NULL DEFAULT 1 CHECK (next_value > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_entity_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('branch', 'crm_party')),
  entity_id uuid NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number),
  UNIQUE (organization_id, entity_type, entity_id)
);

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS branch_number integer CHECK (branch_number > 0);

CREATE INDEX IF NOT EXISTS organization_entity_numbers_org_entity_idx
  ON public.organization_entity_numbers (organization_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS organization_entity_numbers_org_number_idx
  ON public.organization_entity_numbers (organization_id, number);

CREATE INDEX IF NOT EXISTS branches_org_branch_number_idx
  ON public.branches (organization_id, branch_number)
  WHERE deleted_at IS NULL;

-- Register existing CRM party numbers first so they keep their current values.
INSERT INTO public.organization_entity_numbers (
  organization_id,
  entity_type,
  entity_id,
  number
)
SELECT
  p.organization_id,
  'crm_party',
  p.id,
  p.counterparty_number
FROM public.crm_parties p
ON CONFLICT (organization_id, entity_type, entity_id) DO UPDATE
SET
  number = EXCLUDED.number,
  updated_at = now();

-- Existing branches receive numbers after the highest existing CRM number in
-- their organization. This preserves kontrahent numbers and avoids collisions.
WITH numbered_branches AS (
  SELECT
    b.id,
    b.organization_id,
    COALESCE(MAX(en.number) OVER (PARTITION BY b.organization_id), 0)
      + ROW_NUMBER() OVER (
          PARTITION BY b.organization_id
          ORDER BY b.created_at NULLS LAST, b.id
        ) AS assigned_number
  FROM public.branches b
  LEFT JOIN public.organization_entity_numbers en
    ON en.organization_id = b.organization_id
  WHERE b.branch_number IS NULL
)
UPDATE public.branches b
SET branch_number = nb.assigned_number
FROM numbered_branches nb
WHERE b.id = nb.id;

INSERT INTO public.organization_entity_numbers (
  organization_id,
  entity_type,
  entity_id,
  number
)
SELECT
  b.organization_id,
  'branch',
  b.id,
  b.branch_number
FROM public.branches b
WHERE b.branch_number IS NOT NULL
ON CONFLICT (organization_id, entity_type, entity_id) DO UPDATE
SET
  number = EXCLUDED.number,
  updated_at = now();

ALTER TABLE public.branches
  ALTER COLUMN branch_number SET NOT NULL;

ALTER TABLE public.branches
  DROP CONSTRAINT IF EXISTS branches_org_branch_number_unique;

ALTER TABLE public.branches
  ADD CONSTRAINT branches_org_branch_number_unique UNIQUE (organization_id, branch_number);

INSERT INTO public.organization_entity_number_sequences (organization_id, next_value)
SELECT
  o.id,
  COALESCE(MAX(en.number), 0) + 1
FROM public.organizations o
LEFT JOIN public.organization_entity_numbers en
  ON en.organization_id = o.id
GROUP BY o.id
ON CONFLICT (organization_id) DO UPDATE
SET
  next_value = GREATEST(
    public.organization_entity_number_sequences.next_value,
    EXCLUDED.next_value
  ),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.reserve_organization_entity_number(
  org_id uuid,
  entity_type text,
  entity_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_number integer;
  candidate integer;
BEGIN
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  IF entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity id is required';
  END IF;

  IF entity_type NOT IN ('branch', 'crm_party') THEN
    RAISE EXCEPTION 'Unsupported entity type: %', entity_type;
  END IF;

  IF NOT public.is_org_member(org_id) THEN
    RAISE EXCEPTION 'Not an organization member';
  END IF;

  SELECT number
  INTO existing_number
  FROM public.organization_entity_numbers
  WHERE organization_id = org_id
    AND organization_entity_numbers.entity_type = reserve_organization_entity_number.entity_type
    AND organization_entity_numbers.entity_id = reserve_organization_entity_number.entity_id;

  IF existing_number IS NOT NULL THEN
    RETURN existing_number;
  END IF;

  INSERT INTO public.organization_entity_number_sequences (organization_id, next_value)
  VALUES (org_id, 1)
  ON CONFLICT (organization_id) DO NOTHING;

  LOOP
    SELECT next_value
    INTO candidate
    FROM public.organization_entity_number_sequences
    WHERE organization_id = org_id
    FOR UPDATE;

    UPDATE public.organization_entity_number_sequences
    SET next_value = candidate + 1,
        updated_at = now()
    WHERE organization_id = org_id;

    BEGIN
      INSERT INTO public.organization_entity_numbers (
        organization_id,
        entity_type,
        entity_id,
        number
      )
      VALUES (org_id, entity_type, entity_id, candidate);

      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN
      -- A manually/backfilled value may already own this number. Advance and retry.
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_organization_entity_number(
  org_id uuid,
  entity_type text,
  entity_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF org_id IS NULL OR entity_id IS NULL THEN
    RETURN;
  END IF;

  IF entity_type NOT IN ('branch', 'crm_party') THEN
    RAISE EXCEPTION 'Unsupported entity type: %', entity_type;
  END IF;

  IF NOT public.is_org_member(org_id) THEN
    RAISE EXCEPTION 'Not an organization member';
  END IF;

  DELETE FROM public.organization_entity_numbers en
  WHERE en.organization_id = org_id
    AND en.entity_type = release_organization_entity_number.entity_type
    AND en.entity_id = release_organization_entity_number.entity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_crm_counterparty_number(org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate integer;
BEGIN
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  IF NOT public.is_org_member(org_id) THEN
    RAISE EXCEPTION 'Not an organization member';
  END IF;

  INSERT INTO public.organization_entity_number_sequences (organization_id, next_value)
  VALUES (org_id, 1)
  ON CONFLICT (organization_id) DO NOTHING;

  LOOP
    SELECT next_value
    INTO candidate
    FROM public.organization_entity_number_sequences
    WHERE organization_id = org_id
    FOR UPDATE;

    UPDATE public.organization_entity_number_sequences
    SET next_value = candidate + 1,
        updated_at = now()
    WHERE organization_id = org_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.organization_entity_numbers en
      WHERE en.organization_id = org_id
        AND en.number = candidate
    ) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_organization_entity_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entity_type text;
  v_number integer;
BEGIN
  IF TG_TABLE_NAME = 'branches' THEN
    v_entity_type := 'branch';
    v_number := NEW.branch_number;
  ELSIF TG_TABLE_NAME = 'crm_parties' THEN
    v_entity_type := 'crm_party';
    v_number := NEW.counterparty_number;
  ELSE
    RAISE EXCEPTION 'Unsupported table for entity number sync: %', TG_TABLE_NAME;
  END IF;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Entity number is required';
  END IF;

  INSERT INTO public.organization_entity_numbers (
    organization_id,
    entity_type,
    entity_id,
    number
  )
  VALUES (
    NEW.organization_id,
    v_entity_type,
    NEW.id,
    v_number
  )
  ON CONFLICT (organization_id, entity_type, entity_id) DO UPDATE
  SET
    number = EXCLUDED.number,
    updated_at = now();

  INSERT INTO public.organization_entity_number_sequences (organization_id, next_value)
  VALUES (NEW.organization_id, v_number + 1)
  ON CONFLICT (organization_id) DO UPDATE
  SET
    next_value = GREATEST(
      public.organization_entity_number_sequences.next_value,
      EXCLUDED.next_value
    ),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS branches_sync_entity_number ON public.branches;
CREATE TRIGGER branches_sync_entity_number
  AFTER INSERT OR UPDATE OF branch_number ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_entity_number();

DROP TRIGGER IF EXISTS crm_parties_sync_entity_number ON public.crm_parties;
CREATE TRIGGER crm_parties_sync_entity_number
  AFTER INSERT OR UPDATE OF counterparty_number ON public.crm_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_entity_number();

ALTER TABLE public.organization_entity_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entity_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entity_number_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entity_numbers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_entity_number_sequences_select_member
  ON public.organization_entity_number_sequences;
CREATE POLICY organization_entity_number_sequences_select_member
  ON public.organization_entity_number_sequences
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS organization_entity_numbers_select_member
  ON public.organization_entity_numbers;
CREATE POLICY organization_entity_numbers_select_member
  ON public.organization_entity_numbers
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS organization_entity_numbers_insert_deny
  ON public.organization_entity_numbers;
CREATE POLICY organization_entity_numbers_insert_deny
  ON public.organization_entity_numbers
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS organization_entity_numbers_update_deny
  ON public.organization_entity_numbers;
CREATE POLICY organization_entity_numbers_update_deny
  ON public.organization_entity_numbers
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS organization_entity_numbers_delete_deny
  ON public.organization_entity_numbers;
CREATE POLICY organization_entity_numbers_delete_deny
  ON public.organization_entity_numbers
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.organization_entity_number_sequences TO authenticated;
GRANT SELECT ON public.organization_entity_numbers TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_organization_entity_number(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_organization_entity_number(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_crm_counterparty_number(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reserve_organization_entity_number(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_organization_entity_number(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_crm_counterparty_number(uuid) FROM PUBLIC;

COMMENT ON TABLE public.organization_entity_numbers IS
  'Org-wide visible number registry for branch and CRM party numbers. Enforces no collisions inside an organization.';
COMMENT ON COLUMN public.branches.branch_number IS
  'Plain integer branch number from the shared organization entity number space.';
COMMENT ON COLUMN public.crm_parties.counterparty_number IS
  'Plain integer kontrahent number from the shared organization entity number space.';
