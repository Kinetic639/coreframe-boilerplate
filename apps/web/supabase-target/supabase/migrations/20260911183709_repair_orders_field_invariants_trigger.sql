-- Zone 3 Phase 7 correction pass -- Finding C (CONFIRMED, live-reproduced):
-- identity_status, created_by, organization_id, and branch_id are documented
-- as system/derived/non-client-writable fields, enforced only by the zod
-- schema + action layer today -- not by the DB. Live-reproduced this pass,
-- as the genuinely-RLS-enforced authenticated role holding
-- workshop.repair_orders.manage_all (which has no per-field WITH CHECK
-- restriction beyond the archived-terminal fix above): a raw UPDATE could
-- set identity_status='resolved' together with a fabricated zl_number
-- (bypassing the app's own derivation logic entirely), set
-- identity_status='unresolved' while a real zl_number remained present (a
-- state the existing repair_orders_resolved_requires_zl_number CHECK does
-- NOT catch, since that constraint only forbids the opposite direction --
-- resolved with no zl_number), and directly rewrite created_by to an
-- arbitrary user id (audit-trail/authorship integrity).
--
-- Determination (per explicit instruction to determine, not assume, the
-- intended architecture): sibling services in this repo (CrmContactsService
-- .update, WarehouseLocationsService's update paths) allow arbitrary field
-- mutation via a plain .update(patch) with no invariant protection beyond
-- RLS row-scoping -- confirming Ambra's general pattern is
-- application-layer-authoritative for ordinary business fields, RLS
-- authoritative only for row-level multi-tenancy/ownership. However,
-- identity_status and created_by are not ordinary business fields: identity_
-- status is a DERIVED invariant the schema already partially polices (the
-- existing one-directional CHECK constraint), and created_by is an
-- audit-authorship field with no legitimate post-creation write path
-- anywhere in the accepted design. These specifically cross the bar the
-- existing materialize_repair_orders_from_session/approve_wdd_matcher_
-- session precedent already established: build the smallest DB-level
-- mechanism only where RLS genuinely cannot express the needed invariant --
-- here, a lightweight BEFORE INSERT OR UPDATE trigger (the standard,
-- established Postgres mechanism for exactly this class of invariant,
-- distinct from and complementary to RLS, not a new framework).
--
-- organization_id/branch_id are included in the same trigger as a cheap,
-- purely defensive addition: the live test this pass found that reassigning
-- organization_id to a different org is already blocked by RLS in the
-- realistic case (the acting caller lacks a manage_all grant in the target
-- org) -- the only remaining theoretical gap is a caller holding manage_all
-- in BOTH orgs simultaneously, which is a legitimate multi-org-admin
-- authorization state, not a bypass, and is not implemented/fixed here as a
-- distinct mechanism -- but since this trigger already runs on every UPDATE
-- for other reasons, making organization_id/branch_id immutable-after-insert
-- here is nearly free and closes even that theoretical edge defensively,
-- consistent with "organization_id/branch_id are always the caller's
-- trusted server-side active context, never a write target" already being
-- this table's documented contract.
--
-- Does not affect materialize_repair_orders_from_session: that RPC only
-- INSERTs repair_orders rows (identity_status is always set to 'resolved'
-- together with a real zl_number there, which this trigger's INSERT-time
-- recomputation reproduces exactly -- confirmed via pg_get_functiondef
-- before writing this migration) and never UPDATEs repair_orders.created_by/
-- organization_id/branch_id for the reuse path (only repair_order_lines.
-- ordered_quantity). Does not affect any Phase 7 service method's
-- legitimate writes (changeStatus/assignAdvisor never touch these columns;
-- updateHeader's own identity_status recomputation now becomes a redundant-
-- but-consistent mirror of this trigger's authoritative one, not a
-- conflict).
create or replace function public.repair_orders_enforce_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.identity_status := case when new.zl_number is not null then 'resolved' else 'unresolved' end;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;
$$;

drop trigger if exists repair_orders_enforce_invariants_trigger on public.repair_orders;

create trigger repair_orders_enforce_invariants_trigger
  before insert or update on public.repair_orders
  for each row
  execute function public.repair_orders_enforce_invariants();
