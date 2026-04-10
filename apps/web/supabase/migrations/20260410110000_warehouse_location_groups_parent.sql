/**
 * Migration: add parent_location_id to warehouse_location_groups
 *
 * Ties each group to a specific parent location, so groups render inline
 * within that location's children list instead of as a top-level section.
 *
 * Nullable so existing groups remain valid (they won't render inline anywhere).
 */

ALTER TABLE public.warehouse_location_groups
  ADD COLUMN IF NOT EXISTS parent_location_id UUID
    REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.warehouse_location_groups.parent_location_id IS
  'The location whose direct children this group organises. Setting this causes the group to appear inline inside that location''s children list. NULL = legacy top-level group (not rendered in the new UI).';

-- Fast lookup: find all groups for a given parent location
CREATE INDEX IF NOT EXISTS wlg_parent_location_idx
  ON public.warehouse_location_groups(parent_location_id)
  WHERE parent_location_id IS NOT NULL AND deleted_at IS NULL;
