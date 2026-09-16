# IC-3 — Migration Summary

4 forward migrations, applied via Supabase MCP `apply_migration`, live-
verified via `pg_get_functiondef`/`has_function_privilege`/`pg_proc`
overload queries after each apply, then mirrored locally under their
exact live-reported version/timestamp. No already-applied migration was
edited in place — every fix (including the one self-caught defect) is a
new forward migration.

## 1. `20260915183918_ic3_canonical_receive_primitive`

Creates `inventory_receive_stock(p_actor_user_id uuid, p_organization_id
uuid, p_branch_id uuid, p_lines jsonb, p_operation_date date DEFAULT NULL,
p_document_date date DEFAULT NULL, p_external_reference text DEFAULT
NULL, p_note text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb`. Actor-identity (`28000`) and `has_branch_permission(...,
'warehouse.inventory.operate' OR '.adjust')` (`42501`) checks run first.
Validates each line has a `destination_location_id` and positive
`quantity` (`22023`), then delegates the whole batch to `inventory_
create_and_finalize(..., '101', ...)`. Catches `unique_violation` on
`inventory_movement_headers_org_idempotency_uidx` specifically (via `GET
STACKED DIAGNOSTICS ... CONSTRAINT_NAME`) and gracefully returns the
winning caller's already-posted movement instead of surfacing a raw
constraint error. Returns `{movement_id, document_number, status, lines:
[{line_number, movement_line_id, variant_id, quantity, destination_
location_id}]}`. `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role`.

**Live-verified**: a two-line same-variant smoke receive (2+3) posted
correctly, aggregate balance 5, two distinct `movement_line_id`s.

## 2. `20260915184005_ic3_receive_repair_order_stock_wrapper_refactor`

`CREATE OR REPLACE FUNCTION public.receive_repair_order_stock(...)` — same
9-arg signature as before (no overload risk). Every pre-existing business
rule (actor/permission check, `resolve_branch_receiving_location`,
`source_line_id` provenance resolution chain, the `ambra.repair_order_
attribution_authoritative` GUC, `attach_repair_order_line_movement` +
`repair_order_line_locations` upsert loop) is kept byte-for-byte. The
ONLY change: the physical-posting call is now `inventory_receive_stock`
(was `inventory_create_and_finalize` directly), and movement-line
correlation now comes from the primitive's own returned `lines` array
instead of a second `SELECT` against `inventory_movement_lines`.

**Live-verified**: `pg_proc` shows exactly one `receive_repair_order_
stock` overload after apply (arity unchanged, no stale-overload risk this
time).

## 3. `20260915184050_ic3_inventory_receive_purchase_order_wrapper_refactor`

**Live-confirmed dead/broken before this migration**: the prior body
called `public.inventory_create_draft_movement(...)` and `public.
inventory_post_movement(...)` — neither exists in this database (0 rows
in `pg_proc`), so every real invocation has always failed `42883`.
Repo-wide grep confirmed zero UI callers reached from any component; the
only prior test coverage was a static string-match against the migration
file's own text (`inventory-phase2-migrations.test.ts`), never a
behavioral test. `inventory_purchase_orders` has 0 live rows — zero
migration/data-reset risk.

`CREATE OR REPLACE FUNCTION public.inventory_receive_purchase_order(
p_purchase_order_id uuid, p_lines jsonb, p_actor_user_id uuid DEFAULT
NULL, p_idempotency_key text DEFAULT NULL)` — a NEW 4th parameter
(`p_idempotency_key`) added to the previous 3-arg signature. Keeps every
genuine PO business rule byte-for-byte: PO row lock + not-found (`P0002`,
was a generic default-code `RAISE EXCEPTION`, now explicit `P0002` to
match convention), `warehouse.procurement.manage` permission check
(`42501`, a real, live permission slug), PO status guard (`55000` on
`received`/`closed`/`cancelled`), per-line PO-line lock + not-found
(`P0002`), quantity/over-receipt validation (`22023`), destination
resolution (per-line override falling back to `delivery_location_id`,
`22023` if neither present), `received_quantity` increment, final status
recomputation. Replaces the broken physical-posting calls with a single
call to `inventory_receive_stock`. Hardened as genuinely new IC-3 code
(not an IC-7 fix, since there was no working security contract before):
added `SECURITY DEFINER` (was implicitly INVOKER) and the standard
actor-identity check (`28000`) — the prior code accepted `p_actor_user_id`
with zero verification against `auth.uid()`.

Same migration explicitly drops the old, insecure, broken 3-arg overload:
`DROP FUNCTION IF EXISTS public.inventory_receive_purchase_order(uuid,
jsonb, uuid);` — learned proactively from 3 prior overload-pitfall
occurrences this project (IC-1 once, IC-2 twice) rather than discovering
it live again.

**Live-verified (initial smoke test, before the defect below was found)**:
a real PO/PO-line fixture received 6 of 10 units correctly, `on_hand=6`.

## 4. `20260915184448_ic3_fix_po_wrapper_idempotency_state_mutation_race`

**Self-caught defect, fixed BEFORE any test exercised it**: reviewing
migration 3's own design (not prompted by a test failure) surfaced that
`received_quantity` was incremented — and the over-receipt check
performed — BEFORE calling the idempotency-aware primitive. A retry with
the SAME derived idempotency key would therefore double-increment
`received_quantity` even though the underlying physical movement stayed
correctly deduplicated by the primitive's own graceful-catch mechanism —
violating the explicit requirement that a wrapper must not duplicate
business-state writes on an idempotent hit.

**Fix**: `CREATE OR REPLACE` (same 4-arg signature, no overload risk) —
pre-check for an existing movement under the derived idempotency key
(`'po-receipt-' || po_id || '-' || p_idempotency_key`) IMMEDIATELY after
acquiring the PO row's own pre-existing `FOR UPDATE` lock, BEFORE
touching any PO line. If found, short-circuit and return the PO's current
state without further mutation. **Race-safety reasoning**: two genuinely
concurrent calls for the SAME `purchase_order_id` both contend for the
SAME `v_po` row lock at the very start of the function (unchanged,
pre-existing) — the second, losing session blocks until the first
commits, then re-reads and correctly sees the now-committed movement row
before any duplicate mutation. This is the pre-existing lock doing the
work, not a new mechanism.

**Live-verified**: retrying the FIRST partial receipt (6 of 10, from
migration 3's own smoke test) with the same idempotency token returns the
same `movement_id`; `received_quantity` remains exactly 10 (6+4 from two
real receives), not 16.

## Post-apply live verification performed (every migration)

- `pg_get_functiondef` re-fetch after every function change, confirming
  the body matches exactly what was applied.
- `SELECT oid::regprocedure FROM pg_proc WHERE proname = ...` after every
  migration that changed a function's own signature, confirming exactly
  one overload survives (migrations 3 and 4 specifically, given the
  arity change and this project's own recurring overload pitfall).
- `has_function_privilege('anon'/'authenticated'/'service_role', ...)`
  grant queries confirming the final, intended grant set on all three
  IC-3 functions (`anon`: false; `authenticated`/`service_role`: true) —
  re-checked after EVERY `CREATE OR REPLACE`, not just once.
- Live smoke tests of each function individually before the full pgTAP
  suite was written, catching the PO wrapper's own idempotency ordering
  defect ahead of any automated test.
- A genuine two-PostgreSQL-connection concurrency race (see
  `test-and-concurrency-evidence.md`) — not merely reasoned about.
