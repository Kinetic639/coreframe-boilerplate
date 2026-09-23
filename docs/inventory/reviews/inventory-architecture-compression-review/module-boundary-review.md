# Module Boundary Review — RepairOrder vs. Generic Inventory Core

## RepairOrder-specific function/trigger classification

All bodies read live via `pg_get_functiondef`, not assumed from docs.

| Function                                                                                                  | Classification                                                                    | Reasoning                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inventory_add_to_container`                                                                              | **GENERIC CORE — INVALID dependency** (re-confirmed, already disclosed)           | Contains an inline 3-table JOIN reaching `repair_order_lines` (via `inventory_reservation_lines`→`inventory_reservations`→`repair_order_lines`), gated by `IF v_container.reference_type = 'repair_order'`. Real RepairOrder-table knowledge inside an otherwise domain-agnostic Handling-Unit primitive any generic warehouse action also calls. See redesign proposal below. |
| `receive_repair_order_stock`                                                                              | DOMAIN ORCHESTRATOR ABOVE CORE — valid                                            | Every RepairOrder-specific statement lives in this orchestrator; the generic `inventory_receive_stock` call it makes passes plain `{variant_id, unit_id, quantity, destination_location_id, note}` with zero RepairOrder awareness                                                                                                                                             |
| `putaway_repair_order_stock`                                                                              | DOMAIN ORCHESTRATOR ABOVE CORE — valid                                            | Calls the generic `inventory_create_and_finalize` for the physical relocation; all attribution/projection writes are its own, explicit, domain-side statements                                                                                                                                                                                                                 |
| `attach_repair_order_line_movement`                                                                       | DOMAIN ORCHESTRATOR ABOVE CORE — valid, thin                                      | Validates actor/scope/category/reference-type, delegates the actual row write entirely to the shared internal writer; touches no core balance/ledger table directly                                                                                                                                                                                                            |
| `repair_order_location_attribution_sync` (bound to the `repair_order_line_locations_ledger_sync` trigger) | DOMAIN PROJECTION/INTEGRATION — valid shape, but see the CHALLENGED verdict below | Fires on a generic core table's every ledger row, but the function body is 100% RepairOrder-domain; only ever reads core tables, only ever writes RepairOrder-domain tables. Correct shape for a projection trigger — the question this audit raises is whether the _projection itself_ is worth maintaining, not whether the trigger's own design is architecturally valid    |
| `rebuild_repair_order_projection_bucket_internal`                                                         | DOMAIN PROJECTION/INTEGRATION — valid                                             | Reads core tables read-only (reusing the exact lock every other bucket-writer already takes), writes only RepairOrder-domain tables                                                                                                                                                                                                                                            |
| `rebuild_repair_order_location_projection`                                                                | DOMAIN PROJECTION/INTEGRATION — valid                                             | Public, actor+permission checked entry point over the internal primitive                                                                                                                                                                                                                                                                                                       |
| `write_repair_order_line_movement_link_internal`                                                          | DOMAIN PROJECTION/INTEGRATION (shared attribution writer) — valid                 | Reads core tables (`FOR UPDATE`) to validate, writes only the RepairOrder-domain link table                                                                                                                                                                                                                                                                                    |
| `inventory_reverse_movement`'s `SET LOCAL ambra.repair_order_attribution_authoritative='on'`              | DOMAIN INTEGRATION HOOK — valid                                                   | Anonymous, generic-named extension point; the generic engine has zero knowledge of what the GUC's name means                                                                                                                                                                                                                                                                   |

## `inventory_add_to_container` — safest final redesign

**Proposed design**: extract the RepairOrder-ownership branch into a
new, RepairOrder-domain SQL wrapper, `repair_order_add_allocation_to_
container(p_actor_user_id, p_organization_id, p_branch_id, p_container_
id, p_allocation_line_id, p_quantity)`:

1. Same actor-identity + permission checks as today.
2. Lock/read the container row once.
3. `IF v_container.reference_type = 'repair_order' THEN` — run the
   exact same `repair_order_lines` JOIN check that exists today, same
   `P0002` message on mismatch.
4. Call the now-narrowed `inventory_add_to_container` (RepairOrder
   branch deleted — it keeps only the generic "allocation location
   must match container location" check) **as a nested call in the
   SAME function body / SAME transaction**, not a second round-trip.
5. `RepairOrdersService.placeAllocationInContainer` calls the new
   wrapper instead of the generic primitive directly. The generic
   warehouse "add to container" UI action keeps calling the now-
   narrower `inventory_add_to_container` directly, completely
   unaffected — the removed branch never activated for a non-`repair_
