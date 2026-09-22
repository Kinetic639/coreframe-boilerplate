# Inventory Core — A1–A6 Simplification Pass — Simplification Evidence

Per-item disposition, each independently re-verified against live
code/DB state before implementing — not blindly trusted from the
architecture compression review's own (in one case, stale) claims.

## A1 — IMPLEMENTED. 6/6 dead items re-confirmed, removed.

| Item                                                   | Re-verification                                                                                                | Result  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------- |
| `InventoryProductsService.createEnhancedProductLegacy` | Repo grep both apps: 2 hits (both definitions), 0 callers/imports/tests. Zero dynamic `.rpc()` risk confirmed. | REMOVED |
| `InventoryProductsService.listSuppliers`               | Same.                                                                                                          | REMOVED |
| `deletePutawayRuleAction`                              | Same, both apps.                                                                                               | REMOVED |
| `findContainersByReferenceAction`                      | Same, both apps.                                                                                               | REMOVED |
| `createLocationPutawayRuleAction`                      | Same, both apps.                                                                                               | REMOVED |
| `inventory_convert_quantity` (SQL)                     | Live: 1 overload, 0 `prosrc` SQL callers, 0 TS callers.                                                        | DROP'd  |

**No candidate was found to have a real caller since the audit.** All 6
were genuinely still dead at re-verification time.

**Secondary finding, handled correctly**: `apps/web`'s dead-action file
became 100% inert once its 3 exports were removed (deleted whole file).
`apps/public-web`'s copy of the same file also hosts 4 unrelated, still-
referenced legacy actions (the exact raw-write container feature the
PRE-IC8 P0 pass deliberately left broken, not fixed) — only the 3
matching dead actions and their 2 exclusively-private schemas were
removed there; the shared `uuidSchema`/`requireStockableLocation` and
all 4 other exports were left completely untouched, per this pass's own
explicit instruction not to fix that feature now.

## A2 — IMPLEMENTED, narrower than the source docs claimed (stale-claim caught and corrected)

The compression review's own `simplification-plan.md`/`service-boundary-
review.md` named 3 sites for the duplicated ownership check:
`releaseReservationForLine`, `allocateForLine`, `placeAllocationInContainer`.
Live re-inspection (per this pass's own explicit "do not trust stale
line numbers, re-run caller searches" instruction) found:

- `releaseReservationForLine` and `allocateForLine`: **byte-identical**
  `belongsToThisLine` check — same table (`inventory_reservations`),
  same 4 fields, same operators, same variable name, adapted only in
  the surrounding context.
- `placeAllocationInContainer`: a **structurally different** check
  (`belongsToThisRepairOrder`), comparing `inventory_containers.
