-- Zone 3 Phase 10: inventory movement-line linkage.
--
-- Adds the single, atomic, fully-validated writer for
-- `repair_order_line_movement_links` -- attributing an already-posted,
-- real `inventory_movement_lines` row to a RepairOrderLine. This is the
-- ONLY thing this migration adds: no new table (Phase 2's link table
-- already exists), no widened RLS (the existing Phase 2 INSERT/SELECT/
-- DELETE-deny policies are untouched), no new movement type, no 201/WZ
-- seed, no reservation/allocation/container schema (all explicitly out of
-- scope for base Phase 10 -- see 03-repair-orders-implementation-plan.md
-- Phase 10 vs 10A-10F).
--
-- Deliberately NOT a table-level trigger: Phase 8/9's own pgTAP fixtures
-- (095_repair_order_lines_phase8_test.sql, 096_repair_order_provenance_
-- phase9_test.sql) already insert synthetic `repair_order_line_movement_
-- links` rows directly against arbitrary real `inventory_movement_lines`
-- rows, explicitly disclosed at the time as anticipated stand-ins because
-- "Phase 10 does not exist yet to create these through a real flow". A
-- blanket validating trigger on the table would retroactively break that
-- already-accepted, already-shipped test fixture pattern. Instead, every
-- invariant below is enforced inside this new RPC -- the intended,
-- documented write path for real attribution -- while the underlying
-- table/RLS is left exactly as Phase 2 built it. This is a disclosed,
-- deliberate scope boundary: a raw authenticated PostgREST insert against
-- the table (governed only by Phase 2's existing has_branch_permission
-- WITH CHECK) remains structurally possible and is not newly introduced or
-- widened by this migration.
create or replace function public.attach_repair_order_line_movement(
  p_actor_user_id uuid,
  p_repair_order_line_id uuid,
  p_inventory_movement_line_id uuid,
  p_applied_quantity numeric,
  p_relation_type text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ro record;
  v_ml record;
  v_existing_sum numeric;
  v_new_id uuid;
begin
  -- Actor-identity check (no spoofing p_actor_user_id) -- same pattern as
  -- materialize_repair_orders_from_session / approve_wdd_matcher_session.
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'p_actor_user_id must match the authenticated caller' using errcode = '28000';
  end if;

  if p_applied_quantity is null or p_applied_quantity <= 0 then
    raise exception 'applied_quantity must be greater than zero' using errcode = '22023';
  end if;

  -- 'reversal' is deliberately rejected here: the architecture has no
  -- defined netting/linkage semantics for it anywhere (no column says
  -- which receipt/issue a reversal reverses), so this RPC never writes an
  -- ambiguous row. 'receipt'/'issue' are the only relation types this
  -- attribution primitive can honestly produce.
  if p_relation_type not in ('receipt', 'issue') then
    raise exception 'relation_type must be receipt or issue' using errcode = '22023';
  end if;

  -- Resolve RepairOrderLine -> RepairOrder scope. Never trust a
  -- client-supplied org/branch -- always derived from the authoritative
  -- parent row, matching every other Zone 3 RPC/service method.
  select rol.id as line_id, ro.id as repair_order_id, ro.organization_id, ro.branch_id, rol.variant_id
    into v_ro
    from repair_order_lines rol
    join repair_orders ro on ro.id = rol.repair_order_id
   where rol.id = p_repair_order_line_id
     and rol.deleted_at is null
     and ro.deleted_at is null;

  if not found then
    raise exception 'RepairOrderLine not found: %', p_repair_order_line_id using errcode = 'P0002';
  end if;

  if not (
    has_branch_permission(v_ro.organization_id, v_ro.branch_id, 'warehouse.inventory.operate')
    or has_branch_permission(v_ro.organization_id, v_ro.branch_id, 'warehouse.inventory.adjust')
  ) then
    raise exception 'Not authorized to attribute inventory movements for this branch' using errcode = '42501';
  end if;

  -- Resolve + lock the target movement line (row lock serializes concurrent
  -- attribution attempts against the SAME movement line, so the
  -- applied-quantity cap check below cannot race).
  select iml.id, iml.organization_id, iml.branch_id, iml.quantity, iml.variant_id,
         imh.status, imh.reference_type, imh.reference_id, imt.category
    into v_ml
    from inventory_movement_lines iml
    join inventory_movement_headers imh on imh.id = iml.movement_id
    join inventory_movement_types imt on imt.id = imh.movement_type_id
   where iml.id = p_inventory_movement_line_id
     and iml.deleted_at is null
   for update of iml;

  if not found then
    raise exception 'Inventory movement line not found: %', p_inventory_movement_line_id using errcode = 'P0002';
  end if;

  -- Cross-tenant guard: the movement line's OWN org/branch (authoritative,
  -- never the RepairOrder's) must match the RepairOrder's org/branch.
  if v_ml.organization_id <> v_ro.organization_id or v_ml.branch_id <> v_ro.branch_id then
    raise exception 'Movement line organization/branch does not match the RepairOrder' using errcode = '42501';
  end if;

  if v_ml.status <> 'posted' then
    raise exception 'Only posted movement lines can be attributed to a RepairOrderLine' using errcode = '55000';
  end if;

  -- relation_type must match the movement's real domain category -- never
  -- inferred, always checked against the actual posted movement type.
  if (p_relation_type = 'receipt' and v_ml.category <> 'receipt')
     or (p_relation_type = 'issue' and v_ml.category <> 'issue') then
    raise exception 'relation_type % does not match movement category %', p_relation_type, v_ml.category
      using errcode = '22023';
  end if;

  -- If the movement header explicitly carries a RepairOrder reference,
  -- it must be THIS RepairOrder -- but a movement with no reference at all
  -- is not rejected (most receiving flows do not set this yet).
  if v_ml.reference_type = 'repair_order' and v_ml.reference_id is not null
     and v_ml.reference_id <> v_ro.repair_order_id::text then
    raise exception 'Movement is referenced to a different RepairOrder' using errcode = '55000';
  end if;

  -- Variant/product identity compatibility, only where the RepairOrderLine
  -- actually carries an authoritative variant_id -- never inferred from SKU
  -- text, per the central Phase 10 invariant.
  if v_ro.variant_id is not null and v_ro.variant_id <> v_ml.variant_id then
    raise exception 'Movement line product/variant does not match the RepairOrderLine''s own variant'
      using errcode = '55000';
  end if;

  -- Cardinality: one inventory_movement_line MAY be split across several
  -- RepairOrderLines (no uniqueness restriction prevents this -- verified
  -- live against the Phase 2 schema), but the sum of everything ever
  -- attributed to that one movement line, across all RepairOrderLines and
  -- relation types, must never exceed the movement line's own quantity.
  select coalesce(sum(applied_quantity), 0) into v_existing_sum
    from repair_order_line_movement_links
   where inventory_movement_line_id = p_inventory_movement_line_id;

  if v_existing_sum + p_applied_quantity > v_ml.quantity then
    raise exception 'applied_quantity exceeds the movement line''s own remaining quantity (already applied %, line quantity %)',
      v_existing_sum, v_ml.quantity using errcode = '22023';
  end if;

  insert into repair_order_line_movement_links
    (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
  values
    (p_repair_order_line_id, p_inventory_movement_line_id, p_applied_quantity, p_relation_type)
  on conflict (repair_order_line_id, inventory_movement_line_id, relation_type) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'This movement line is already attributed to this RepairOrderLine with this relation type'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'id', v_new_id,
    'repair_order_line_id', p_repair_order_line_id,
    'inventory_movement_line_id', p_inventory_movement_line_id,
    'applied_quantity', p_applied_quantity,
    'relation_type', p_relation_type
  );
end;
$$;

revoke all on function public.attach_repair_order_line_movement(uuid, uuid, uuid, numeric, text) from public;
grant execute on function public.attach_repair_order_line_movement(uuid, uuid, uuid, numeric, text) to authenticated;
