# IC-5 Projection Reconciliation Evidence

This file gathers, in one place, the evidence that the projection
(`repair_order_line_locations` + `repair_order_location_attribution_
uncertain`) is now a genuinely DERIVED, reconcilable view of canonical
physical truth (A, the ledger) plus canonical business attribution (B,
`repair_order_line_movement_links`) — not an independently-maintained
data structure that can silently drift.

## IC-5 narrow correction pass (2026-09-16, same day) — reversed-putaway worked example

External review found that the ORIGINAL pass's own worked example
(below) exercised a REVERSED RECEIPT, not a reversed PUTAWAY — leaving
the exact bucket-derivation bug (Finding A) unproven by that example.
The correction pass adds the missing case explicitly: receipt 5 →
Receiving, full putaway 5 → Shelf-A, THEN reverse the putaway itself
(not the receipt). Pre-fix, this reproduced the BLOCKER exactly
(Receiving left stale at 0 instead of restored to 5 — see `test-
evidence.md`'s own "Pre-fix reproduction" section for the full live
transcript). Post-fix: Receiving correctly restored to 5, Shelf-A
correctly cleared to 0/absent, both proven byte-identical to a
full-order rebuild — both for a FULL putaway reversal and a PARTIAL
putaway reversal (3 of 5 moved, reverse, expect Receiving=5 restored
from 2, Shelf-B=0/absent). Permanent regression coverage: pgTAP
Scenarios Q (full) and R (partial) in `107_...`.

## Required worked example

**Setup**: receipt of 5 units to Receiving, full putaway of those 5
units to Shelf-A, then reversal of the receipt.

This exact sequence (scaled to the fixture's own quantities, and
extended with a second same-SKU line to also prove independence in the
same pass) is what pgTAP Scenarios C/D/F/G perform live:

1. **Receipt**: 10 units received, split 6/4 across two same-SKU
   RepairOrderLines (A and B) via two `attach_repair_order_line_
movement` calls (Scenario A/B). State check: line A = 6, line B = 4,
   bucket fully attributed (no UNKNOWN). A dedicated 5-unit receipt for
   a third line (C) is also attached (Scenario C, C0: line C = 5).

2. **Putaway**: line C's own 5 units are fully put away to Shelf-A
   (Scenario D). State check: receiving-location row for line C reaches
   exactly 0 (D1 — not deleted, an accepted pre-existing putaway
   characteristic), Shelf-A now holds line C's own 5 (D2).

3. **Rebuild and compare**: `rebuild_repair_order_location_projection`
   is called for the whole RepairOrder. Expected identical to the
   incremental result — confirmed: line C's own Shelf-A contribution
   (5) survives unchanged (C1), and line A's own receiving-location
   contribution (6) is completely untouched by line C's own putaway
   activity (C2) — proving both multi-location independence and
   same-SKU independence in the same rebuild call.

4. **Reverse and verify again**: a separate, dedicated attributed
   receipt (Scenario F, line F, 7 units) is reversed via `inventory_
reverse_movement`. State check: line F's own known receipt was 7
   before reversal (F1); after reversal, the projection row is fully
   cleared (F2, count=0) and exactly one `'reversal'`-typed link was
   written mirroring the original receipt (F3). A second, split-
   attribution version (Scenario G — one movement line, 10 units,
   split 6/4 across two new lines G1/G2, then reversed) confirms this
   holds even when a single movement line's own history was divided
   across multiple RepairOrderLines: both G1 and G2 are cleared exactly
   (G1/G2), and each one's own `'reversal'`-typed link carries its own
   exact original `applied_quantity` (6 and 4 respectively — G3/G4),
   never merged or whole-assigned to either line.

No physically impossible history was manufactured at any step — every
receipt/putaway/reversal in this worked example is a real, sequential,
posted movement through the same canonical engine every other IC phase
uses.

## Rebuild-equals-incremental (general, not just the worked example)

pgTAP Scenario K: a snapshot of every known row for lines A/B/C is
taken BEFORE a full-order rebuild, then compared to the state AFTER —
`SELECT count(*) FROM before_kl b WHERE NOT EXISTS (... exact match in
after_kl ...)` returns `0` (K1): the rebuild produces byte-identical
results to what the incremental path had already established, covering
same-SKU independence (A/B) and multi-location independence (C) in one
comparison.

## Rebuild idempotency

pgTAP Scenario L: the SAME RepairOrder is rebuilt a second time
immediately after the first rebuild; the same before/after comparison
against the first rebuild's own result again returns `0` differences
(L1) — rebuilding twice produces the same result as rebuilding once.

## Quantity conservation / no fabricated ownership

- Scenario J proves the converse of fabrication: a 10-unit receipt with
  only 6 units attached results in line J claiming EXACTLY 6 (J1, never
  the whole 10), and the unattributed remaining 4 is represented as
  UNKNOWN at the bucket (J2) — never silently dropped, never
  auto-assigned to the one line that happens to exist there. This is
  the direct proof that "remaining unattributed quantity must never be
  claimed by one line."
- Scenario A2 proves the complementary case: when known attribution
  exactly equals physical on-hand (6+4=10), no UNKNOWN marker is
  created — the projection does not over-report uncertainty either.
- Scenario O proves the rebuild formula itself refuses to violate
  conservation even under a fabricated (structurally-impossible-via-
  any-real-RPC) history: forcing known attribution (2) to exceed a
  corrupted physical on-hand (0) raises `P0008` rather than reporting
  a negative or clamped quantity.

## No-negative-projection audit

The rebuild primitive's own formula never applies `greatest(0, ...)`
or any other clamp — a review of the function body (`20260916182731_
ic5_rebuild_repair_order_projection_bucket_internal.sql`) confirms the
only two outcomes for a computed `net_qty < 0` or `v_total_known >
v_physical_on_hand` are: raise `P0008` (hard error) or proceed with the
correctly-signed non-negative value. An audit of all pre-existing
clamping logic in the trigger and in `putaway_repair_order_stock` found
none to remove — both were already avoiding clamps before this phase
(pre-existing UNKNOWN-marking behavior on ambiguity, not silent
zeroing). The new `CHECK (quantity >= 0)` constraint on `repair_order_
line_locations` is the final DB-level backstop.

## Existing live projection data — drift analysis (read-only)

Executed before any IC-5 migration: `SELECT count(*) FROM repair_order_
line_locations` and `SELECT count(*) FROM repair_order_location_
attribution_uncertain`. Both returned `0` live. This means:

- There was no pre-existing projection data that could have drifted
  from canonical truth under the OLD (pre-IC-5) trigger-only model.
- No backfill was required or performed — this is disclosed explicitly
  rather than silently assumed. Had either table held rows, the
  required next step would have been to run `rebuild_repair_order_
location_projection` for every RepairOrder with existing rows and
  diff the result against the pre-rebuild state before deciding whether
  to accept the rebuild's own output as authoritative; that step was
  not needed here.

## Concurrency

See `concurrency-evidence.md` — no dedicated two-connection test was
performed; the rebuild primitive's own row lock (the same `inventory_
balances ... FOR UPDATE` every other bucket-mutating writer already
acquires) structurally serializes concurrent rebuild/incremental
writers on the same bucket, so no genuine race exists to demonstrate.
