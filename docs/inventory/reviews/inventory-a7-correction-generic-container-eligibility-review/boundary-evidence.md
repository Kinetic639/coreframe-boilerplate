# Inventory Core — A7 Follow-Up Correction Pass — Boundary & Eligibility Evidence

## 1. Live pre-fix reproduction

Before any change this pass, reproduced the disclosed A7 tradeoff
fresh (not relying on the prior review bundle's own claim): a direct,
permissioned call to `inventory_add_to_container` with a
cross-RepairOrder allocation against a RepairOrder-owned container
**succeeded**. Confirmed the vulnerability was real and current before
implementing anything.

## 2. Caller audit

Repo-wide grep across `apps/web` and `apps/public-web` for every call
site of `inventory_create_container`, `inventory_add_to_container`,
`inventory_remove_from_container`, `inventory_seal_container`:
**exactly one real application caller of the entire container
subsystem**, `RepairOrdersService`, always via the wrapper, always
passing `reference_type='repair_order'`. No genuinely generic
(non-RepairOrder-owned) container is created by any real, live
application code today — the "generic container" concept is currently
100% theoretical in production, reachable only through pgTAP fixtures.
This directly informed and validated the eligibility-check design: it
was safe to add a strict gate because zero production traffic depends
on the generic pathway today, and the gate's own domain-agnostic
design (not special-casing `repair_order`) keeps the door open for a
genuinely generic future caller without reintroducing a RepairOrder
dependency into the generic primitive.

## 3. Eligibility invariant verification (pre-implementation)

Per the task's own explicit "STOP and report if this doesn't hold"
instruction, live-verified before choosing the rule:

- Zero DB-level validation (no CHECK/enum/trigger) constrains
  `reference_type`/`reference_id` on `inventory_containers`.
- A full live table scan found zero rows with partial reference state
  (one field set, the other null) — existing rows are either fully
  `repair_order`-referenced or fully null.
- Invariant `reference_type IS NULL AND reference_id IS NULL` (for
  "generic/reachable") confirmed to hold with no contradiction.

Rule adopted: reject if `reference_type IS NOT NULL OR reference_id IS
NOT NULL` — the conservative "either field is sufficient to reject"
reading, covering the theoretical partial-state case even though none
exists live today. Proven directly by pgTAP scenarios `ELIG3`/`ELIG4`
in file 115 (one field set, other null — both rejected).

## 4. Domain-agnostic design proof

Scenario `ELIG2` in file 115 uses a fabricated
`reference_type='some_other_domain'` (not `repair_order`) against the
public generic entry point and confirms rejection — proving the gate
does not special-case RepairOrder, matching the task's own explicit
"Important refinement" instruction that the generic API must remain
domain-agnostic.

## 5. Check-ordering / non-leaking proof

Scenarios `ORDER1` (spoofed `p_actor_user_id` against a domain-owned
container) and `ORDER2` (authenticated but lacking
`warehouse.inventory.operate`, against a domain-owned container) both
still receive `28000`/`42501` respectively — never `P0002` — proving
an unauthorized or misidentified caller never learns anything about a
container's own domain-ownership state from the error alone.

## 6. TOCTOU / write-once re-verification

The new public wrapper's own eligibility read of
`reference_type`/`reference_id` is unlocked (no `FOR UPDATE`). Safe
because both columns are write-once: re-confirmed live this pass that
zero SQL functions anywhere contain an `UPDATE ... SET reference_type
= ...` or `... reference_id = ...` statement, and zero TypeScript
writers touch either column — only `inventory_create_container` sets
them, at creation time. No new lock introduced; no new two-session
concurrency test required (matching this task's own explicit
conditional rule).

## 7. The file-100 blast-radius discovery (mid-pass correction)

The user's own efficiency question ("do you have to re-run all
097-115 tests?") prompted a closer investigation rather than either
blindly complying with a narrower scope or blindly insisting on the
full suite. That investigation surfaced a genuine gap in the initial
blast-radius assessment, which had assumed only scenario T19 in file
100 (already fixed during the A7 base pass) needed updating.

**Root cause**: `100_repair_order_container_orchestration_phase10c_test.sql`'s
own fixture containers, `container_a` and `container_b`, are **both**
created as RepairOrder-owned (`reference_type='repair_order'`) — a
design choice predating even A7. Five scenarios beyond T19 call
`inventory_add_to_container` **directly** (bypassing the wrapper)
against these RepairOrder-owned containers:

| Scenario | Expectation pre-correction                          | Why it would break                                                                           |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T2       | Success (place 6 into container_a)                  | New eligibility gate would reject with `P0002` before reaching placement logic               |
| T5       | Success (place 4 into container_b)                  | Same — `P0002` instead of success                                                            |
| T9       | `22023` (over-placement cap)                        | Would get `P0002` (eligibility) instead of `22023` (over-placement) — wrong rejection reason |
| T15      | Success (line_c into container_a, same RepairOrder) | Same — `P0002` instead of success                                                            |
| T30      | Success (re-add after empty)                        | Same — `P0002` instead of success                                                            |

Since T6-T8, T10, T16-T18, T20-T21, T22-T29, and T31 all read state
that depends on T2/T5/T15/T30 having genuinely succeeded, the
breakage would have cascaded through most of the file if left
unfixed.

**Confirmed unaffected, with reasoning**:

- **T11/T14** — use `container_mismatch`/`container_match`, both
  created with `reference_type=null, reference_id=null` (genuinely
  generic) — pass the eligibility gate cleanly, fail/succeed for their
  own intended (location-match) reasons only.
- **T19** — already fixed in the A7 base pass to use the wrapper.
- **T33** — uses a generic `branch_b` container (both null); fails for
  an unrelated cross-branch allocation-lookup reason
  (`P0002`, "Allocation line not found") either way — same error code,
  different cause, assertion unaffected.
- **T34/T43** — fail at the actor-identity/permission check, before
  the eligibility check is ever reached (matching the check-ordering
  guarantee in section 5 above).

**Fix applied**: T2, T5, T9, T15, T30 changed to call
`repair_order_add_allocation_to_container` instead of
`inventory_add_to_container`, same parameters. T9's own `22023`
over-placement assertion is preserved because the wrapper's own
ownership check passes (same RepairOrder) before delegating to the
internal helper, which still enforces the cap. Live-verified: all
44/44 assertions in file 100 pass post-fix, including the 5 changed
scenarios and every downstream scenario that depends on their success.

## 8. Regression scope decision

Given the file-100 gap was found only because a narrower-scope
proposal was investigated rather than accepted at face value, the
user explicitly directed a return to the full 097-115 regression (19
files) as the safety net, rather than the narrower 3-file
(100+114+115) subset originally proposed. See `test-evidence.md` for
the full result: 19/19 files, 526/526 assertions, 0 failures.