reference_type`/`reference_id` against `scope.repairOrderId` — a
  different table, different fields, different semantics. Not the same
  duplication at all.
- `removeAllocationFromContainer` (not named by the task or the source
  docs at all): a **third, similar-but-not-identical** pattern —
  checking `inventory_allocation_container_links` via Set-membership
  (`validAllocationLineIds.has(...)`), not reference-type/id equality.

**Decision**: extracted the helper for exactly the 2 genuinely
byte-identical sites (`releaseReservationForLine`, `allocateForLine`).
Did NOT force `placeAllocationInContainer` or `removeAllocationFromContainer`
into the same helper — doing so would not be "mechanical" (the task's
own explicit constraint) for either, since neither shares the exact
check shape. This is reported here rather than silently deviating from
the task's own stated scope.

**Preserved exactly**: organization_id/branch_id/reference_type/
reference_id comparison, null/not-found behavior (`!!row &&`, same
truthy/falsy short-circuit the original `row && ...` produced),
per-site error wording (unchanged — the helper returns a plain boolean,
never an error message), call ordering, query ordering, authorization
behavior.

## A3 — IMPLEMENTED exactly as scoped

All 5 named functions (`normalizeMaterializationRpcError`,
`normalizeMovementLinkRpcError`, `normalizeReservationRpcError`,
`normalizeAllocationRpcError`, `normalizeContainerRpcError`)
re-confirmed live to share the identical 4-line "match against my own
allowlist array, else return null/fallback" shape. A 6th function in
the same file, `normalizeRepairOrderCrudError` (not named by the task),
was re-confirmed to have a genuinely DIFFERENT shape (2 params, exact
constraint-name substring matching, `console.error` logging, different
control flow) — correctly left untouched, matching the task's own exact
5-function list.

**Result**: 1 new generic `normalizeKnownRpcError(error, knownErrors):
string | null`. Each of the 5 original functions reduced to a 3-line
wrapper: `return normalizeKnownRpcError(error, ARRAY) ?? "fallback";`.
All 5 allowlist arrays (the actual security-relevant DATA — which
codes/message-patterns are considered safe to pass through) are
**completely unchanged**, not merged, not touched. All 5 function
names, signatures, and fallback messages unchanged. **Zero call sites
changed** anywhere in the file.

## A4 — IMPLEMENTED exactly as scoped

See `migration-summary.md` for full live pre/post-fix evidence. Exactly
6 real callers confirmed (matching the audit's own claim), all
`SECURITY DEFINER`/`postgres`-owned/same-owner-nested, zero real TS
callers. `authenticated` EXECUTE revoked; `anon` (already denied) and
`service_role` (still needed, confirmed via
`inventory_seed_movement_types_internal`-style provisioning paths using
this same locking pattern) unaffected. Function itself NOT converted to
`SECURITY DEFINER`, NOT rewritten, locking semantics unchanged — a
pure grant-only change.

## A5 — REJECTED after live code comparison

Full line-by-line comparison of all 3 candidates:

| Aspect                               | `searchPickerItems`                                    | `enrichProducts`                          | `listVariantOptions`                                                                               |
| ------------------------------------ | ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Fields rolled up                     | `on_hand_quantity` only                                | `on_hand_quantity` + `available_quantity` | `on_hand_quantity` + `available_quantity`                                                          |
| Branch scope when `branchId` missing | N/A — required param                                   | sums **across all branches** for the org  | returns **zero for every variant** (query skipped entirely)                                        |
| Null/NaN handling                    | raw `Number()` + DB-side `on_hand_quantity > 0` filter | `toNumber()` (0-safe helper)              | `toNumber()` (same helper)                                                                         |
| Per-location breakdown               | no                                                     | no                                        | **yes** — tracks `locations: VariantLocationStock[]` per variant as a side effect of the same loop |
| Output value shape                   | flat nullable number                                   | `{ onHand, available }` (camelCase)       | `{ on_hand_quantity, available_quantity, locations }` (snake_case + array)                         |
| Invocation condition                 | only when NOT in location-search mode                  | always                                    | only when `branchId` is truthy                                                                     |

**The decisive finding**: `enrichProducts` and `listVariantOptions`
handle a missing `branchId` in **opposite** ways — one silently
aggregates org-wide, the other silently returns nothing. This is an
existing, real behavioral divergence between the two call sites, not a
superficial coding-style difference. Forcing a shared helper would
require either (a) picking one behavior and silently changing the
other call site's existing output, or (b) threading a
"which-behavior" parameter through the "shared" helper until it stops
meaningfully sharing anything beyond the innermost 2-line `+=`
statement. `searchPickerItems` compounds this further by not summing
`available_quantity` at all and being conditionally skipped by an
unrelated flag (`isLocationMode`).

Per the task's own explicit rule ("If differences are semantically
meaningful: DO NOT force a helper. Report A5 as partially/fully
rejected"), **A5 is rejected in full**. Zero lines changed in any of
the 3 methods.

## A6 — IMPLEMENTED exactly as scoped

All 7 named methods (`updateVariantPricing`, `updateVariantDetails`,
`createOptionGroup`, `createOptionValue`, `generateVariants`,
`createLot`, `createSerial`) confirmed contiguous
(`InventoryEnterpriseService` lines 38–325 pre-pass) and moved
verbatim to `InventoryProductsService`. The only non-mechanical
decision required: `errorMessage()` (a 3-line null-safe error-message
helper both the moved methods and ~25 remaining `InventoryEnterpriseService`
methods depend on) had to be duplicated — kept in
`InventoryEnterpriseService` (still needed there) and added as a new
local copy in `InventoryProductsService` (didn't exist there before).
This is a small, unavoidable, behavior-neutral consequence of the move,
not a new abstraction and not scope creep — a 3-line pure function, not
a service or a layer.

All 7 real call sites (one action file,
`apps/web/src/app/actions/warehouse/inventory/index.ts`) updated from
`InventoryEnterpriseService.X` to `InventoryProductsService.X`. The one
dedicated test file among the 7 (`updateVariantDetails`'s own) updated
accordingly; the other 6 had no dedicated unit test coverage before
this pass and none needed moving. Reservations, allocations,
suppliers/PO, branch transfers, custom fields, collections, saved
views, import/export, valuation — none of `InventoryEnterpriseService`'s
other ~25 methods were touched, moved, or further split, matching the
task's own explicit "A6 is intentionally only the catalog-method move"
scope.

## Complexity measurement (proof the planned simplification happened, not a vanity metric)

| File                         | Before (HEAD `96faa009`) | After      | Delta                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InventoryEnterpriseService` | 997 lines                | 699 lines  | **−298** (7 methods + 5 unused type imports/re-exports removed)                                                                                                                                                                                                                        |
| `InventoryProductsService`   | 2913 lines               | 3047 lines | **+134** (−192 from A1 dead-code removal, +~326 from A6's 7 relocated methods + their doc comments + 5 new type imports + local `errorMessage`)                                                                                                                                        |
| `RepairOrdersService`        | 3502 lines               | 3546 lines | **+44** (A2/A3 both reduced executable-logic line count, but this pass's own doc-comment convention — explaining each mechanical change's own rationale, matching this project's established practice — added more lines than the code itself saved; see raw diff for the exact split) |

**Dead code/scaffolding removed** (counted from the diff, not
estimated): `apps/web`'s dead-action file: 218 lines deleted outright.
`apps/web`'s `inventory-products.service.ts`: 192 lines deleted (A1).
`apps/public-web`'s equivalent 2 files: 178 + a matching ~190-line trim.
`InventoryEnterpriseService`: 298 lines deleted (A6 move-out + unused
imports). Duplicated ownership-check scaffolding: 1 of the original 2
genuinely-duplicated inline blocks removed (net ~8 lines saved across 2
call sites, offset by the new helper's own doc comment). Duplicated
RPC-error-normalizer scaffolding: the 5 functions' own duplicated
matching logic (originally ~4 lines × 5 = ~20 lines of near-identical
code) collapsed to 1 shared ~10-line matcher + 5×3-line wrappers.

**Dead functions/actions removed**: 6 (2 TS service methods, 3 TS
server actions, 1 SQL function).

**Duplicated normalizer function count**: 5 → 1 shared matcher + 5 thin
wrappers (the wrapper count is unchanged at 5, since call sites needed
to keep working unchanged — the DUPLICATED matching LOGIC itself,
which was the actual DRY violation, is now centralized in exactly 1
place).

**Duplicated ownership-check count**: 2 genuinely-duplicated occurrences
→ 1 shared helper (the 2 call sites now call it; the 2 other,
non-duplicate "ownership-check-shaped" checks in
`placeAllocationInContainer`/`removeAllocationFromContainer` are
unaffected, correctly not merged).

**Duplicated balance-rollup implementation count**: 3 → 3 (unchanged —
A5 rejected).

**Public DB helper exposure count**: `inventory_get_or_create_balance_
for_update`'s `authenticated` EXECUTE: revoked (1 fewer unnecessary
public exposure). `inventory_convert_quantity`: removed entirely (1
fewer function in the public schema altogether).
