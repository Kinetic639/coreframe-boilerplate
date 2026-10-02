-- Movement field definitions/policies were seeded once (20260626150000,
-- 20260712120000) for the organizations that existed then. An organization
-- created later got movement types but no field policies, so the movement
-- editor and the PZ import ("Movement field policy is missing for this
-- movement type") did not work for it.
--
-- inventory_seed_movement_field_policies(org) seeds the canonical set
-- (identical in every pre-existing organization) and is idempotent: it only
-- inserts what is missing and never touches customised rows. A trigger on
-- inventory_movement_types runs it whenever a 101/311/801 type is added, so
-- a new organization is complete as soon as its movement types are seeded.

CREATE OR REPLACE FUNCTION public.inventory_seed_movement_field_policies(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.inventory_movement_field_definitions (
    organization_id, field_key, field_scope, value_type, resolver_kind,
    label, label_pl, description, is_importable
  )
  SELECT p_organization_id, seed.field_key, seed.field_scope, seed.value_type, seed.resolver_kind,
         seed.label, seed.label_pl, seed.description, seed.is_importable
  FROM (
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
  WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory_movement_field_definitions d
    WHERE d.organization_id = p_organization_id
      AND d.field_key = seed.field_key
      AND d.deleted_at IS NULL
  );

  -- Policies per movement type: 101 PZ, 311 inter-branch out, 801 relocation.
  INSERT INTO public.inventory_movement_type_field_policies (
    organization_id, movement_type_id, movement_type_code, field_definition_id,
    field_key, policy, default_strategy, validation, display_order
  )
  SELECT p_organization_id, mt.id, mt.code, fd.id, seed.field_key,
         CASE mt.code WHEN '101' THEN seed.p101 WHEN '311' THEN seed.p311 ELSE seed.p801 END,
         seed.default_strategy, seed.validation, seed.display_order
  FROM (
    VALUES
      ('header.document_date', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 1),
      ('header.external_reference', 'optional', 'optional', 'optional', 'none', '{"maxLength": 200}'::jsonb, 2),
      ('header.note', 'optional', 'optional', 'optional', 'none', '{"maxLength": 2000}'::jsonb, 3),
      ('header.operation_date', 'optional', 'optional', 'optional', 'current_date', '{}'::jsonb, 4),
      ('header.reason_id', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 5),
      ('header.recipient_details', 'optional', 'required', 'forbidden', 'none', '{}'::jsonb, 6),
      ('header.recipient_name', 'optional', 'required', 'forbidden', 'none', '{}'::jsonb, 7),
      ('header.reference_id', 'system', 'system', 'system', 'none', '{}'::jsonb, 8),
      ('header.reference_type', 'system', 'system', 'system', 'none', '{}'::jsonb, 9),
      ('header.sender_details', 'optional', 'required', 'forbidden', 'none', '{}'::jsonb, 10),
      ('header.sender_name', 'optional', 'required', 'forbidden', 'none', '{}'::jsonb, 11),
      ('line.currency', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 12),
      ('line.destination_location_id', 'required', 'forbidden', 'required', 'none', '{}'::jsonb, 13),
      ('line.lot_id', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 14),
      ('line.note', 'optional', 'optional', 'optional', 'none', '{"maxLength": 500}'::jsonb, 15),
      ('line.quantity', 'required', 'required', 'required', 'none', '{"positive": true}'::jsonb, 16),
      ('line.serial_id', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 17),
      ('line.source_location_id', 'forbidden', 'required', 'required', 'none', '{}'::jsonb, 18),
      ('line.total_cost', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 19),
      ('line.unit_cost', 'optional', 'optional', 'optional', 'none', '{}'::jsonb, 20),
      ('line.unit_id', 'required', 'required', 'required', 'none', '{}'::jsonb, 21),
      ('line.variant_id', 'required', 'required', 'required', 'none', '{}'::jsonb, 22)
  ) AS seed(field_key, p101, p311, p801, default_strategy, validation, display_order)
  JOIN public.inventory_movement_types mt
    ON mt.organization_id = p_organization_id
   AND mt.code IN ('101', '311', '801')
   AND mt.deleted_at IS NULL
  JOIN public.inventory_movement_field_definitions fd
    ON fd.organization_id = p_organization_id
   AND fd.field_key = seed.field_key
   AND fd.deleted_at IS NULL
  ON CONFLICT (organization_id, movement_type_id, field_key) WHERE deleted_at IS NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_seed_movement_field_policies(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_seed_movement_field_policies(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.inventory_seed_movement_field_policies(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.inventory_movement_types_seed_field_policies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL AND NEW.code IN ('101', '311', '801') THEN
    PERFORM public.inventory_seed_movement_field_policies(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_movement_types_seed_field_policies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_movement_types_seed_field_policies() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_movement_types_seed_field_policies() FROM authenticated;

CREATE OR REPLACE TRIGGER inventory_movement_types_seed_field_policies
  AFTER INSERT ON public.inventory_movement_types
  FOR EACH ROW EXECUTE FUNCTION public.inventory_movement_types_seed_field_policies();

-- Backfill every existing organization (a no-op where already complete).
SELECT public.inventory_seed_movement_field_policies(o.id) FROM public.organizations o;
