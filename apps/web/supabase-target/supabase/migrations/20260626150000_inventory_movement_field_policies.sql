-- Enterprise movement field policy system.
-- DB policy is the source of truth for manual movement entry and import preview.

CREATE TABLE IF NOT EXISTS public.inventory_movement_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_scope text NOT NULL CHECK (field_scope IN ('header', 'line')),
  value_type text NOT NULL CHECK (
    value_type IN ('text', 'uuid', 'number', 'date', 'jsonb', 'money', 'currency')
  ),
  resolver_kind text NULL CHECK (
    resolver_kind IS NULL OR resolver_kind IN (
      'product_variant',
      'unit',
      'warehouse_location',
      'movement_reason',
      'party'
    )
  ),
  label text NOT NULL,
  label_pl text NULL,
  description text NULL,
  is_importable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_field_definitions_org_key_active_uidx
  ON public.inventory_movement_field_definitions (organization_id, field_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_field_definitions_org_scope_idx
  ON public.inventory_movement_field_definitions (organization_id, field_scope)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_movement_type_field_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  movement_type_id uuid NOT NULL REFERENCES public.inventory_movement_types(id) ON DELETE CASCADE,
  movement_type_code text NOT NULL,
  field_definition_id uuid NOT NULL REFERENCES public.inventory_movement_field_definitions(id) ON DELETE RESTRICT,
  field_key text NOT NULL,
  policy text NOT NULL CHECK (policy IN ('required', 'optional', 'system', 'forbidden', 'hidden')),
  default_strategy text NULL CHECK (
    default_strategy IS NULL OR default_strategy IN ('none', 'active_branch', 'current_user', 'current_date', 'literal')
  ),
  default_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_type_field_policies_type_key_active_uidx
  ON public.inventory_movement_type_field_policies (organization_id, movement_type_id, field_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_type_field_policies_org_code_idx
  ON public.inventory_movement_type_field_policies (organization_id, movement_type_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_type_field_policies_definition_idx
  ON public.inventory_movement_type_field_policies (field_definition_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_movement_headers
  ADD COLUMN IF NOT EXISTS sender_name text NULL,
  ADD COLUMN IF NOT EXISTS sender_details jsonb NULL,
  ADD COLUMN IF NOT EXISTS recipient_name text NULL,
  ADD COLUMN IF NOT EXISTS recipient_details jsonb NULL;

COMMENT ON COLUMN public.inventory_movement_headers.sender_name IS 'Movement sender name, equivalent to Polish nadawca.';
COMMENT ON COLUMN public.inventory_movement_headers.sender_details IS 'Movement sender details object.';
COMMENT ON COLUMN public.inventory_movement_headers.recipient_name IS 'Movement recipient name, equivalent to Polish odbiorca.';
COMMENT ON COLUMN public.inventory_movement_headers.recipient_details IS 'Movement recipient details object.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movement_headers'
      AND column_name = 'counterparty_name'
  ) THEN
    EXECUTE $sql$
      UPDATE public.inventory_movement_headers
      SET sender_name = COALESCE(sender_name, counterparty_name)
      WHERE sender_name IS NULL
        AND counterparty_name IS NOT NULL
        AND movement_type_code = '101'
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movement_headers'
      AND column_name = 'counterparty_details'
  ) THEN
    EXECUTE $sql$
      UPDATE public.inventory_movement_headers
      SET sender_details = COALESCE(sender_details, counterparty_details)
      WHERE sender_details IS NULL
        AND counterparty_details IS NOT NULL
        AND movement_type_code = '101'
    $sql$;
  END IF;
END $$;

INSERT INTO public.inventory_movement_field_definitions (
  organization_id,
  field_key,
  field_scope,
  value_type,
  resolver_kind,
  label,
  label_pl,
  description,
  is_importable
)
SELECT o.id, seed.field_key, seed.field_scope, seed.value_type, seed.resolver_kind,
       seed.label, seed.label_pl, seed.description, seed.is_importable
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('header.sender_name', 'header', 'text', 'party', 'Sender name', 'Nadawca', 'Name of the movement sender.', true),
    ('header.sender_details', 'header', 'jsonb', 'party', 'Sender details', 'Dane nadawcy', 'Structured sender details.', true),
    ('header.recipient_name', 'header', 'text', 'party', 'Recipient name', 'Odbiorca', 'Name of the movement recipient.', true),
    ('header.recipient_details', 'header', 'jsonb', 'party', 'Recipient details', 'Dane odbiorcy', 'Structured recipient details.', true),
    ('header.external_reference', 'header', 'text', NULL, 'External reference', 'Numer zewnetrzny', 'External document or source reference.', true),
    ('header.note', 'header', 'jsonb', NULL, 'Note', 'Notatka', 'Movement note.', true),
    ('header.reason_id', 'header', 'uuid', 'movement_reason', 'Reason', 'Powod', 'Movement reason.', true),
    ('header.reference_type', 'header', 'text', NULL, 'Reference type', 'Typ referencji', 'System reference type.', false),
    ('header.reference_id', 'header', 'uuid', NULL, 'Reference id', 'Id referencji', 'System reference id.', false),
    ('header.operation_date', 'header', 'date', NULL, 'Operation date', 'Data operacji', 'Date when the movement is operated.', true),
    ('header.document_date', 'header', 'date', NULL, 'Document date', 'Data dokumentu', 'Date assigned to the document.', true),
    ('line.variant_id', 'line', 'uuid', 'product_variant', 'Product variant', 'Wariant produktu', 'Movement line product variant.', true),
    ('line.unit_id', 'line', 'uuid', 'unit', 'Unit', 'Jednostka', 'Movement line unit.', true),
    ('line.quantity', 'line', 'number', NULL, 'Quantity', 'Ilosc', 'Movement line quantity.', true),
    ('line.source_location_id', 'line', 'uuid', 'warehouse_location', 'Source location', 'Lokalizacja zrodlowa', 'Location stock moves from.', true),
    ('line.destination_location_id', 'line', 'uuid', 'warehouse_location', 'Destination location', 'Lokalizacja docelowa', 'Location stock moves to.', true),
    ('line.lot_id', 'line', 'uuid', NULL, 'Lot', 'Partia', 'Tracked lot id.', true),
    ('line.serial_id', 'line', 'uuid', NULL, 'Serial', 'Numer seryjny', 'Tracked serial id.', true),
    ('line.unit_cost', 'line', 'money', NULL, 'Unit cost', 'Koszt jednostkowy', 'Line unit cost.', true),
    ('line.total_cost', 'line', 'money', NULL, 'Total cost', 'Koszt laczny', 'Line total cost.', true),
    ('line.currency', 'line', 'currency', NULL, 'Currency', 'Waluta', 'Cost currency.', true),
    ('line.note', 'line', 'text', NULL, 'Line note', 'Notatka pozycji', 'Line note.', true)
) AS seed(field_key, field_scope, value_type, resolver_kind, label, label_pl, description, is_importable)
ON CONFLICT (organization_id, field_key) WHERE deleted_at IS NULL DO UPDATE
SET field_scope = EXCLUDED.field_scope,
    value_type = EXCLUDED.value_type,
    resolver_kind = EXCLUDED.resolver_kind,
    label = EXCLUDED.label,
    label_pl = EXCLUDED.label_pl,
    description = EXCLUDED.description,
    is_importable = EXCLUDED.is_importable,
    is_active = true,
    updated_at = now();

WITH seeded AS (
  SELECT
    mt.organization_id,
    mt.id AS movement_type_id,
    mt.code AS movement_type_code,
    fd.id AS field_definition_id,
    fd.field_key,
    CASE
      WHEN fd.field_key IN ('line.variant_id', 'line.unit_id', 'line.quantity') THEN 'required'
      WHEN fd.field_key = 'line.source_location_id' AND mt.requires_source_location THEN 'required'
      WHEN fd.field_key = 'line.source_location_id' THEN 'forbidden'
      WHEN fd.field_key = 'line.destination_location_id' AND mt.requires_destination_location THEN 'required'
      WHEN fd.field_key = 'line.destination_location_id' THEN 'forbidden'
      WHEN fd.field_key = 'header.external_reference' AND mt.requires_reference THEN 'required'
      WHEN fd.field_key = 'header.note' AND mt.requires_note THEN 'required'
      WHEN mt.code = '101' AND fd.field_key IN (
        'header.sender_name',
        'header.sender_details',
        'header.recipient_name',
        'header.recipient_details'
      ) THEN 'optional'
      WHEN mt.code = '801' AND fd.field_key IN (
        'header.sender_name',
        'header.sender_details',
        'header.recipient_name',
        'header.recipient_details'
      ) THEN 'forbidden'
      WHEN fd.field_key IN ('header.reference_type', 'header.reference_id') THEN 'system'
      ELSE 'optional'
    END AS policy,
    CASE
      WHEN fd.field_key = 'header.operation_date' THEN 'current_date'
      ELSE 'none'
    END AS default_strategy,
    CASE
      WHEN fd.field_key = 'line.quantity' THEN '{"positive": true}'::jsonb
      WHEN fd.field_key = 'header.external_reference' THEN '{"maxLength": 200}'::jsonb
      WHEN fd.field_key = 'header.note' THEN '{"maxLength": 2000}'::jsonb
      WHEN fd.field_key = 'line.note' THEN '{"maxLength": 500}'::jsonb
      ELSE '{}'::jsonb
    END AS validation,
    row_number() OVER (PARTITION BY mt.id ORDER BY fd.field_scope, fd.field_key)::integer AS display_order
  FROM public.inventory_movement_types mt
  JOIN public.inventory_movement_field_definitions fd
    ON fd.organization_id = mt.organization_id
   AND fd.deleted_at IS NULL
  WHERE mt.deleted_at IS NULL
)
INSERT INTO public.inventory_movement_type_field_policies (
  organization_id,
  movement_type_id,
  movement_type_code,
  field_definition_id,
  field_key,
  policy,
  default_strategy,
  validation,
  display_order
)
SELECT
  organization_id,
  movement_type_id,
  movement_type_code,
  field_definition_id,
  field_key,
  policy,
  default_strategy,
  validation,
  display_order
FROM seeded
ON CONFLICT (organization_id, movement_type_id, field_key) WHERE deleted_at IS NULL DO UPDATE
SET movement_type_code = EXCLUDED.movement_type_code,
    field_definition_id = EXCLUDED.field_definition_id,
    policy = EXCLUDED.policy,
    default_strategy = EXCLUDED.default_strategy,
    validation = EXCLUDED.validation,
    display_order = EXCLUDED.display_order,
    updated_at = now();

ALTER TABLE public.inventory_movement_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_field_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_type_field_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_type_field_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movement_field_definitions_select ON public.inventory_movement_field_definitions;
CREATE POLICY inventory_movement_field_definitions_select
  ON public.inventory_movement_field_definitions FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.inventory.read')
      OR public.has_permission(organization_id, 'warehouse.inventory.operate')
      OR public.has_permission(organization_id, 'warehouse.imports.manage')
    )
  );

