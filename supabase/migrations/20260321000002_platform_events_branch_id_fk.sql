-- =============================================================================
-- Migration: platform_events — Add branch_id foreign key
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Event System completion hardening
-- Gap:       branch_id column existed but had no FK constraint. Branch-scoped
--            events were already populating this column; the constraint was
--            simply missing from the original migration.
-- Pattern:   Matches existing soft-FK style — ON DELETE SET NULL (no cascade).
-- =============================================================================

-- branch_id → public.branches(id)
-- Soft FK: if a branch is deleted the event row is retained with branch_id SET NULL.
-- This preserves the append-only audit record while allowing branch lifecycle
-- management without orphan-constraint violations.
alter table public.platform_events
  add constraint platform_events_branch_id_fk
  foreign key (branch_id)
  references public.branches(id)
  on delete set null;
