# Pilot Scope Reconciliation

Summary of `pilot-ready-gate.md` (rewritten this pass) with the full RepairOrder Phase 14/15 classification. Full detail in that file.

## RepairOrder Phase 14 — Pilot bootstrap functionality (6/6 STILL REQUIRED)

None of these are satisfied by Inventory Core's IC-1 through IC-8 work — that work's scope was the generic engine, not RepairOrder-specific pilot-only features (`repair_order_legacy_records`, manual line entry, comments registration, legacy issue records, AutoStacja import hardening, tests).

## RepairOrder Phase 15 — Pilot hardening (7 STILL REQUIRED, 1 DEFERRED)

1. Concurrency test suite (RepairOrder-specific) — STILL REQUIRED.
2. Idempotency proof suite (RepairOrder-specific) — STILL REQUIRED.
3. Real RLS integration tests for all 8 RepairOrder tables — STILL REQUIRED (distinct from IC-8's own Section 7 audit, which covered the generic Inventory Core tables, not this 8-table RepairOrder-domain set).
4. Multi-user test — STILL REQUIRED.
5. **Migration reproducibility re-confirmation — DEFERRED BY PRODUCT-OWNER DECISION.** This is the identical clean-room reproducibility gate IC-8 found BLOCKED and the Inventory Core Final Pilot Freeze formally accepted as deferred technical debt (architecture decision #23). Not re-opened by this reconciliation.
6. Audit/reconcile path test — STILL REQUIRED.
7. Pilot E2E — STILL REQUIRED.
8. Manual pilot scenario rehearsal — STILL REQUIRED.

## Why no item is "DONE BY LATER INVENTORY WORK" or "SUPERSEDED"

Inventory Core's own IC-1 through IC-8 scope was the shared movement/balance/reservation/allocation/container/branch-transfer engine and its own security/concurrency/correctness properties. RepairOrder's Phase 14/15 items are about RepairOrder-domain-specific tables, workflows, and test coverage (materialization, approval, legacy records, comments) that Inventory Core never touched. The one genuine overlap (item 5, migration reproducibility) is correctly identified and deferred by reference to the SAME already-made decision, not mechanically preserved as if undiscussed.

## Explicit non-requirement carried forward

Clean-room migration reproducibility remains NOT a pilot blocker absent a new, concrete operational reason — per this task's own instruction, not reopened.
