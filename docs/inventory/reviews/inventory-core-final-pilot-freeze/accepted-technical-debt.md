# Inventory Core — Accepted Technical Debt (Final Pilot Freeze)

Derived from IC-8's own `deferred-debt.md` (12 items), regrouped by
whether each item blocks pitch, pilot, or production integrity, per
this closing pass's own instructions. Nothing here was fixed in this
pass — this is a disposition record, not a work log.

## GROUP A — BEFORE PRODUCTION / DR

Must be resolved before relying on clean-room disaster recovery,
new-environment bootstrap, or production migration portability. Not
required for pilot or pitch.

### A1. Migration-history / clean-room reproducibility

149 live-applied migration versions have no local file at the same
timestamp (106 with no local file even by name), including core
Inventory infrastructure (the movement-engine's own foundational
migration series, `warehouse_locations`' base table, the wdd_matcher
provenance tables). See `docs/inventory/reviews/ic-8-final-production-
readiness-review/migration-reproducibility.md`.

- Blocks pitch? **NO**
- Blocks pilot? **NO**
- Blocks production integrity? **YES** — blocks disaster recovery,
  new-environment bootstrap, and migration portability specifically;
  does not affect the currently-running live database's own
  correctness.
- Recommended timing: before any production DR plan, environment
  rebuild, or migration-portability requirement becomes operational.
  Likely requires a dedicated reconstruction pass at least as large as
  IC-8's own 7-file effort, spanning the movement engine's own
  foundational schema and possibly unrelated product modules sharing
  the same database.

### A2. Final disaster-recovery / bootstrap strategy

No DR/bootstrap strategy has been defined or tested (Sections 4, 9, 27
of IC-8 were all BLOCKED by A1 above). Once A1 is resolved, a genuine
clean-room boot/seed/pgTAP/app-boot cycle still needs to be run and
documented — it was never actually executed successfully, only
attempted.

- Blocks pitch? **NO**
- Blocks pilot? **NO**
- Blocks production integrity? **YES** — same dependency as A1.
- Recommended timing: immediately after A1 is resolved, as its own
  verification step.

## GROUP B — POST-PILOT / PRODUCT IMPROVEMENTS

Real, disclosed, non-blocking debt. None of these block pitch or
pilot use of Inventory Core.

### B1. Reversal UI

`inventory_reverse_movement` is backend-ready, secured, tested — zero
UI callers. A user who posts an incorrect movement today has no
product path to undo it.

- Blocks pitch? **NO** (unless the pitch script specifically demos an
  error-correction flow — confirm with the pitch audit)
- Blocks pilot? **Recommended NO, but flag to product owner** — a real
  pilot user WILL eventually post a wrong movement; decide whether
  pilot needs this or an accepted manual/support workaround.
- Blocks production integrity? NO
- Recommended timing: early post-pilot, or pulled forward if the pilot
  itself surfaces a real need.

### B2. RepairOrder receive/putaway UI

`receive_repair_order_stock`/`putaway_repair_order_stock` are
backend-ready, secured, pgTAP-tested through A8 — zero UI callers.

- Blocks pitch? **NO**, unless the pitch script demos RepairOrder
  stock receiving specifically — confirm with the pitch audit
  (`pitch-handoff.md` flags this explicitly).
- Blocks pilot? **Depends on pilot scope** — if the pilot includes
  real RepairOrder receiving workflows, this needs UI before pilot
  go-live.
- Blocks production integrity? NO
- Recommended timing: before pilot go-live IF RepairOrder receiving is
  in pilot scope; otherwise post-pilot.

### B3. Performance/load measurements not completed in IC-8

4 of 9 performance-handoff items remain unmeasured (reservation/
allocation lock cost, movement-posting O(lines×effects) cost,
branch-transfer 3-RPC lifecycle cost, shared `inventory_settings`
row-lock contention) — no safe load/concurrency tooling was available
during IC-8. See `docs/inventory/reviews/ic-8-final-production-
readiness-review/performance-evidence.md`.

- Blocks pitch? NO
- Blocks pilot? **NO at current (dev-scale) data volume**; re-assess
  if pilot volume grows meaningfully.
- Blocks production integrity? NO at current volume; **YES if
  production volume is materially larger** than what's been measured.
- Recommended timing: before any high-volume production commitment;
  a genuine concurrent-session benchmark once real DB-credential/load
  tooling access exists.

### B4. Document-numbering/idempotency DRY debt

Document-numbering and idempotency-check logic are each independently
reimplemented across ~10 RPCs, with the shared per-org `inventory_
settings` row lock serializing all of them regardless of document type
(same root cause as B3's contention item).

- Blocks pitch? NO
- Blocks pilot? NO
- Blocks production integrity? NO (correctness is fine; this is a
  maintainability/contention-risk item)
- Recommended timing: a future centralization pass, informed by B3's
  own eventual contention measurement.

### B5. Reservation/allocation/container lifecycle audit enhancement

No structured, append-only audit trail for reservation/allocation/
container state changes (only the bare row's own `created_by`/
`created_at`/`cancelled_by` columns) — unlike the movement lifecycle,
which has full 3-layer coverage. See `docs/inventory/reviews/ic-8-
final-production-readiness-review/audit-trail-matrix.md`.

- Blocks pitch? NO
- Blocks pilot? NO
- Blocks production integrity? NO (data is correct and queryable, just
  not formally audit-logged)
- Recommended timing: post-pilot, alongside any broader audit/
  compliance requirement that emerges from pilot feedback.

### B6. Valuation-snapshot defect (`inventory_balance_analytics` view missing live)

Pre-existing (found by the architecture compression review, not IC-8
or this pass): a tracked migration defining this view was never
applied to (or was lost from) the live database. Zero current callers.

- Blocks pitch? NO
- Blocks pilot? NO
- Blocks production integrity? NO (zero current usage)
- Recommended timing: combined SQL-fix + UI-build decision, whenever
  valuation reporting becomes a real product priority.

### B7. Future ledger partitioning

`inventory_stock_ledger_entries` is strictly append-only with zero
partitioning/archival. Not urgent at current (118-row) volume.

- Blocks pitch? NO
- Blocks pilot? NO
- Blocks production integrity? NO at current volume; worth planning
  before high production volume.
- Recommended timing: before production volume grows large enough to
  make an unpartitioned append-only table a real performance concern —
  no specific trigger threshold defined yet.

### B8. Other accepted low-risk debt from IC-8 (grouped, all NO/NO/NO)

- Redundant index on `inventory_balances` (`last_movement_id`,
  partial + full pair) — cosmetic, negligible cost.
- Bare `RAISE EXCEPTION` without explicit `USING ERRCODE` in
  reservation/allocation RPCs (defaults to `P0001`) — no live
  collision found.
- Orphaned error-allowlist entry for `inventory_seal_container` — the
  RPC itself has zero TS callers; harmless.
- 5 pre-existing, unrelated Vitest failures found during IC-8 (stale
  `vmi.*`/`QR` category assertions, a real-but-unrelated invitation-link
  bug, a broken `next-intl` nested dependency) — none touch Inventory
  Core.
- Naming/discoverability debt (RepairOrder container-wrapper naming,
  movement-type numeric codes, `inventory_balances` write-protection
  rationale) — documentation debt, not code debt.

All: Blocks pitch? NO. Blocks pilot? NO. Blocks production integrity?
NO. Recommended timing: opportunistic, whenever adjacent work touches
the same files.
