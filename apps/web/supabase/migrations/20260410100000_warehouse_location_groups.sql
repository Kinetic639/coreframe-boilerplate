/**
 * Migration: warehouse_location_groups
 *
 * Creates the warehouse_location_groups table — pure display containers that
 * group sibling locations (e.g. bays of the same rack) without being inventory
 * locations themselves.
 *
 * Also adds a nullable group_id FK on warehouse_locations.
 *
 * RLS gates on the same permissions as warehouse_locations:
 *   read  → warehouse.locations.read
 *   write → warehouse.locations.manage
 */

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.warehouse_location_groups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL CHECK (length(trim(name)) > 0),
  description     TEXT,
  color           TEXT        CHECK (color IS NULL OR color ~* '^#[0-9A-Fa-f]{6}$'),
  sort_order      INTEGER     NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by      UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.warehouse_location_groups IS
  'Display-only grouping containers for warehouse locations (e.g. bays of the same rack). Not inventory entities — no stock, QR code, or movements.';

-- ── group_id on warehouse_locations ──────────────────────────────────────────

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES public.warehouse_location_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.warehouse_locations.group_id IS
  'Optional group this location belongs to. Purely cosmetic — does not affect stock or hierarchy.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary lookup: list all active groups for a branch
CREATE INDEX wlg_org_branch_active_idx
  ON public.warehouse_location_groups(organization_id, branch_id)
  WHERE deleted_at IS NULL;

-- Sort order within a branch
CREATE INDEX wlg_branch_sort_idx
  ON public.warehouse_location_groups(branch_id, sort_order)
  WHERE deleted_at IS NULL;

-- Reverse lookup: find all locations in a group
CREATE INDEX wl_group_active_idx
  ON public.warehouse_locations(group_id)
  WHERE group_id IS NOT NULL AND deleted_at IS NULL;

-- ── Updated_at trigger ────────────────────────────────────────────────────────

CREATE TRIGGER set_warehouse_location_groups_updated_at
  BEFORE UPDATE ON public.warehouse_location_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.warehouse_location_groups ENABLE ROW LEVEL SECURITY;

-- READ: same permission as locations
CREATE POLICY wlg_select ON public.warehouse_location_groups
  FOR SELECT USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.read')
    AND deleted_at IS NULL
  );

-- CREATE: requires manage
CREATE POLICY wlg_insert ON public.warehouse_location_groups
  FOR INSERT WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- UPDATE: requires manage (both USING and WITH CHECK)
CREATE POLICY wlg_update ON public.warehouse_location_groups
  FOR UPDATE
  USING  (public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage'));

-- DELETE: blocked — use soft-delete via UPDATE (set deleted_at)
CREATE POLICY wlg_delete ON public.warehouse_location_groups
  FOR DELETE USING (false);
