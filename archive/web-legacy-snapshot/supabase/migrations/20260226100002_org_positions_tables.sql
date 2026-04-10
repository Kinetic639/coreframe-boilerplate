-- Migration C: Create org_positions and org_position_assignments tables
-- These are HR/labeling-only tables. They have NO connection to permissions, roles,
-- or any auth logic. Purely informational labels for org members.

-- Positions registry (org-scoped)
CREATE TABLE public.org_positions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz
);

-- Position assignments (user <-> position, optionally scoped to branch)
CREATE TABLE public.org_position_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.org_positions(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at  timestamptz,
  -- Prevent duplicate active assignments for same user+position+branch combo
  CONSTRAINT uq_position_assignment UNIQUE NULLS NOT DISTINCT (org_id, user_id, position_id, branch_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_org_positions_org_id ON public.org_positions(org_id);
CREATE INDEX idx_org_positions_active ON public.org_positions(org_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_org_pos_assignments_org_id ON public.org_position_assignments(org_id);
CREATE INDEX idx_org_pos_assignments_user_id ON public.org_position_assignments(user_id);
CREATE INDEX idx_org_pos_assignments_position_id ON public.org_position_assignments(position_id);
CREATE INDEX idx_org_pos_assignments_branch_id ON public.org_position_assignments(branch_id);
CREATE INDEX idx_org_pos_assignments_active ON public.org_position_assignments(org_id, user_id) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_position_assignments ENABLE ROW LEVEL SECURITY;

-- org_positions policies
-- SELECT: all org members can read positions
CREATE POLICY "org_members_can_read_positions"
ON public.org_positions FOR SELECT
USING (public.is_org_member(org_id) AND deleted_at IS NULL);

-- INSERT: requires members.manage
CREATE POLICY "members_manage_can_insert_position"
ON public.org_positions FOR INSERT
WITH CHECK (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
  AND deleted_at IS NULL
);

-- UPDATE: USING + WITH CHECK mirror exactly
CREATE POLICY "members_manage_can_update_position"
ON public.org_positions FOR UPDATE
USING (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
  AND deleted_at IS NULL
)
WITH CHECK (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
);

-- org_position_assignments policies
-- SELECT: all org members can read assignments
CREATE POLICY "org_members_can_read_assignments"
ON public.org_position_assignments FOR SELECT
USING (public.is_org_member(org_id) AND deleted_at IS NULL);

-- INSERT: requires members.manage
CREATE POLICY "members_manage_can_insert_assignment"
ON public.org_position_assignments FOR INSERT
WITH CHECK (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
  AND deleted_at IS NULL
);

-- UPDATE (soft-delete): USING + WITH CHECK mirror exactly
CREATE POLICY "members_manage_can_update_assignment"
ON public.org_position_assignments FOR UPDATE
USING (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
)
WITH CHECK (
  public.is_org_member(org_id)
  AND public.has_permission(org_id, 'members.manage')
);
