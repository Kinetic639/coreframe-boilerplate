# IC-2 — Migration Summary

9 forward migrations (7 original + 2 from the security-boundary correction
pass), applied via Supabase MCP `apply_migration`, live-verified via
`pg_get_functiondef`/`pg_get_constraintdef`/grant queries after each apply,
then mirrored locally under their exact live-reported version/timestamp. No
already-applied migration was edited in place — every fix is a new forward
migration.

## 1. `20260915155606_ic2_seed_reversal_document_movement_type`

Extends `inventory_seed_movement_types_internal` (`CREATE OR REPLACE`) with
a new, generic, system-only reversal document type (`KOR`, `is_correction=
true`, `corrects_document_type_code=NULL` — deliberately generic, not one
per original document type) and movement type (`900`, `is_system=true`,
`allows_manual_entry=false`, zero rows of its own in `inventory_movement_
type_effects`). Backfills all 4 existing organizations via a `DO` block
calling the seeding function for each — idempotent (every INSERT inside
the function uses `ON CONFLICT ... DO NOTHING`).

**Why no effect rows for `900`**: effects are computed per-instance by the
reversal RPC itself (the exact inverse of whatever the original movement's
own effects were), which the type-level `inventory_movement_type_effects`
model cannot express — see migration 2.

**Live-verified**: all 4 orgs have `KOR`/`900` rows; zero effect rows exist
for movement type `900`.

## 2. `20260915160118_ic2_inventory_finalize_posting_explicit_effects`

`CREATE OR REPLACE FUNCTION public.inventory_finalize_posting(...)`. Adds
ONE new, optional, trailing parameter: `p_explicit_effects jsonb DEFAULT
NULL`. When NULL (every pre-existing caller, unchanged), the effect lookup
is byte-identical to before (`SELECT ... FROM inventory_movement_type_
effects WHERE movement_type_id = ...`). When NOT NULL (only `inventory_
reverse_movement`), effects for each line come from the caller-supplied
JSON instead, keyed by `line_number`, as an array of `{id, target,
balance_field, direction, effect_order, is_required}` objects. The `id`
field is the ORIGINAL effect's own id, carried through so the ledger's own
NOT NULL `effect_id` FK (to `inventory_movement_type_effects`) can
correctly reference which original effect a reversal's compensating entry
undoes — the `900` type has no effect rows of its own.

**Why**: `inventory_movement_type_effects` is TYPE-level, not INSTANCE-
level. Live-checked the full catalog (101/311/401/402/801) before writing
any code — no single existing type can serve as a correct, honestly-
labeled inverse for every other type (801 needs a combined source-
increase+destination-decrease pair that exists nowhere in the catalog).
This is the minimal additive extension that avoids inventing a second
posting engine, per the task's own explicit "STOP before inventing a
shadow type system" instruction.

**Live-verified**: the IC-1 hard invariant (`post_on_hand >= reserved +
allocated`, SQLSTATE `P0003`) applies identically regardless of whether the
effect came from the catalog or from `p_explicit_effects` — a reversal can
never bypass it.

## 3. `20260915160414_ic2_inventory_reverse_movement_rpc`

The new `inventory_reverse_movement(p_movement_id uuid, p_actor_user_id
uuid, p_reason text) RETURNS jsonb` RPC (first version). See
`review-context.md` and `docs/inventory/inventory-core-architecture.md`
§7 for the full eligibility/locking/linkage/security contract.

## 4. `20260915160444_ic2_drop_old_finalize_posting_overload`

