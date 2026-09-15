-- Phase 10C correction: narrow raw-write boundary for RepairOrder-owned
-- containers/container-lines. The pre-existing permissive `_manage` (ALL)
-- policies on inventory_containers/inventory_container_lines are left
-- exactly as they were -- generic, non-RepairOrder-owned containers keep
-- their existing legacy client-writable behavior (ambra-location-
-- inventory.ts still depends on it). These new RESTRICTIVE policies AND on
-- top: for any row where the container declares reference_type=
-- 'repair_order', direct authenticated DML is denied entirely -- the
-- canonical Phase 10C RPCs (inventory_create_container/
-- inventory_add_to_container/inventory_remove_from_container/
-- inventory_seal_container) remain unaffected because they execute as
-- `postgres`, which has rolbypassrls=true (LIVE VERIFIED) and therefore
-- never evaluates ANY row security policy, permissive or restrictive,
-- regardless of FORCE ROW LEVEL SECURITY. `service_role` is likewise
-- rolbypassrls=true and unaffected.

CREATE POLICY inventory_containers_repair_order_write_restrict_insert
  ON public.inventory_containers
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (reference_type IS DISTINCT FROM 'repair_order');

CREATE POLICY inventory_containers_repair_order_write_restrict_update
  ON public.inventory_containers
  AS RESTRICTIVE
  FOR UPDATE
  USING (reference_type IS DISTINCT FROM 'repair_order')
  WITH CHECK (reference_type IS DISTINCT FROM 'repair_order');

CREATE POLICY inventory_containers_repair_order_write_restrict_delete
  ON public.inventory_containers
  AS RESTRICTIVE
  FOR DELETE
  USING (reference_type IS DISTINCT FROM 'repair_order');

CREATE POLICY inventory_container_lines_repair_order_write_restrict_insert
  ON public.inventory_container_lines
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.inventory_containers c
      WHERE c.id = container_id AND c.reference_type = 'repair_order'
    )
  );

CREATE POLICY inventory_container_lines_repair_order_write_restrict_update
  ON public.inventory_container_lines
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.inventory_containers c
      WHERE c.id = container_id AND c.reference_type = 'repair_order'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.inventory_containers c
      WHERE c.id = container_id AND c.reference_type = 'repair_order'
    )
  );

CREATE POLICY inventory_container_lines_repair_order_write_restrict_delete
  ON public.inventory_container_lines
  AS RESTRICTIVE
  FOR DELETE
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.inventory_containers c
      WHERE c.id = container_id AND c.reference_type = 'repair_order'
    )
  );
