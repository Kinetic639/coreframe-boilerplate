# Zone 3 — Phase 10C — Migration Summary

All 8 migrations below were applied live via `mcp__supabase-target__apply_migration`, live-verified afterward via direct `pg_*`/`information_schema` queries (never trusted from `apply_migration`'s own `success:true` alone), and then mirrored locally under `apps/web/supabase-target/supabase/migrations/` using the exact live-reported version/timestamp. 7 are net-new objects; the 8th is a same-day `CREATE OR REPLACE` bug fix on one of the 7 (see below) — both are included here for full honesty about what actually happened, even though the plan/progress docs describe "7 new migrations" as the logical unit of work.

## 1. `20260914131300_inventory_containers_empty_status`

Additive CHECK-constraint change: adds `'empty'` to `inventory_containers.status`'s allowed values (`active | sealed | in_transit | archived | empty`). **Live-verified before applying**: exactly one real container row existed, `status='active'` — safe. **Live-verified after applying**: `pg_get_constraintdef` shows the new value present; the one existing row unaffected.

## 2. `20260914131308_inventory_alloc_container_lines_org_branch_uidx`

Creates two new composite unique indexes: `inventory_allocation_lines_org_branch_id_uidx ON inventory_allocation_lines (id, organization_id, branch_id)` and `inventory_container_lines_org_branch_id_uidx ON inventory_container_lines (id, organization_id, branch_id)`. **Why**: a genuine prerequisite discovered live, not anticipated by the plan's own pre-implementation draft — Postgres requires a unique index on the referenced column set before a composite foreign key can reference it, and neither table had one. Purely additive; no existing query or constraint depends on the old (non-unique-indexed) shape. **Live-verified**: `pg_indexes` shows both present after apply.

## 3. `20260914131318_inventory_allocation_container_links_table`

Creates the new table this phase's own invariant lives in:

```sql
CREATE TABLE public.inventory_allocation_container_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  allocation_line_id uuid NOT NULL,
  container_line_id uuid NOT NULL,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT inventory_allocation_container_links_branch_org_fk
    FOREIGN KEY (branch_id, organization_id) REFERENCES public.branches(id, organization_id),
  CONSTRAINT inventory_allocation_container_links_alloc_fk
    FOREIGN KEY (allocation_line_id, organization_id, branch_id)
    REFERENCES public.inventory_allocation_lines(id, organization_id, branch_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_allocation_container_links_container_fk
    FOREIGN KEY (container_line_id, organization_id, branch_id)
    REFERENCES public.inventory_container_lines(id, organization_id, branch_id) ON DELETE RESTRICT
);
```

Plus two partial indexes (`WHERE deleted_at IS NULL`, one keyed by allocation_line_id, one by container_line_id) and:

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`.
- `SELECT` policy: `deleted_at IS NULL AND has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')`.
- `INSERT` policy: `WITH CHECK (false)` — an explicit, permanent deny, not merely an absent policy.
- **No `UPDATE`/`DELETE` policy at all** — under FORCE RLS with zero applicable policy, both commands are implicitly denied for every role except the table owner (`postgres`) and any role with `BYPASSRLS`. This is a deliberate design choice, not an oversight: it means the ONLY way to ever write to this table in production is through the two `SECURITY DEFINER` RPCs that reference it (`inventory_add_to_container`/`inventory_remove_from_container`), which run as `postgres` and bypass RLS by ownership, not by policy. Matches a Phase 10 precedent proven safe earlier this project.

**Composite FKs, `ON DELETE RESTRICT`**: a link row can never be silently orphaned by deleting the allocation line or container line it references — deletion of either parent is blocked while an active (or even soft-deleted, since `ON DELETE RESTRICT` has no `deleted_at` awareness) link row exists. This preserves full placement history.

**Live-verified after apply**: `relrowsecurity`/`relforcerowsecurity` both `true`; exactly 2 policies present (`SELECT`, `INSERT`-deny); both composite FKs present in `pg_constraint`; both partial indexes present in `pg_indexes`.

## 4. `20260914131333_inventory_create_container_rpc`

New `SECURITY DEFINER` RPC `inventory_create_container(p_actor_user_id, p_organization_id, p_branch_id, p_code, p_current_location_id, p_type DEFAULT 'container', p_reference_type DEFAULT NULL, p_reference_id DEFAULT NULL) RETURNS jsonb`. Creates a container header only — always starting `status='empty'` (a deliberate simplification: no combined create+place call, since the RepairOrder wrapper's natural flow is create-then-place as two independently lockable steps). Validates: actor identity (`28000`), `warehouse.inventory.operate` permission (`42501`), non-empty code (`22023`), the target location exists in the same org/branch and `can_store_inventory=true` (`P0002`/`22023`). Owner `postgres`; `REVOKE ALL FROM PUBLIC` and the separate explicit `REVOKE ALL FROM anon`; `GRANT EXECUTE TO authenticated` only.

## 5. `20260914131352_inventory_add_to_container_rpc`

New `SECURITY DEFINER` RPC `inventory_add_to_container(p_actor_user_id, p_organization_id, p_branch_id, p_container_id, p_allocation_line_id, p_quantity) RETURNS jsonb`. This is where quantity conservation lives: row-locks the container (`FOR UPDATE`) then the authoritative `inventory_allocation_lines` row (`FOR UPDATE`) before reading the existing active-link `SUM(quantity)` and comparing `existing_sum + p_quantity` against `allocated_quantity` (`22023` on violation, atomically — no partial write). Variant/location/lot/serial for the container line are always derived from the allocation line's own row, never accepted as separate client input (matching the Phase 10B precedent). Finds-or-creates the container line by exact `(variant_id, lot_id, serial_id)` match using the coalesce-to-sentinel-uuid pattern already established elsewhere in this codebase. Flips `status: 'empty' → 'active'` on first placement. Same actor/permission/owner/grant hardening as #4.

## 6/8. `20260914131405_inventory_remove_from_container_rpc` → `20260914131532_inventory_remove_from_container_rpc_fix_check_violation`

New `SECURITY DEFINER` RPC `inventory_remove_from_container(p_actor_user_id, p_organization_id, p_branch_id, p_container_id, p_link_id, p_quantity) RETURNS jsonb`. Row-locks the container, then the link row (`FOR UPDATE`), then the container line (`FOR UPDATE`); reduces both the link's and the container line's own `quantity`; recomputes the container's total active content and sets `status='empty'` exactly when it reaches zero (never touches an `archived` container).

**A real bug was found and fixed same-day**: the first version (`...131405`) zeroed `quantity` on full removal (`SET quantity = 0, deleted_at = now()`), which violates both tables' own `CHECK(quantity > 0)` (`23514`) — full removal is exactly the case that constraint was guaranteed to hit. Caught by an ad-hoc smoke test before the formal pgTAP suite was written. **Fixed** via `CREATE OR REPLACE FUNCTION` (`...131532`): on full removal, only `deleted_at = now()` is set; the last active quantity is preserved as historical record rather than zeroed, matching this table's own soft-delete convention (the same pattern every other Zone 3 link/line table already uses). Re-verified live with no errors afterward, and the final pgTAP suite (T14, T17) exercises exactly this path.

The two local migration files (`...131405` and `...131532`) are both mirrored, in order, so that a fresh migration replay reaches the same final function body the live database actually has — mirroring only the fixed version would misrepresent what was actually applied and when.

## 7. `20260914131412_inventory_seal_container_rpc`

New `SECURITY DEFINER` RPC `inventory_seal_container(p_actor_user_id, p_organization_id, p_branch_id, p_container_id) RETURNS jsonb`. Transitions `active`/`empty` → `sealed`; rejects from any other status (`55000`). No content mutation. Same hardening as the others.

## `inventory_close_container` — evaluated, not built

Named in the plan's own pre-implementation draft. Not created: `inventory_add_to_container`/`inventory_remove_from_container` already own the `status='empty' IFF active content=0` invariant atomically and automatically (live-proven via T17/T18a in the pgTAP suite). A separate close RPC would either be redundant with what remove-to-zero already provides, or would need to invent a materially different, undescribed behavior (e.g. force-archiving a non-empty container) that no requirement in this phase actually calls for.

## Cardinality and quantity-conservation summary

- One `inventory_allocation_lines` row may be split across **many** `inventory_allocation_container_links` rows (proven: line_a's 10 units split 6+4 across two containers, T5/T6).
- One `inventory_containers`/`inventory_container_lines` may receive contributions from **many** different allocation lines, including allocation lines belonging to different RepairOrders that happen to share a SKU (proven: T11-T13, container A holds both line_a's and line_b's own contributions, tracked completely independently).
- Invariant: `SUM(quantity) OVER (active links for one allocation_line_id) <= that allocation_line's own allocated_quantity` — enforced by row-locking the allocation_line row before the sum check and insert (not naive check-then-insert), proven atomic under a rejected over-placement (T9/T10: no partial mutation).
- Concurrency: **sequential-only, honestly disclosed**. The locking strategy was inspected directly from each function's own live body (fetched via `pg_get_functiondef`, not re-derived from memory) and reasoned through by hand across all three write RPCs for lock-ordering consistency (container row locked first in all three, ruling out a cross-function deadlock cycle) — but no genuine multi-session race was or could be exercised this session (pgTAP's own single-connection limitation).

## Security model (all 4 RPCs)

`SECURITY DEFINER`, owner `postgres`, `SET search_path TO 'public', 'pg_temp'`. First line of every function body: `IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ... ERRCODE = '28000'`. Second: `IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN RAISE EXCEPTION ... ERRCODE = '42501'`. Grants: `REVOKE ALL FROM PUBLIC`, `REVOKE ALL FROM anon` (both explicit, in the same migration — applied proactively this time, learned from an earlier phase's own corrective follow-up), `GRANT EXECUTE TO authenticated`. **Live-verified** (`information_schema.role_routine_grants`): grantees are exactly `postgres`, `authenticated`, `service_role` for all 4 functions.

## What was intentionally NOT migrated

- `inventory_containers`/`inventory_container_lines`'s own pre-existing RLS (their own `ALL`-command policy gated on `.operate` only) was **left untouched** — closing it would also break the still-live, if UI-unused, `ambra-location-inventory.ts` container-write actions, which is out of this phase's scope. The new invariant this phase actually owns (quantity conservation) lives entirely in the new link table instead, which is closed from creation.
- No trigger or generic-engine-level validation was added anywhere — every new invariant lives in the 4 new RPCs' own PL/pgSQL bodies, matching the reservation/allocation engine's own established pattern (SECURITY INVOKER there vs. SECURITY DEFINER here, but the "validation lives in the RPC body" convention is consistent).

---

# Correction pass (2026-09-14, same-day external review)

Two new forward migrations, applied after the original 7 above (none of the original 7 was edited in place). Both live-verified via `pg_get_functiondef`/`pg_policies`/`pg_roles` after apply.

## 8. `20260914192552_inventory_add_to_container_location_and_repair_order_ownership_fix`

`CREATE OR REPLACE FUNCTION public.inventory_add_to_container(...)`. Adds two new checks, both inserted immediately after the allocation-line lookup (before the quantity-conservation check):

1. **Location identity**: `IF v_alloc.location_id IS DISTINCT FROM v_container.current_location_id THEN RAISE EXCEPTION 'Allocation location does not match the container''s own current location' USING ERRCODE = '22023'; END IF;` — the container's own `current_location_id`, `reference_type`, `reference_id` are now also selected in the container lookup (the original version only selected `id, organization_id, branch_id, status`).
2. **RepairOrder-ownership identity** (only when `v_container.reference_type = 'repair_order'`): resolves the placing allocation's own RepairOrder via `inventory_reservation_lines → inventory_reservations (reference_type='repair_order_line') → repair_order_lines.repair_order_id`, keyed off `v_alloc.reservation_line_id` (now also selected in the allocation-line lookup), and rejects (`P0002`) unless it exactly matches `v_container.reference_id` (a text-to-text comparison, since `reference_id` is `text`). Generic (non-`repair_order`) containers skip this check entirely.

Neither check touches quantity-conservation logic, container-line matching, or the empty↔active transition — those remain byte-for-byte unchanged from the original version. Same `SECURITY DEFINER`/actor-identity/permission/grant hardening as before (verified unchanged).

## 9. `20260914192605_inventory_containers_repair_order_write_boundary`

6 new `RESTRICTIVE` policies (full DDL in the local migration file, verbatim):

- `inventory_containers_repair_order_write_restrict_insert` — `FOR INSERT WITH CHECK (reference_type IS DISTINCT FROM 'repair_order')`.
- `inventory_containers_repair_order_write_restrict_update` — `FOR UPDATE USING (...) WITH CHECK (...)`, same condition.
- `inventory_containers_repair_order_write_restrict_delete` — `FOR DELETE USING (...)`, same condition.
- The same three, mirrored for `inventory_container_lines`, each checking `NOT EXISTS (SELECT 1 FROM inventory_containers c WHERE c.id = container_id AND c.reference_type = 'repair_order')` instead of a direct column (since `inventory_container_lines` has no `reference_type` of its own).

**Why RESTRICTIVE, not a rewrite of the existing PERMISSIVE policy**: Postgres ANDs every RESTRICTIVE policy's result on top of the OR'd PERMISSIVE policies. The pre-existing `_manage` PERMISSIVE `ALL` policy (gated only on `.operate`) is left completely untouched — generic (non-RepairOrder) containers/lines keep exactly their old behavior. The new RESTRICTIVE policies add a second, independent gate that only matters for `reference_type='repair_order'` rows, closing the gap without touching, and without risking, the legacy `ambra-location-inventory.ts` write path.

**Live-verified exact denial semantics** (empirically probed before writing any pgTAP assertion, since RLS denial semantics differ by command): a direct authenticated `UPDATE`/`DELETE` against a RepairOrder-owned row is **silently filtered to 0 rows affected** — no exception — because a failing `RESTRICTIVE` `USING` clause simply removes the row from the affected set (standard Postgres RLS behavior for `UPDATE`/`DELETE`, not specific to this migration). A direct authenticated `INSERT` that would create a RepairOrder-owned row **raises `42501`** ("new row violates row-level security policy ..."), since `INSERT`'s `WITH CHECK` has no existing-row-filtering equivalent — it must raise when the check fails. A generic (non-RepairOrder) container/line's own raw `UPDATE` was independently re-verified to still return `rows_affected=1` (unchanged), confirming zero impact on the legacy write path.

**Why the canonical RPCs are unaffected**: `pg_roles` confirms `postgres` and `service_role` both carry `rolbypassrls=true`. Postgres never evaluates row security (permissive or restrictive) for a role with that attribute, `FORCE ROW LEVEL SECURITY` notwithstanding. All 4 canonical Phase 10C RPCs execute as `postgres` (their own `SECURITY DEFINER` + owner), so this boundary is invisible to them.

## `inventory_create_container`'s own reference-validation question — evaluated, left unchanged

The correction task asked whether `inventory_create_container` should validate that a `p_reference_type='repair_order'` call's `p_reference_id` resolves to a real, same-org/branch RepairOrder. **Decision: no change**, for two independent reasons: (1) `RepairOrdersService.createContainerForRepairOrder` — the only code path that ever sets this reference in production — already resolves and validates the RepairOrder's own existence/org/branch via `resolveRepairOrderScope` before ever calling the RPC, so a nonexistent or cross-branch RepairOrder is already rejected at the application layer before reaching the generic engine. (2) The new placement-time ownership check (migration 8 above) independently renders a fabricated or cross-branch reference inert even if the generic RPC were called directly and bypassed the app-layer check — no real allocation could ever resolve to match a fabricated reference_id, so no placement into such a container could ever succeed. Adding reference validation to the generic `inventory_create_container` RPC itself would couple the generic Inventory engine to Workshop-specific semantics for no additional security benefit, and would break the established precedent (Phase 10B's own `inventory_create_reservation` is likewise left generic and unvalidated for `reference_type='repair_order_line'`, with the equivalent guarantee living entirely in the Zone 3 service layer).

## Genuine two-connection concurrency proof (performed outside any migration or pgTAP file)

Not a migration — a live, manual proof using two independent, real PostgreSQL connections (`psql` directly against the target DB's pooled connection string, since pgTAP itself is a single-connection tool). Full methodology:

1. **Real, committed fixtures** (required for cross-connection visibility — pgTAP's own transaction-rollback convention would be invisible to a second connection): a RepairOrder, RepairOrderLine, a 10-unit reservation+allocation (via the real RPCs, as `authenticated`), and two containers (A and B) at the same location as the allocation, all with fixed, disposable UUIDs (`aaaaaaaa-1111-...` etc.), committed via explicit `BEGIN; ...; COMMIT;` blocks.
2. **Session A** (backgrounded): `BEGIN; SET LOCAL ROLE authenticated; ...; SELECT inventory_add_to_container(..., container_A, allocation, 6); SELECT pg_sleep(4); COMMIT;` — the RPC's own internal `FOR UPDATE` lock on the allocation-line row is acquired as part of the RPC call, then held open by the explicit sleep, inside the SAME transaction.
3. **Session B** (backgrounded, started ~1 second after Session A, so A has already acquired the lock): `BEGIN; SET LOCAL ROLE authenticated; ...; SELECT inventory_add_to_container(..., container_B, allocation, 6); COMMIT;` — its own `FOR UPDATE` attempt against the SAME allocation-line row must block until Session A's transaction ends.
4. **Measured result** (via `\timing on` and `clock_timestamp()` markers): Session A's own DO block (containing the RPC call) completed in ~45ms; Session A then held the lock for its full 4-second sleep, committing at `19:37:44.026704+00`. Session B's own DO block (containing its own RPC call) took **3131.911 ms** to complete — genuinely blocked — and finished at `19:37:44.029686+00`, within 3 milliseconds of Session A's commit. This is direct, measured proof of real row-lock blocking across two independent connections, not an inference.
5. **Outcome**: Session A's placement succeeded (6 units, into container A). Session B's own placement, once unblocked, correctly failed with `22023`: "Placement quantity exceeds the allocation line's own allocated quantity (already placed 6.000000, allocated 10.000000)" — since Session A's 6 had, by the time Session B's own check ran, been durably committed.
6. **Final live-verified state**: `active_link_sum = 6` (not 12 — conservation held under real concurrency, not merely sequential reasoning), `allocated_quantity = 10`, exactly 1 link row (Session A's; Session B's rejected attempt created zero rows), exactly 1 container-line row (container B, which Session B tried and failed against, has zero lines — no orphan). No deadlock in either session.
7. **Cleanup**: all fixtures (RepairOrder, RepairOrderLine, reservation, allocation, both containers, all links/lines) explicitly deleted afterward; the shared `inventory_balances` row used by the fixture (the same org/branch/location/variant combination every other Zone 3 pgTAP file in this project also shares) was restored to its own established baseline (`on_hand=1000, reserved=0, allocated=0`) — live-reconfirmed after cleanup.

**Honest scope of this proof**: it demonstrates the row-locking strategy correctly serializes two concurrent placements against the SAME allocation line into DIFFERENT containers, which is the scenario the correction task specifically asked for. The mechanically identical "same allocation, same container" variant was reasoned as equivalent (identical lock-acquisition point) rather than separately re-run, since the headroom remaining in the shared fixture after Session A/B's own run did not cleanly support a second, independently meaningful race without additional fixture resets.

## Discovered, disclosed, unrelated infrastructure artifact

While re-running 097/098/099 for regression confirmation, a pre-existing, intermittent connection-pooler session-state issue was found: some fraction of fresh `psql` connections against the pooled target DB inherit a leftover, non-`'on'` value for an unrelated `ambra.inventory_movement_engine` session GUC (a completely different, pre-existing trigger-guard on `inventory_balances`, unrelated to any container work), causing 097/098/099's own early fixture-setup balance-table `INSERT`s to intermittently fail with "inventory_balances can only be changed by the movement engine" on some connection attempts and not others. Reproduced twice each on 098 and 099 via direct `psql`; confirmed NOT to affect Supabase MCP's own `execute_sql` connection path (the project's primary, authoritative execution path throughout this entire effort) even once. Authoritative reruns via MCP: 099 20/20, 098 17/17, both clean; 097 29/29 clean via `psql` (unaffected in both attempts made). Disclosed here as a genuine, pre-existing test-infrastructure characteristic — NOT a Phase 10C regression (097/098/099 are byte-for-byte unmodified by this correction pass, and the GUC/trigger predate Phase 10C entirely) and explicitly out of scope to fix in this narrow correction pass.
