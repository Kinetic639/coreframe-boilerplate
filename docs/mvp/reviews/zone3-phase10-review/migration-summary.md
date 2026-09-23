# Zone 3 Phase 10 — Migration Summary

Two migrations were applied live to the `supabase-target` project (`rjeraydumwechpjjzrus`, `ambra-system-target`) via `mcp__supabase-target__apply_migration`, both in this same session, both required — no schema/table/RLS change, only one new RPC and one corrective grant fix to it.

## 1. `20260912162802_repair_order_line_movement_attach_rpc.sql`

Creates `public.attach_repair_order_line_movement(p_actor_user_id uuid, p_repair_order_line_id uuid, p_inventory_movement_line_id uuid, p_applied_quantity numeric, p_relation_type text) RETURNS jsonb`.

- `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp` (hardened, matches the sibling RPCs' own convention).
- Enforces, in order: actor-identity match (`p_actor_user_id = auth.uid()`, ERRCODE 28000); `applied_quantity > 0` (22023); `relation_type IN ('receipt','issue')` — `'reversal'` is rejected outright, no netting semantics exist for it anywhere (22023); RepairOrderLine existence + its RepairOrder's own org/branch resolved authoritatively (never trusting a client-supplied scope) (P0002 if not found); branch permission — `has_branch_permission(org, branch, 'warehouse.inventory.operate')` OR `.adjust` (42501); movement-line existence, row-locked (`FOR UPDATE OF iml`) to serialize concurrent attribution attempts against the same line (P0002 if not found); movement-line org/branch must match the RepairOrder's own (42501); movement must be `status = 'posted'` (55000); `relation_type` must match the movement's real `inventory_movement_types.category` (22023); if the movement header carries `reference_type = 'repair_order'`, its `reference_id` must equal this RepairOrder's own id (55000); if the RepairOrderLine carries a `variant_id`, it must match the movement line's own `variant_id` (55000); the sum of every existing `applied_quantity` against this movement line (across all RepairOrderLines and relation types) plus the new amount must not exceed the movement line's own `quantity` (22023); the final INSERT uses `ON CONFLICT (repair_order_line_id, inventory_movement_line_id, relation_type) DO NOTHING` followed by an explicit `v_new_id IS NULL` check, raising a distinct 23505 domain error on a genuine duplicate rather than silently no-op'ing or leaking a raw constraint-violation message.
- `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.

**No new table, no ALTER on any existing table, no RLS policy change.** Phase 2's `repair_order_line_movement_links` schema, constraints, and RLS policies (`_insert`, `_select`, `_delete_deny`) are completely untouched by this migration.

## 2. `20260912162827_repair_order_line_movement_attach_rpc_revoke_anon.sql`

`REVOKE ALL ON FUNCTION public.attach_repair_order_line_movement(...) FROM anon;`

Corrective, same-session follow-up. LIVE VERIFIED (`pg_proc.proacl`) that migration 1's own `REVOKE ALL ... FROM PUBLIC` did not remove a separate, automatic `EXECUTE` grant this project's `public` schema applies to `anon` via a default-privileges rule on newly created functions — a grant not routed through `PUBLIC`, so revoking from `PUBLIC` alone left it in place. Confirmed by comparing against the two existing sibling RPCs (`materialize_repair_orders_from_session`, `approve_wdd_matcher_session`), whose own live `proacl` has no `anon` entry at all. After this second migration, `attach_repair_order_line_movement`'s live grants are `{postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — exactly matching the sibling RPCs' shape, re-verified live via `has_function_privilege('anon', ..., 'EXECUTE') = false` / `('authenticated', ..., 'EXECUTE') = true`.

## Live/local parity

Both migrations were applied via MCP first, then the local files in `apps/web/supabase-target/supabase/migrations/` were written/renamed to match the exact version timestamps MCP reports (`20260912162802`, `20260912162827` — confirmed via `mcp__supabase-target__list_migrations`), matching every prior Zone 3 phase's own established workflow (local migration → MCP apply → live-verify → confirm local file matches the live-reported version).

## What was deliberately NOT done

- **No table-level trigger** on `repair_order_line_movement_links` enforcing these same invariants for every caller (RPC or raw client). Considered and rejected: Phase 8's and Phase 9's own pgTAP fixtures (`095_...`, `096_...`) already insert synthetic `repair_order_line_movement_links` rows directly against arbitrary real movement lines, explicitly disclosed at the time as anticipated stand-ins for this not-yet-built phase. A blanket trigger would have retroactively broken those already-shipped, already-accepted fixtures. Every invariant instead lives inside the new RPC, the intended write path; the underlying table/RLS is left exactly as Phase 2 built it, and this residual gap (a permitted actor can still raw-INSERT a row bypassing the RPC's own semantic checks) is disclosed in `review-context.md`, not silently fixed.
- **No new movement type** (no 201/WZ issue category seeded) — explicitly out of scope; LIVE VERIFIED none exists today, and seeding one was never requested by this phase.
- **No container/reservation/allocation schema** (Phase 10A-10F territory) — untouched.