order`-owned container, so behavior is byte-identical for every
   other caller.

**TOCTOU analysis (reasoned through concretely)**: the check and the
use both happen inside one PL/pgSQL invocation, always one Postgres
transaction — no "time" between them in the sense of two independently-
committing operations. The narrower remaining question: could a
_concurrent_ transaction change the facts being checked (the
container's `reference_id`, or which RepairOrder an allocation line's
`reservation_line_id` chain resolves to) between the wrapper's read and
the generic primitive's later lock?

Checked empirically, not assumed: a live `prosrc` regex scan across
every function in `pg_proc` for any `UPDATE` touching `inventory_
containers.reference_type`/`reference_id` returned **zero rows**, and
the same scan for `UPDATE ... inventory_allocation_lines ...
reservation_line_id =` also returned **zero rows**. Both columns are
**write-once** in the current schema (set only at creation time, by
`inventory_create_container`/`inventory_create_allocation`
respectively) — no RPC anywhere ever updates either afterward. Since
the checked values cannot change post-creation, **no TOCTOU race
exists, and none is introduced by this extraction**, provided (a) the
check and the generic call stay in one transaction as proposed, and
(b) this write-once invariant is documented as a load-bearing
assumption of the new wrapper. A future feature that added "reassign a
container to a different RepairOrder" or "re-point an allocation to a
different reservation" would need to re-open this analysis — no such
feature exists today.

**If either field were mutable**, the correct fallback would be KEEP
the check inside the generic primitive exactly as today — a generic
primitive is allowed to contain a narrow, tested ownership check when
no safe extraction point exists. Not needed here; the write-once fact
is confirmed.

## RepairOrder projection trigger — the prior "KEEP" decision, CHALLENGED

The prior IC-7 `compression-candidates.md` entry said KEEP, reasoned
from the trigger's own design intent ("the only place that can observe
every ledger-producing write without coupling the reversal engine to
RepairOrder semantics"). This audit re-derived the decision from
evidence rather than accepting that reasoning, and checked two things
the prior review did not: (1) whether the projection this trigger
maintains is actually read by anything in production, and (2) whether
"rebuild always equals incremental" actually holds.

**What the trigger actually does** (more complex than the architecture
doc's "incremental fast path + rebuild" narrative suggests): a
**reversal branch** (mirrors links, then does a FULL bucket recompute,
not a delta) and a **non-reversal, decrease-only branch** that only
runs its heuristic-confidence inference when the attribution-
authoritative GUC is off — meaning `putaway_repair_order_stock`'s own
ledger-producing movement never actually exercises this trigger's
heuristic logic at all (putaway already writes the projection
directly). The heuristic only fires for a _generic, non-RepairOrder-
aware_ movement that happens to decrease stock at a bucket carrying
RepairOrder attribution history.

**New finding — the "always rebuildable" recoverability claim is not
actually true for this heuristic branch**: `rebuild_repair_order_
projection_bucket_internal` recomputes purely from `repair_order_line_
movement_links` joined to the ledger — it has zero knowledge of the
trigger's own incremental self-healing writes, because a generic
movement never creates a link row. Concretely: if the trigger
confidently decremented a line's row after a generic issue removed
stock from an attributed bucket, a later rebuild of that same bucket
recomputes the OLD (higher) total from the links/ledger join, compares
it to the now-lower physical `on_hand_quantity`, and **raises `P0008`**
("history inconsistency"). "Rebuild equals incremental" holds **only
for the reversal branch** (where the incremental path literally IS a
rebuild call) — it does not, and cannot by the current design, hold for
the generic-movement heuristic branch. Not previously disclosed.

**New finding — zero production reads**: the one TypeScript reader of
`repair_order_line_locations`, `RepairOrdersService.getPhysicalState
ForLine`, has **zero non-test callers** (confirmed by
`service-boundary-review.md`'s own Finding 3). The projection this
trigger pays a real per-ledger-row write cost to maintain is currently
read by nothing in production.

### Four-option comparison

**A. Current — synchronous trigger.** Atomicity correct by
construction. Hidden behavior: real — a plain warehouse developer
touching an attributed bucket silently invokes ~80 lines of RepairOrder
heuristic logic on a table they think is generic. Recoverability: NOT
fully sound (the P0008 gap above). Performance: paying real write-side
cost for zero production reads today. Complexity: ~185 lines of trigger
PL/pgSQL plus 664 lines of dedicated pgTAP, much of it overlapping with
the rebuild primitive.

**B. Explicit — every orchestrator calls a projection-update function
itself, no trigger.** Structurally **cannot** cover the generic-
movement case — a plain warehouse issue has no reason to know it's
touching an attributed bucket, so under pure-B that case would leave
the projection silently stale forever with no `UNKNOWN` marker raised,
objectively worse than A. Already half-implemented today (receive/
putaway already bypass the trigger and write directly) — the remaining
gap is precisely the case B cannot cover. **Not viable as a full
replacement.**

**C. Event/outbox, synchronous-in-transaction consumer.** If genuinely
synchronous, not materially different from A (an event row consumed in
the same transaction is a more roundabout way of writing the same code
A already contains) — gains nothing, adds a table. If asynchronous (the
natural reason to build one), breaks the deliberate immediate-
consistency property the architecture already chose — a real
consistency regression, not a pure refactor, out of scope for a
behavior-preserving pass. **No advantage synchronously; a regression
if async.**

**D. No incremental projection — compute live from the ledger on
read.** Correctness: uses the same query the rebuild primitive already
runs, scoped to one bucket — fails loudly (P0008-style) rather than
silently for the case A's heuristic partially guesses at (a genuine
improvement, though the error-handling UX for a read path would need a
product decision, not silent adoption). Atomicity: N/A, read-only.
Hidden behavior: **best of the four** — nothing runs on write, all
RepairOrder-projection logic lives in one place, invoked only when
read. Call sites needing to remember: zero. Performance: the decisive
factor — current production read frequency is **zero**, and even a
future wired-up read would be one bounded, indexed multi-join per
bucket at workshop (not high-frequency retail) traffic, comparable in
cost to the 4-6 sequential queries `getPhysicalStateForLine` already
issues for reservation/allocation/container reconciliation.
Recoverability: trivially always-correct — there is no projection to
desync from the ledger, eliminating the P0008 bug class entirely.
Complexity: **lowest of the four** — deletes the ~185-line trigger, the
direct-write portions of the two orchestrators (their attribution-link
writes via the shared internal writer stay — that's the actual source
of truth D reads from), and most of the 664-line dedicated pgTAP suite.

### Final recommendation: OVERTURN the prior KEEP — adopt Option D

This is the one place in the whole audit where the evidence supports
NOT keeping the IC-7-accepted design. Given zero current production
reads, the entire cost of Option A (write-side trigger complexity, the
P0008 latent correctness gap, 664 lines of dedicated test coverage, a
second independent implementation of "what does this line own at this
bucket" alongside the rebuild primitive) is currently pure overhead
with no corresponding benefit. Recommend: drop the persisted `repair_
order_line_locations`/`repair_order_location_attribution_uncertain`
incremental-write paths (the trigger, and the direct-write portions of
`receive_repair_order_stock`/`putaway_repair_order_stock`); keep
`repair_order_line_movement_links` as the sole persisted attribution
history (already the architecture doc's own designated canonical
attribution source); make `getPhysicalStateForLine` (or whatever
eventually replaces/wires it up) call a live, read-only version of the
rebuild primitive's own query directly.

This is not "fewer triggers for aesthetic reasons" — it is driven by
the concrete finding that the thing being kept synchronized has no
reader today, and by the concrete P0008 gap that Option A's own
justifying claim ("rebuild always equals incremental") does not
actually hold. If a real, high-frequency UI read path is later built
and D's live-join cost is shown to matter in practice, re-open this
decision with then-current read-frequency numbers — matching this
project's own stated "do not build speculatively" convention
(architecture doc §10). **This is listed as a SAFE-simplification
candidate in `simplification-plan.md` given it reduces complexity
while improving (not weakening) correctness** — see that document for
the caveat on why it is not in the smallest, lowest-risk tier despite
qualifying.

## Dependency map

```
Business modules (consume Inventory Core):
  RepairOrder integration  ─┐
  PurchaseOrder integration ─┼─► generic primitives only
  Count Session domain      ─┘   (create_reservation, create_allocation,
                                   create_and_finalize, receive_stock,
                                   create_container/add/remove, etc.)

Generic Inventory Core (must not know about business modules):
  movement engine, balances, ledger, reservations, allocations,
  branch transfers, generic containers, reversal
```

**One backward dependency found**: `inventory_add_to_container` (core)
→ `repair_order_lines` (RepairOrder module) — classified INVALID CORE
DEPENDENCY, redesign proposed above. **Severity: low** — narrow,
already tested, non-security-relevant, does not currently cause any
observed defect; a real module-boundary blemish worth fixing in a
future pass, not an urgent risk.

No other backward dependency was found in either this audit or the
prior IC-7 module-boundary-audit.md (`inventory_reverse_movement`'s own
GUC-name-only reference and the `repair_order_location_attribution_
sync` trigger are both correctly classified as domain-integration hooks
observing/writing at the boundary, not core code with embedded domain
knowledge).
