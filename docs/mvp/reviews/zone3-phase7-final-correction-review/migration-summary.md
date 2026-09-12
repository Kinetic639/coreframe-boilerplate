# Zone 3 Phase 7 Final Narrow Pass — DB Security Summary

One migration, against `supabase-target`, applied via MCP (`apply_migration`), live version-
parity confirmed, no existing applied migration edited in place beyond this same function's own
already-established `CREATE OR REPLACE` pattern from the prior pass. See `review-context.md` for
the full narrative and live-reproduction evidence; `changed-files.md` for per-file metadata.

---

## Migration — `20260911192411_repair_orders_created_by_insert_spoof_fix.sql`

**Live version**: `20260911192411`. **Issue**: 1 (final narrow pass).
**Object changed**: function `public.repair_orders_enforce_invariants()` — `CREATE OR REPLACE`
(the trigger `repair_orders_enforce_invariants_trigger` itself is untouched; replacing the
function body it already points to does not require re-creating the trigger).

### BEFORE

An authenticated caller could forge `created_by` on INSERT. The function (as it stood after the
prior pass) was:

```sql
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
```

No branch touched `created_by` on INSERT — `NEW.created_by` passed through completely
unexamined, and `repair_orders_insert`'s RLS `WITH CHECK` never referenced it either.

### New SQL (exact final definition)

```sql
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
```

### AFTER

An authenticated caller's `auth.uid()` becomes `created_by` on every INSERT — unconditionally,
regardless of what the client attempted to supply in that column. There is no path through which
an authenticated session can cause a different, real user's id to be persisted as `created_by`.

### UPDATE

Existing freeze behavior remains unchanged — `created_by`, `organization_id`, and `branch_id` are
still reset to their `OLD` values on every UPDATE, exactly as established by the prior pass's
`20260911183709` migration. This migration adds a new INSERT-only branch; it does not modify the
UPDATE branch's logic at all (byte-identical to before).

### NO-JWT / service context

Preserves caller-supplied `created_by` through the `COALESCE` fallback: when `auth.uid()` itself
returns `NULL` (no JWT session in the current connection — a direct `service_role`/`postgres`
connection with no PostgREST request context), `COALESCE` evaluates to its second argument,
`NEW.created_by`, exactly as the caller supplied it. A fully-trusted, RLS-bypassing caller
retains full control over this field; only an AUTHENTICATED session's attempt to set it to
something other than its own identity is overridden.

### Why this does not break `createRepairOrderAction`

`RepairOrdersService.createRepairOrder` (called by this action) already sets `created_by` from
the authenticated actor's own resolved user id — sourced from the server-trusted session context,
never from client-controlled request input. `auth.uid()` independently resolves to that exact
same value for that same request (both read the identical underlying JWT claim). The trigger's
new INSERT branch is therefore a no-op confirmation for this path, not a behavior change.

### Why this does not break `materialize_repair_orders_from_session`

This `SECURITY DEFINER` RPC validates `p_actor_user_id = auth.uid()` (raising `28000` if they
differ) as its very first executable statement, THEN later inserts `repair_orders` rows using
`created_by = p_actor_user_id`. By the time that INSERT executes, `p_actor_user_id` is already
guaranteed equal to `auth.uid()` — the trigger's `COALESCE(auth.uid(), NEW.created_by)`
therefore evaluates to the identical value the RPC was already going to write. Confirmed via
`pg_get_functiondef` (read-only inspection, not assumption) that this RPC never inserts
`repair_orders` with a `created_by` value it hasn't already validated this way, and never UPDATEs
`repair_orders.created_by` on its reuse/idempotent-replay path at all.

### Why this does not break existing rows

This is a `BEFORE INSERT` trigger addition — it has no effect whatsoever on rows already
persisted before this migration was applied. No backfill, no data migration, no re-validation of
historical `created_by` values was performed or needed.

### Why this does not break UPDATE invariants

The UPDATE branch of the function was not modified in this migration (confirmed by diffing the
function body: the `elsif tg_op = 'UPDATE'` block is character-for-character identical to the
prior pass's version). The pre-existing `093_...` regression suite (12/12, unmodified, re-run
after this migration) and the pre-existing UPDATE-invariant assertions in `094_...` (T7-T10:
`identity_status` derivation and `created_by` UPDATE-immutability) both continue to pass
unchanged, confirming this migration is additive-only with respect to UPDATE behavior.

### Live verification result

Re-ran the exact spoof reproduction from before this fix (a raw `INSERT ... created_by = <a
different real user's id>`) as both `manage_own` and `manage_all`, in rolled-back transactions:
both now persist the genuine actor's id, never the supplied value. Also re-ran the pre-existing
`093_...` suite (12/12 still passing) and the full `094_...` suite (17/17 passing, including the
two new spoof-regression assertions T3/T15) to confirm no regression anywhere else in the
`repair_orders` INSERT/UPDATE surface.

### Local/live parity

Live-reported version from `list_migrations`: `20260911192411`. Local file: `20260911192411_
repair_orders_created_by_insert_spoof_fix.sql` — timestamps match exactly (no rename was needed;
the local file was written with a placeholder timestamp before applying, then renamed to match
the live-reported version immediately after, per this project's established migration-naming
discipline).
