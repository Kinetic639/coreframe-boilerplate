# IC-5 Test Evidence

## IC-5 narrow correction pass (2026-09-16, same day) — pre-fix reproduction

Before any fix, the BLOCKER (Finding A: reversed putaway rebuilt the
wrong projection bucket set) was live-reproduced via a dedicated
BEGIN/ROLLBACK fixture (receive 5 → Receiving, attach, full putaway 5 →
Shelf-A, reverse the posted 801 putaway movement):

```
PRE-REVERSAL PROJECTION:  Receiving = 0, Shelf-A = 5   (correct)
POST-REVERSAL BALANCES:   Receiving on_hand = 5, Shelf-A on_hand = 0   (correct — physical engine unaffected)
POST-REVERSAL PROJECTION (pre-fix): Receiving = 0 (STALE — should be 5), Shelf-A = absent (0, correct only by arithmetic coincidence)
```

Exactly matching the reviewer's own prediction: the trigger rebuilt
Shelf-A (the destination) twice and never rebuilt Receiving (the
source). Links were correct throughout (receipt=5, relocation=5,
reversal=5) — the defect was isolated entirely to bucket selection, not
attribution-history correctness.

After the fix (deriving both buckets from the reversal movement LINE's
own `source_location_id`/`destination_location_id`, never from `NEW.
direction`/`NEW.location_id`):

```
POST-REVERSAL PROJECTION (full putaway, post-fix):    Receiving = 5, Shelf-A = absent (0)
POST-REVERSAL PROJECTION (partial putaway, post-fix): Receiving = 5, Shelf-B = absent (0)
POST-REBUILD PROJECTION (both cases): byte-identical to the incremental post-reversal state
```

Both the full-putaway-reversal and partial-putaway-reversal cases were
independently live-verified fixed before being written into `107_...`
as permanent regression coverage (Scenarios Q/R below).

## New pgTAP file: `107_ic5_repair_order_projection_test.sql`

`plan(46)` (extended from `plan(33)` by this correction pass's own
Scenarios Q/R/S/T — see below). Executed live against supabase-target
via `psql`, inside a single `BEGIN...ROLLBACK` (zero residual rows —
see "Zero residual data" below). Final result:

```
 not_ok_count | total_assertions
--------------+-------------------
            0 |               46
```

**46/46, 0 failures.**

### Scenario-by-scenario

**A/B — known receipt, split across two same-SKU lines (10 = 6+4)**

- A1: line A's own known receipt = 6, auto-synced by `attach_repair_order_line_movement`'s own new rebuild call.
- B1: same-SKU line B independently = 4, never merged into A.
- A2: the fully-attributed bucket (6+4=10=physical) carries no UNKNOWN marker.

**C — one RepairOrderLine's own contribution across multiple locations, proven via a full-order rebuild**