DROP POLICY IF EXISTS inventory_movement_field_definitions_manage ON public.inventory_movement_field_definitions;
CREATE POLICY inventory_movement_field_definitions_manage
  ON public.inventory_movement_field_definitions FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.inventory.operate'));

DROP POLICY IF EXISTS inventory_movement_type_field_policies_select ON public.inventory_movement_type_field_policies;
CREATE POLICY inventory_movement_type_field_policies_select
  ON public.inventory_movement_type_field_policies FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.inventory.read')
      OR public.has_permission(organization_id, 'warehouse.inventory.operate')
      OR public.has_permission(organization_id, 'warehouse.imports.manage')
    )
  );

DROP POLICY IF EXISTS inventory_movement_type_field_policies_manage ON public.inventory_movement_type_field_policies;
CREATE POLICY inventory_movement_type_field_policies_manage
  ON public.inventory_movement_type_field_policies FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.inventory.operate'));

DROP TRIGGER IF EXISTS inventory_movement_field_definitions_set_updated_at
  ON public.inventory_movement_field_definitions;
CREATE TRIGGER inventory_movement_field_definitions_set_updated_at
  BEFORE UPDATE ON public.inventory_movement_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS inventory_movement_type_field_policies_set_updated_at
  ON public.inventory_movement_type_field_policies;
CREATE TRIGGER inventory_movement_type_field_policies_set_updated_at
  BEFORE UPDATE ON public.inventory_movement_type_field_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
