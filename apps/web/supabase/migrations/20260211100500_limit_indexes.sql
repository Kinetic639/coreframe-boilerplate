-- =====================================================
-- MIGRATION 6: PARTIAL INDEXES FOR DERIVED COUNT QUERIES
-- Purpose: Optimize SELECT count(id) FROM table
--          WHERE organization_id = ? AND deleted_at IS NULL
-- These indexes support the limit enforcement system.
-- =====================================================

-- Products: warehouse.max_products
-- Table: public.products (columns: id, organization_id, deleted_at — verified)
CREATE INDEX IF NOT EXISTS idx_products_org_not_deleted
  ON public.products(organization_id) WHERE deleted_at IS NULL;

-- Locations: warehouse.max_locations
-- Table: public.locations (columns: id, organization_id, branch_id, deleted_at — verified)
CREATE INDEX IF NOT EXISTS idx_locations_org_not_deleted
  ON public.locations(organization_id) WHERE deleted_at IS NULL;

-- Branches: warehouse.max_branches
-- Table: public.branches (columns: id, organization_id, deleted_at — verified)
CREATE INDEX IF NOT EXISTS idx_branches_org_not_deleted
  ON public.branches(organization_id) WHERE deleted_at IS NULL;

-- Organization members: organization.max_users
-- Table: public.organization_members (columns: id, organization_id, user_id, status, deleted_at — verified)
-- Filter matches is_org_member(): status = 'active' AND deleted_at IS NULL
-- DO NOT use user_role_assignments — it has no organization_id column.
CREATE INDEX IF NOT EXISTS idx_org_members_org_active
  ON public.organization_members(organization_id)
  WHERE status = 'active' AND deleted_at IS NULL;