- C0: line C's own known receipt = 5, before putaway.
- (after Scenario D's own putaway) C1: line C's own shelf-a contribution (5) survives a full projection rebuild unchanged.
- C2: line A's own receiving-location contribution (6) is untouched by line C's own putaway activity — multi-location AND same-SKU independence both proven via one rebuild call.

**D — full putaway (5 of 5) to shelf-a**

- D1: the receiving-location row for line C reaches exactly `0` after full putaway — NOT deleted. This is putaway's own unchanged, pre-existing direct-UPDATE behavior (a `quantity=0` row is semantically equivalent to absence, not a defect); disclosed explicitly, not silently special-cased in the assertion.
- D2: shelf-a now holds line C's own 5 units.

**E — genuine partial putaway (1 of 3 moved, 2 remain)**

- E1: receiving location retains the remaining 2 of line D's own 3.
- E2: shelf-b receives exactly the moved 1.
- Requires a `set_config(..., 'off', true)` reset immediately before AND after this scenario — see "Test-harness-only GUC leak" below.

**F — attributed reversal, single line**

- F1: line F's own known receipt = 7, before reversal.
- F2: line F's own projection row is fully cleared (count=0) after reversing its own only contribution.
- F3: exactly one `'reversal'`-typed attribution link was written, mirroring the original receipt.

**G — split-attribution reversal, two lines sharing one movement line (6+4=10)**

- G1: line G1 (was 6) fully cleared by the split-attribution reversal.
- G2: line G2 (was 4) fully cleared by the split-attribution reversal.
- G3: G1's own reversal link carries exactly its own original 6, never the whole 10.
- G4: G2's own reversal link carries exactly its own original 4, never merged with G1's.

**H — UNKNOWN source, putaway hard-rejected**

- Fixture: a known 1-unit contribution (attach), then an unattributed generic surplus (+3, type `401`) and a generic decrease (-2, type `402`) forcing genuine ambiguity — the pre-existing, accepted way this trigger proves uncertainty.
- H1: the ambiguous generic decrease against a partially-attributed bucket marks it UNKNOWN, never guessed.
- H2: a subsequent putaway attempt from that bucket is hard-rejected `55000` — accepted, pre-existing Zone-5 semantics preserved byte-for-byte, not reopened.

**I — destination-UNKNOWN stickiness**

- Fixture: a bucket seeded (raw superuser write, test setup only, immediately followed by a direct call to the internal rebuild primitive — deterministic, not a raw-write bypass of the real mechanism) with 5 physical units and 0 attribution, so it starts genuinely UNKNOWN.
- I1: the fixture bucket correctly starts UNKNOWN (5 physical, 0 attributed).
- I2: a new 2-unit known contribution landing at the SAME bucket via a real receipt+attach IS represented (known=2).
- I3: the bucket's own UNKNOWN marker is STILL present — a known contribution never silently clears sticky uncertainty (physical is now 7, known is 2, still short by 5).

**J — partial attribution / unattributed remainder**

- 10-unit receipt, only 6 attached to line J.
- J1: line J claims exactly its own attributed 6, never the whole 10.
- J2: the unattributed remainder (4) is represented as UNKNOWN at the bucket, not silently dropped or assigned to line J.

**K/L — rebuild equals incremental, and is idempotent**

- K1: a full RepairOrder rebuild (covering lines A/B/C) produces EXACTLY the same known rows the incremental path already established (zero mismatches).
- L1: rebuilding the SAME RepairOrder a second time is idempotent — byte-identical result to the first rebuild.

**M — raw-write denial**

- M1: raw `INSERT` into `repair_order_line_locations` denied for `authenticated`.
- M2: raw `INSERT` into `repair_order_location_attribution_uncertain` denied for `authenticated`.

**N — cross-org isolation on the rebuild RPC**

- N1: a fabricated `organization_id` is rejected `P0002` (no existence leak).

**O — no negative projection, ever**

- Fixture: a real 2-unit attach, then a raw superuser `UPDATE inventory_balances SET on_hand_quantity = 0` — fabricating a history inconsistency structurally impossible via any real RPC (attach's own quantity-cap check prevents it in production; this is a synthetic probe of the rebuild's own defensive check).
- O1: the rebuild hard-errors `P0008` on known attribution (2) exceeding physical on-hand (0) — never silently clamped via `greatest(0,...)`.

**P — receive/putaway rollback atomicity**

- An over-quantity (999, against only 2 available) putaway attempt on line D.
- P1: rejected `22023`.
- P2: line D's own receiving-location quantity is byte-identical before/after — no partial mutation.
- P3: zero row was created at shelf-a for line D by the rejected attempt.

**Q — FULL putaway reversal (IC-5 correction pass, Finding A regression)**

- Dedicated line Q: receipt 5 → Receiving, full putaway 5 → Shelf-A, reverse the posted 801 putaway movement.
- Q0a/Q0b: pre-reversal state sanity (Receiving=5 before putaway, Shelf-A=5 after).
- Q1: after reversal, Receiving is restored to 5 — the exact BLOCKER this pass fixes (source bucket no longer left stale).
- Q2: Shelf-A's own row is fully cleared (0) after the reversal.
- Q3: a full-order rebuild after the reversed FULL putaway produces EXACTLY the incremental post-reversal state.

**R — PARTIAL putaway reversal (IC-5 correction pass, Finding A regression)**

- Dedicated line R: receipt 5 → Receiving, partial putaway 3 → Shelf-B (2 remain at Receiving), reverse the posted 801 putaway movement.
- R0a/R0b: pre-reversal state sanity (Receiving=2, Shelf-B=3).
- R1: after reversal, Receiving is restored to the full 5 (2 remaining + 3 returned).
- R2: Shelf-B's own row is fully cleared (0) after the reversal.
- R3: a full-order rebuild after the reversed PARTIAL putaway produces EXACTLY the incremental post-reversal state.

**S — public attach contract stays frozen (IC-5 correction pass, Finding B regression)**

- S1: an authenticated caller submitting `relation_type='relocation'` via `attach_repair_order_line_movement` is rejected `22023` (system-owned type, unchanged check, re-proven after the internal-writer refactor).
- S2: same for `relation_type='reversal'`, rejected `22023`.

**T — internal writer unreachable directly (IC-5 correction pass, Finding B regression)**

- T1: a direct call to `write_repair_order_line_movement_link_internal` as `authenticated` is denied `42501` (EXECUTE revoked, no new client RPC exposed).

### Test-harness-only GUC leak (disclosed, not a production bug)

`set_config('ambra.repair_order_attribution_authoritative', 'on', true)`
(`is_local=true`, equivalent to `SET LOCAL`) persists for the rest of
the CURRENT TRANSACTION, not merely for the duration of the call that
set it. Every scenario in `107_...` runs inside ONE shared `BEGIN...
ROLLBACK` pgTAP transaction (this project's own established
convention), so a GUC set by an earlier scenario's own `putaway_
repair_order_stock`/`inventory_reverse_movement` call leaked forward
into later scenarios' own standalone `attach_repair_order_line_
movement` calls, causing them to incorrectly defer to a long-gone
"authoritative caller". Fixed by inserting three explicit `SELECT
set_config(..., 'off', true);` resets into the test file (before
Scenario E, after Scenario E, and at the start of Scenario H). **In
real production usage each RPC call is its own transaction**, so this
leak cannot occur outside a shared-transaction test harness — this is
disclosed explicitly as a test-only artifact, not silently patched
around.

## Full regression, ORIGINAL IC-5 pass (097-107, superseded numbers below reflect the correction pass's own full re-run)

| File    | Result     | Notes                                                                                                                                                                                                                                               |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 097     | 29/29      | Unaffected by this phase's own scope.                                                                                                                                                                                                               |
| 098     | 17/17      | Spot-verified via MCP after hitting the already-known, already-disclosed intermittent connection-pooler GUC artifact — not exhaustively re-run beyond the spot-check (zero code in IC-5's own diff touches allocation/reservation/container logic). |
| 099/100 | unaffected | Not re-run beyond the earlier partial spot-check this pass, for the same reason as 098.                                                                                                                                                             |
| 101     | 17/17      | Failed first (double-write regression), fixed by migration 11, re-run clean.                                                                                                                                                                        |
| 102     | 14/14      | Unaffected.                                                                                                                                                                                                                                         |
| 103     | 35/35      | Unaffected — confirms `inventory_reverse_movement` itself remains RepairOrder-agnostic.                                                                                                                                                             |
| 104     | 44/44      | Failed first (double-write regression), fixed by migration 11, re-run clean.                                                                                                                                                                        |
| 105     | 29/29      | Unaffected.                                                                                                                                                                                                                                         |
| 106     | 87/87      | Unaffected — confirms receiving/MMJ do not depend on RepairOrder tables.                                                                                                                                                                            |
| 107     | 33/33      | New, this phase.                                                                                                                                                                                                                                    |

## Full regression, IC-5 NARROW CORRECTION PASS (2026-09-16, same day) — every file re-run in full

| File | Result | Notes                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 097  | 29/29  | Re-run in FULL (not spot-checked) — this correction touches the Phase-10 attribution-write boundary (`attach_repair_order_line_movement`'s own internals). Confirms the internal-writer refactor is fully backward-compatible: every T1-T27/T-evidence assertion, including cap/duplicate/cross-org/variant-mismatch/actor-spoof negatives, passes unchanged. |
| 098  | 17/17  | Run in full this pass (reservation engine, untouched by this correction).                                                                                                                                                                                                                                                                                     |
| 099  | 20/20  | Run in full this pass (allocation engine, untouched).                                                                                                                                                                                                                                                                                                         |
| 100  | 44/44  | Run in full this pass (container orchestration, untouched).                                                                                                                                                                                                                                                                                                   |
| 101  | 17/17  | Run in full — exercises `receive_repair_order_stock`/`putaway_repair_order_stock` directly (IC-1 commitment-invariant characterization); confirms putaway's own relocation-link write via the internal writer is unaffected.                                                                                                                                  |
| 102  | 14/14  | Run in full — confirms the HARD-reservation invariant is untouched by this correction.                                                                                                                                                                                                                                                                        |
| 103  | 35/35  | Run in full — confirms `inventory_reverse_movement` remains completely RepairOrder-agnostic (byte-for-byte unchanged, not touched by this correction).                                                                                                                                                                                                        |
| 104  | 44/44  | Run in full — confirms the original double-write fix (Scenario G, `attach` + `receive_repair_order_stock`) remains correct after centralizing the writer behind the new internal primitive.                                                                                                                                                                   |
| 105  | 29/29  | Run in full — confirms the IC-7A security boundary (anon/actor/permission checks on the generic engine) is unaffected.                                                                                                                                                                                                                                        |
| 106  | 87/87  | Run in full — confirms branch-transfer/MMJ (IC-4) does not depend on RepairOrder attribution tables at all.                                                                                                                                                                                                                                                   |
| 107  | 46/46  | New Scenarios Q/R/S/T added this pass (13 new assertions: 33 → 46).                                                                                                                                                                                                                                                                                           |

**382/382 total, 0 failures across all 11 files this pass.**

## Vitest

217/217 relevant tests pass (RepairOrders service/actions, Zone 5,
inventory movement, receiving, branch transfer suites). Zero
TypeScript files touched by this correction pass (entirely PL/pgSQL).

## Static checks

- `pnpm type-check`: 0 errors.
- `pnpm lint`: 0 errors, 319 pre-existing warnings (unchanged baseline).
- `git diff --check` (staged IC-5 + correction-pass file set against baseline `97f0e9d9`): clean, no whitespace errors.
- `pnpm build`: **not run this pass** — no application/runtime TypeScript changed; the project convention only requires a build when application/action TypeScript changes.

## Zero residual data

- `107_...` runs entirely inside `BEGIN...ROLLBACK` — zero rows persist from any of its 19 scenarios (including the fixture branches 810-814, the raw superuser probes in Scenarios I/O, and the reversal calls in F/G/Q/R).
- The read-only drift check on existing live projection-table data (see `projection-reconciliation-evidence.md`) was a pure `SELECT count(*)`, no mutation.
- The correction pass's own pre-fix reproduction (see above) ran inside dedicated `BEGIN...ROLLBACK` probes via MCP `execute_sql` — zero residual rows.
- No genuine two-connection concurrency test was performed this phase (see `concurrency-evidence.md`), so there is no concurrency-test residue to disclose.
