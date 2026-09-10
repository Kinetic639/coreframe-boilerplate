-- =============================================================================
-- Migration: repair_orders_status_archived -- correct RepairOrder status model
-- Date:      2026-09-10
-- =============================================================================
-- Forward migration correcting 20260910061711_repair_orders_core_schema.sql,
-- which is already applied live and is therefore never edited in place.
--
-- Accepted product decision (2026-09-10 correction pass):
--   repair_orders.status must support open / closed / archived, not just
--   open / closed. No additional states (in_progress, cancelled, completed)
--   are introduced -- RepairOrder lifecycle is intentionally simple.
--   'archived' requires the stronger manage-all/archive-capable permission
--   per the accepted architecture -- enforced at the application layer via
--   canTransitionRepairOrderStatus() (apps/web/src/lib/types/repair-orders.ts)
--   and, at the RLS layer, by the existing UPDATE policy's manage_all branch
--   (no new RLS policy needed -- the existing repair_orders_update policy
--   already requires manage_all OR (manage_own AND advisor match) for any
--   UPDATE; the archive-specific manage_all-only gate is enforced in the
--   service layer, since RLS cannot see the pre-image "to" value alone
--   without a trigger, which is intentionally not added for this simple
--   3-state model).
-- =============================================================================

ALTER TABLE public.repair_orders DROP CONSTRAINT repair_orders_status_check;
ALTER TABLE public.repair_orders ADD CONSTRAINT repair_orders_status_check
  CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text]));
