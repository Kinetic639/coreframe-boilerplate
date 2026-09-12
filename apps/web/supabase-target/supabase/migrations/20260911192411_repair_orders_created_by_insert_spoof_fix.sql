-- Zone 3 Phase 7 final narrow verify-first pass -- Issue 1 (CONFIRMED,
-- live-reproduced): repair_orders_enforce_invariants() (20260911183709) only
-- froze created_by to OLD.created_by on UPDATE -- it left NEW.created_by
-- exactly as the client supplied it on INSERT. repair_orders_insert's own
-- RLS WITH CHECK checks permissions/advisor ownership but never checks
-- created_by at all.
--
-- Live-reproduced before this fix: as authenticated manage_all (and, by the
-- identical policy shape, manage_own would behave the same), a raw
-- INSERT ... created_by = <a different real user's id> succeeded and
-- persisted that OTHER user's id as created_by -- authorship spoofing at
-- creation time, for an actor who was never that other user.
--
-- Compatibility verified before choosing this fix (per explicit instruction
-- not to blindly force created_by = auth.uid()):
--   - Manual creation (RepairOrdersService.createRepairOrder) already sets
--     created_by from the authenticated actor's own resolved user id
--     (never client input) -- auth.uid() equals that same value for the
--     same request, so this fix changes nothing for that path.
--   - materialize_repair_orders_from_session (SECURITY DEFINER) validates
--     p_actor_user_id = auth.uid() as its very first statement, then
--     INSERTs repair_orders with created_by = p_actor_user_id -- since
--     auth.uid() reads the session's JWT claim (a GUC), not the invoking
--     function's own SECURITY DEFINER/INVOKER attribute, auth.uid() still
--     resolves correctly inside that RPC and is already guaranteed equal
--     to p_actor_user_id by the time the INSERT runs. This fix changes
--     nothing for that path either.
--   - A genuinely trusted service-role/backend-only insertion path (no
--     PostgREST session, no JWT -- auth.uid() itself returns NULL in that
--     context) is explicitly preserved: such a caller's own explicitly
--     supplied created_by (e.g. for a hypothetical future historical-data
--     backfill tool) is kept as given, since it does not go through RLS at
--     all and is already a fully-trusted context.
--
-- Fix: on INSERT specifically, NEW.created_by := COALESCE(auth.uid(),
-- NEW.created_by) -- when there IS an authenticated session, the real
-- actor's identity always wins over anything the client attempted to
-- supply; when there is none (auth.uid() IS NULL, i.e. a trusted
-- service-role path), the caller-supplied value is preserved unchanged.
-- UPDATE behavior (freeze created_by/organization_id/branch_id to OLD) is
-- unchanged from 20260911183709.
create or replace function public.repair_orders_enforce_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.identity_status := case when new.zl_number is not null then 'resolved' else 'unresolved' end;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;
$$;
