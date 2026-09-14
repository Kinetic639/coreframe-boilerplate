# Zone 3 Phase 10 Write-Boundary Correction — Migration Summary

One migration applied live to `supabase-target` (`rjeraydumwechpjjzrus`, `ambra-system-target`) via `mcp__supabase-target__apply_migration`.

## `20260914052934_repair_order_line_movement_links_close_direct_insert.sql`

```sql
drop policy if exists repair_order_line_movement_links_insert on repair_order_line_movement_links;

create policy repair_order_line_movement_links_insert_deny
  on repair_order_line_movement_links
  for insert
  with check (false);
```

Replaces the Phase 2 permissive `repair_order_line_movement_links_insert` policy (`WITH CHECK` gated on `warehouse.inventory.operate`/`.adjust`, but performing none of Phase 10's own semantic validation) with a deny-all policy, matching the naming/shape convention this table's own `repair_order_line_movement_links_delete_deny` policy already established.

## Live verification performed BEFORE applying this migration

Per explicit instruction not to assume `SECURITY DEFINER` alone solves the write-boundary question, the actual mechanics were inspected live first:

- `repair_order_line_movement_links` — owner `postgres`, `relrowsecurity = true`, `relforcerowsecurity = true`.
- `postgres` role — `rolbypassrls = true` (not superuser).
- `authenticated` / `anon` roles — `rolbypassrls = false`.
- `attach_repair_order_line_movement` — `prosecdef = true` (SECURITY DEFINER), owner `postgres`.

Conclusion drawn from these facts alone: because the RPC executes with the privileges of its owner (`postgres`), and `postgres` has `rolbypassrls = true`, the RPC's own internal `INSERT` bypasses RLS **unconditionally**, regardless of what INSERT policy exists on the table — this is a role-ownership fact, not anything `FORCE ROW LEVEL SECURITY` grants the owner (FORCE RLS only removes the owner's default RLS exemption; it does not and cannot override `rolbypassrls`, which is a separate, stronger role attribute).

This conclusion was then proven empirically, not just reasoned about: a transaction-scoped dry run (`BEGIN; ... ROLLBACK;`, live against `supabase-target`) temporarily replaced the permissive policy with the exact deny-all policy this migration was about to apply, then — as the real `authenticated` role, with the real `warehouse.inventory.operate` permission grant — attempted (1) a direct `INSERT` against the table (result: `42501`, `new row violates row-level security policy`) and (2) a call to `attach_repair_order_line_movement(...)` with the same data (result: success, a real jsonb row returned). Both outcomes captured into a temp log table and read back before `ROLLBACK`, confirming the hypothesis with certainty before applying anything for real.

## Live verification performed AFTER applying this migration

Re-queried `pg_policy` for `repair_order_line_movement_links`: three policies now exist — `repair_order_line_movement_links_delete_deny` (`qual = false`, unchanged), `repair_order_line_movement_links_insert_deny` (`with_check = false`, new), `repair_order_line_movement_links_select` (unchanged, the existing `has_branch_permission('workshop.repair_orders.read')` scoped policy). No UPDATE policy exists (unchanged — the table remains effectively insert(RPC-only)+select-only).

## Local/live parity

Applied via MCP first; local file (`apps/web/supabase-target/supabase/migrations/20260914052934_repair_order_line_movement_links_close_direct_insert.sql`) created afterward with content identical to what was applied, named to match the exact live-reported version (`20260914052934`, confirmed via `mcp__supabase-target__list_migrations`) — the same workflow every prior Zone 3 migration in this project followed.

## What was deliberately NOT done

- **No table trigger.** Per explicit direction to prefer "one canonical implementation of the attribution rules" (the RPC) over "RPC validation + duplicated trigger validation" — and because the live dry run proved policy closure alone was sufficient, a trigger duplicating the RPC's own invariants was never necessary.
- **The original Phase 2 migrations (`20260910061711` and its siblings) were not edited in place** — per this project's own standing "never edit an already-applied migration" rule, this is a new, additive forward migration.
- **Phase 10's own two migrations (`20260912162802`, `20260912162827`) were not edited** — per explicit instruction, they are untouched.
- **No RLS change to any other table** — only `repair_order_line_movement_links`' own INSERT policy was touched.
