-- Allow repeated short codes in different branches of the tree while still
-- preventing sibling collisions under the same parent location.

DROP INDEX IF EXISTS public.wl_code_unique_in_branch_idx;

CREATE UNIQUE INDEX IF NOT EXISTS wl_code_unique_in_parent_scope_idx
  ON public.warehouse_locations (
    organization_id,
    branch_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  )
  WHERE code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.warehouse_locations.code IS
  'Optional short human-readable code (e.g. MG-A-R1). Unique within the same parent scope in org+branch when set.';