**Live-caught defect**: migration 2's `CREATE OR REPLACE FUNCTION` with an
added 3rd parameter created a NEW, additional overload
(`inventory_finalize_posting(uuid, uuid, jsonb)`) rather than replacing the
original 2-arg one — Postgres matches on full parameter-type signature, and
adding a parameter changes it. The old `inventory_finalize_posting(uuid,
uuid)` was left behind, making every existing 2-argument call site
(`inventory_create_and_finalize`, and any other caller) genuinely ambiguous:
`42725: function inventory_finalize_posting(uuid, uuid) is not unique`.
Live-reproduced on the very first receipt-reversal test attempt. Fixed:
`DROP FUNCTION IF EXISTS public.inventory_finalize_posting(uuid, uuid);` —
the 3-arg version's own `DEFAULT NULL` makes it a fully backward-compatible
drop-in replacement for every existing 2-arg call.

## 5. `20260915160902_ic2_inventory_reverse_movement_fix_p0004_reserved_code`

**Live-caught defect**: `P0004` is a Postgres BUILT-IN reserved condition
name (`assign_string_too_long`) in the same "P0" SQLSTATE class this
project's own custom convention already uses (`P0001` default RAISE,
`P0002` not-found, `P0003` IC-1 invariant). Live-reproduced via isolated
probes that `RAISE ... USING ERRCODE = 'P0004'` is genuinely NOT caught by
a surrounding `WHEN OTHERS` handler — while `P0005`/`P0006`/`P0007` (and
the project's own pre-existing `P0001`-`P0003`) all catch correctly, tested
individually before concluding P0004 specifically was the problem. Fixed:
the "not posted" rejection code moved from `P0004` to `P0007`.

## 6. `20260915161137_ic2_reverse_movement_zone5_attribution_guard`

**Live-caught defect** (read-only Zone 5 compatibility investigation, per
explicit IC-2 scope — Zone 5 itself was never modified): reversing a
`receive_repair_order_stock`-created movement was live-proven to make Zone
5's own `repair_order_line_locations_ledger_sync` trigger (`repair_order_
location_attribution_sync()`) ACTIVELY CORRUPT `repair_order_line_
locations` — it deleted then immediately re-inserted the SAME quantity at
the SAME location (since the reversal line's own `destination_location_id`,
copied directly from the original per the design, equals the location the
ledger entry zeroes out), leaving the table claiming 10 units physically
present at a location where `on_hand_quantity` was now genuinely 0. Fixed
by having `inventory_reverse_movement` itself set `SET LOCAL ambra.repair_
order_attribution_authoritative = 'on'` — the SAME GUC `receive_repair_
order_stock`/`putaway_repair_order_stock` already set around their own
ledger-producing calls, an existing established mechanism, not new Zone 5
code. This makes the trigger take its "authoritative caller" branch, which
does not attempt its own heuristic re-attribution (no more active
corruption) but also does not itself correct `repair_order_line_locations`
to reflect the reversal — the result is disclosed, known STALENESS
(an explicit, already-planned IC-5 concern), not resolved here.

## 7. `20260915162826_ic2_reverse_movement_regrant_after_default_privilege_reapply`

**Live-caught defect**: `anon` regained EXECUTE on `inventory_reverse_
movement` TWICE after subsequent `CREATE OR REPLACE FUNCTION` calls (the
P0004 fix, the Zone 5 guard), despite an explicit `REVOKE ALL FROM PUBLIC;
GRANT EXECUTE TO authenticated, service_role;` in the very first migration.
Live-verified this database applies a default-privilege grant to `anon` on
functions in schema `public` that re-applies on every `CREATE OR REPLACE`
of the SAME function (confirmed via the SAME pre-existing behavior already
present on `inventory_finalize_posting`, predating IC-1/IC-2 entirely).
Fixed with a final, explicit re-grant as the LAST migration in this phase.
Live-verified after: `has_function_privilege` shows exactly
`{authenticated, service_role}` for `inventory_reverse_movement` — no
`anon`, no `public`.

## 8. `20260915170706_ic2_security_internalize_explicit_effects` (SECURITY-BOUNDARY CORRECTION PASS)

**External review finding, live-confirmed P0**: migration 2's
`p_explicit_effects` extension was added to the EXTERNALLY-CALLABLE
canonical `inventory_finalize_posting(uuid,uuid,jsonb)`, which carried live
`anon`/`authenticated` EXECUTE. A safe, transaction-scoped attack probe
(`BEGIN...ROLLBACK`) proved an ordinary `authenticated` caller could call
the function directly with a crafted payload (two real effect ids from
different movement types) and double `on_hand` on their own legitimately-
created draft (10 → 20), with no extra permission required.

**Fix**: `CREATE OR REPLACE FUNCTION public.inventory_finalize_posting_
internal(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL, p_explicit_
effects jsonb DEFAULT NULL)` — the full original implementation, plus two
new defense-in-depth checks: (a) `p_explicit_effects` is only accepted when
the movement's own REAL `movement_type_code` (read from the row locked by
this same function, never trusted from the caller) is exactly `'900'`; (b)
each effect's `target`/`direction` is validated against its exact allowed
enumeration (`{source,destination}`/`{increase,decrease}`) and rejected
outright rather than silently falling through the pre-existing CASE/IF
logic. `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` on
this internal function — reachable only via a direct call from another
`SECURITY DEFINER` function owned by `postgres` (privilege checks for calls
made from inside a `SECURITY DEFINER` function's body use the function's
OWNER, not the original invoking role — standard Postgres semantics).
`inventory_finalize_posting(uuid, uuid)` is restored to its original 2-arg
signature as a thin wrapper (`RETURN public.inventory_finalize_posting_
internal($1, $2, NULL)`), with its own `REVOKE ALL FROM PUBLIC; GRANT
EXECUTE TO anon, authenticated, service_role` (the same broad grant it
carried before — closing that broader default-privilege problem itself
remains IC-7's scope, not this pass's). `inventory_reverse_movement` is
updated (`CREATE OR REPLACE`, same signature, no overload risk) to call
`inventory_finalize_posting_internal` directly instead of the public
2-arg function.

**Live-verified**: direct call to the internal function by `authenticated`
→ `42501`; ordinary 2-arg finalize still succeeds; full reversal
end-to-end (receipt + 801 + IC-1 commitment block) unaffected.

## 9. `20260915170726_ic2_drop_vulnerable_public_named_three_arg_finalize_posting` (SECURITY-BOUNDARY CORRECTION PASS)

**Live-caught defect (same pattern as migration 4, recurred)**: migration
8's `CREATE OR REPLACE FUNCTION public.inventory_finalize_posting(uuid,
uuid)` (2 args) did NOT remove the still-existing, vulnerable 3-arg
`inventory_finalize_posting(uuid, uuid, jsonb)` overload from migration 2
— different arity means Postgres treats it as a distinct function. Live-
verified via `pg_proc`/`has_function_privilege` immediately after migration
8 that the OLD 3-arg function was STILL callable by `anon`/`authenticated`/
`service_role` — i.e. the exact P0 this pass exists to close was STILL
live immediately after the "fix." Caught before being reported as
resolved. Fixed: `DROP FUNCTION IF EXISTS public.inventory_finalize_
posting(uuid, uuid, jsonb);` — nothing calls this signature any more
(its logic already fully moved to the internal function in migration 8).

**Live-verified after**: 3-arg call → `42883` (function does not exist);
`pg_proc` shows exactly one `inventory_finalize_posting` overload (2-arg).

## Post-apply live verification performed (every migration)

- `pg_get_functiondef` re-fetch after every function change, confirming
  the body matches exactly what was applied.
- `pg_get_function_arguments`/`SELECT oid::regprocedure FROM pg_proc` to
  confirm exactly one `inventory_finalize_posting` overload remains after
  migration 4.
- Live diagnostic re-runs of the receipt/801 reversal scenarios after each
  corrective migration, confirming the fix actually resolved the specific
  defect before moving on.
- `has_function_privilege` grant queries confirming the final, intended
  grant set on `inventory_reverse_movement`.
