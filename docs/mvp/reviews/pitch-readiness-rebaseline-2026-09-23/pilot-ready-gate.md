# Pilot Ready Gate

Additional requirements beyond Presentation Ready, before real users operate on real data in a controlled pilot. Nothing here blocks this week's pitch.

> **RECONCILED 2026-09-23** with `docs/mvp/zones/03-repair-orders-implementation-plan.md` Phase 14 (Pilot bootstrap functionality, 6 tasks) and Phase 15 (Pilot hardening and PILOT READY verification, 8 tasks) — currently 0/14 complete. Every task below is classified: **STILL REQUIRED** / **ALREADY SATISFIED** / **SUPERSEDED** / **DEFERRED BY PRODUCT-OWNER DECISION**.

## RepairOrder Phase 14 — Pilot bootstrap functionality (6 tasks, all STILL REQUIRED)

None of these are satisfied by Inventory Core's own IC-1 through IC-8 work — Inventory Core's scope was the generic movement/balance/reservation/allocation/container/branch-transfer engine, not RepairOrder-specific pilot-only features.

1. **STILL REQUIRED** — Migration + RLS for `repair_order_legacy_records` (net-new pilot-only table).
2. **STILL REQUIRED** — Manual RepairOrder **line** creation/editing (no Matcher origin) for an existing header. (Manual header creation is already PITCH scope, done in Phase 7 — this is the narrower line-level addition.)
3. **STILL REQUIRED** — Comments target registration for `workshop.repair_order` (reuses the existing generic `target-registry.ts` pattern, same infrastructure the attachments system already uses).
4. **STILL REQUIRED** — Legacy/external issue record path (scope ambiguous per the plan's own note — needs product-owner confirmation before building).
5. **STILL REQUIRED** — AutoStacja import hardening scenarios beyond the pitch's representative case.
6. **STILL REQUIRED** — Tests for each of the above.

## RepairOrder Phase 15 — Pilot hardening and PILOT READY verification (8 tasks)

1. **STILL REQUIRED** — Concurrency test suite (simultaneous materialization, approval, advisor reassignment) — RepairOrder-specific scenarios, not covered by Inventory Core's own concurrency suite (which covered `inventory_balances`/reservations/allocations/containers/branch-transfer, not RepairOrder materialization/approval).
2. **STILL REQUIRED** — Idempotency proof suite for RepairOrder-specific duplicate-prevention scenarios (Matcher→RepairOrder materialization, WDD document dedup).
3. **STILL REQUIRED** — Real live-DB RLS integration tests for all 8 RepairOrder-specific tables (`repair_orders`, `repair_order_lines`, `workshop_source_documents`, etc.) — distinct from and not covered by IC-8's own Section 7 adversarial audit, which tested the generic Inventory Core tables (`inventory_balances`, ledger, reservations, allocations, containers, branch-transfer) plus the RepairOrder _attribution_ link table (`repair_order_line_movement_links`), but not this Phase 15 item's own 8-table RepairOrder-domain set.
4. **STILL REQUIRED** — Multi-user test: two advisors/two warehouse workers operating on the same order simultaneously.
5. **DEFERRED BY PRODUCT-OWNER DECISION** — Migration reproducibility re-confirmation ("fresh clone replay matches live"). This is the exact same clean-room reproducibility gate IC-8 found BLOCKED and the Inventory Core Final Pilot Freeze formally accepted as deferred technical debt (architecture decision #23, `docs/inventory/inventory-core-architecture.md`). Superseded by that later, broader decision — not re-opened here. Still genuinely required before any DR/environment-rebuild event, per that same decision's own terms; not required for this pilot phase specifically.
6. **STILL REQUIRED** — Audit/reconcile path test (post-approval Matcher correction triggers the reconcile action, old provenance preserved, `platform_events` recorded).
7. **STILL REQUIRED** — Pilot E2E covering representative pilot roles.
8. **STILL REQUIRED** — Manual pilot scenario rehearsal, recorded in the progress tracker.

## Pilot bootstrap (beyond RepairOrder Phase 14)

- Real pilot organization/branch setup, distinct from demo/rehearsal data.
- Initial stock strategy — how existing physical inventory gets loaded into Ambra at pilot start. Not detailed in any current zone doc; a genuinely open item, distinct from the ongoing "receiving" workflow (which handles new deliveries, not a one-time bulk load).
- Permissions/roles setup for real pilot users (owner, warehouse worker, advisor/acceptor, possible branch manager).

## Correction/reversal UX decision

- `inventory_reverse_movement` needs a UI decision: build a minimal reversal UI, or explicitly accept "support/admin fixes only" for pilot. Currently an unresolved silent gap (Inventory Core `accepted-technical-debt.md`, item B1).
- Same open-decision status for RepairOrder receive/putaway UI if pilot scope includes real receiving distinct from the presentation's own confirmed need.

## Multi-user hardening

- Zone 1: last-owner protection (absent at every layer), self-demotion warning, full privilege-escalation verification, invitation accept-time one-organization revalidation.
- Zone 1: Matcher RLS is organization-scoped despite a `branch_id` column on every table — tolerable for single-branch demo, not for a multi-branch pilot.
- Zone 1: Help Desk has the same organization-only RLS pattern.
- Concurrency: simultaneous role/branch changes, concurrent role/ownership mutation — unverified.
- Zone 5: idempotent Matcher import into movement 101, concurrent receiving-quantity race protection, partial-delivery reporting policy.
- Zone 6: server-side pagination (currently client-side over up to 2000 rows/branch), concurrent-relocation race protection.
- Inventory Core's own accepted debt: reservation/allocation lock contention under real load (never measured), shared per-org `inventory_settings` row lock contention.

## Monitoring / operational support

- Zone 10: at minimum one real producer→delivery pair if pilot scope requires operational alerting — zero delivery engine exists today.
- Administrative audit trail (Zone 1) — currently unimplemented.
- Zone 8: automated test coverage for Help Desk authorization (currently zero).

## Backups / disaster recovery

- **Clean-room database reproducibility** — Inventory Core's own already-accepted technical debt. Per this task's own explicit instruction, NOT elevated to a pilot blocker here unless a new, concrete operational reason emerges. No such reason has surfaced.
- Schema/migration source-of-truth reconciliation (two parallel migration trees) — Zone 1's own doc lists this as PILOT-required, narrower in urgency than full clean-room reproducibility.
- Missing repository migrations for `qr_codes`/`qr_assignments` (Zone 4).

## Initial stock strategy

Not addressed in detail by any current zone doc — a genuinely open pilot-planning item, distinct from the receiving workflow.

## Known technical-debt acceptance (carried forward, not re-litigated)

All 11 items from Inventory Core's own `accepted-technical-debt.md` Group B remain accepted, deferred debt for pilot planning — see that document directly.

## Any genuinely required Phase 14/15 items not otherwise covered

None beyond the RepairOrder Phase 14/15 reconciliation above — that reconciliation IS the answer to this question; it is not a separate, undiscovered category.

## Explicit non-requirement, per this task's own instruction

**Clean-room migration reproducibility is NOT a pilot blocker** unless a new, concrete operational reason appears — followed exactly, not reopened or second-guessed.
