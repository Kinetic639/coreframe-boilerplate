# Inventory Core — Progress Tracker

> Live execution tracker. Source of truth for the target architecture:
> `inventory-core-architecture.md`. Source of truth for the planned work:
> `inventory-core-implementation-plan.md`. This file is updated continuously
> as IC work happens — not batched at the end of a session, matching this
> project's own established Zone 3 tracker convention.

**Scope:** Inventory Core consolidation (cross-cutting base-engine work,
distinct from Zone 3's own Phase 10A-10F numbering).
**Priority:** P0 (blocks Phase 10D).
**Branch:** `zone3-zone5-integration-audit`.
**Architecture:** ✅ ACCEPTED (this session — `inventory-core-architecture.md`).
**Runtime status:** 🔴 NOT STARTED — planning/documentation only completed so
far. No IC phase implementation has been performed.
**Current phase:** IC-0 (planning + baseline capture) — **planning portion
DONE this session; the live-reverification portion of IC-0's own scope
(confirming the CHECK-constraint and RLS-policy facts listed in its own
"Live verification required" section) has NOT yet been performed** and must
be completed before IC-1 may begin.
**Pitch/pilot readiness:** N/A — this is base-engine work, not itself a
pitch-scoped feature; it BLOCKS Phase 10D, which IS pitch-scoped (see the
Zone 3 tracker's own cross-reference).
**Last updated:** 2026-09-15.

---

## Overall execution

- IC phases completed: 0 / 8 (IC-0's own documentation deliverable is done;
  IC-0's own live-reverification deliverable is not).
- No migration has been applied for any IC phase.
- No application code has been modified for any IC phase.

---

## Phase tracker

| Phase                                                                | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IC-0 Architecture contract + baseline capture                        | 🟡 PARTIAL     | Documentation (this file, the architecture doc, the implementation plan, the Zone 3 tracker cross-reference) is DONE. The live-reverification half of IC-0's own scope (CHECK constraints on `inventory_balances`; raw-write RLS shape on `inventory_reservations`/`inventory_allocations` and their own line tables; whether a raw INSERT of a `posted`-status movement header is possible) has **NOT** been performed yet — do not mark IC-0 fully done until it is. |
| IC-1 Canonical movement engine / hard stock invariants               | ⬜ NOT STARTED | Recommended next phase — see the implementation plan's own "Recommended IC-1 Scope" section for the exact authorized prompt.                                                                                                                                                                                                                                                                                                                                           |
| IC-2 Movement reversal                                               | ⬜ NOT STARTED | Depends on IC-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IC-3 Receiving consolidation                                         | ⬜ NOT STARTED | Depends on IC-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IC-4 Branch transfer / MMJ rebuild                                   | ⬜ NOT STARTED | Depends on IC-1, IC-3. Carries an open product-semantics question (see implementation plan's own IC-4 section: whether "in transit" should mean physically moving vs. merely reserved) that needs product-owner resolution before or during this phase.                                                                                                                                                                                                                |
| IC-5 RepairOrder physical-location projection consolidation          | ⬜ NOT STARTED | Depends on IC-1, IC-3.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IC-6 Legacy writer/helper removal                                    | ⬜ NOT STARTED | Depends on IC-1 (balance-getter replacement), IC-4 (311 disposition), IC-5 (Zone 5 direct-write removal).                                                                                                                                                                                                                                                                                                                                                              |
| IC-7 Inventory security/write-boundary closure                       | ⬜ NOT STARTED | Depends on IC-0's own live findings plus whatever IC-4 already closed.                                                                                                                                                                                                                                                                                                                                                                                                 |
| IC-8 Full inventory regression / concurrency / performance hardening | ⬜ NOT STARTED | Final phase before the INVENTORY CORE FINAL GATE.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **INVENTORY CORE FINAL GATE**                                        | ⬜ NOT REACHED | Required before Phase 10D (Container QR) may resume.                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## Change log

- **2026-09-15 (Inventory Architecture Consolidation Audit)**: a READ-ONLY
  audit (on branch `zone3-zone5-integration-audit`, continuing from the
  Zone 3 ↔ Zone 5 integration audit) examined every production-capable
  inventory write path live: the generic movement engine
  (`inventory_finalize_posting`, self-documented "v1: on_hand only"), the
  reservation/allocation engines (Phase 10A/10B, correct and kept as
  dedicated domain operations), Phase 10C's own container engine (correct,
  unchanged), Zone 5's receive/putaway RPCs, a **previously-undiscovered
  full inter-branch transfer system** (`inventory_branch_transfers` +
  `inventory_create_branch_transfer`/`inventory_accept_branch_transfer`/
  `inventory_decline_branch_transfer`) that is **live-proven broken**
  (`inventory_accept_branch_transfer` crashes immediately with `42883:
function public.inventory_allocate_movement_number(uuid, uuid) does not
exist`, and would additionally violate a `NOT NULL` constraint and
  reference a nonexistent `movement_kind` column even if that were fixed —
  confirmed via a live, rolled-back RPC call, not inferred from schema
  alone), and the legacy `ambra-location-inventory.ts` writers (confirmed,
  again, zero UI callers). Found movement code `311` has zero real usage
  ever (0 posted headers) and is one-sided by its own type-catalog
  definition. Found `inventory_v1_get_or_create_balance` lacks lot/serial
  support unlike its own already-existing replacement. No reversal RPC
  exists despite the schema already carrying `original_movement_id`/
  `reversal_movement_id` columns. Delivered a 25-section audit report
  (executive conclusion, architecture diagram, write-path inventory,
  canonical/derived/remove classification, movement catalog, 801-vs-311
  resolution, branch-transfer trace, source-of-truth matrix, security/
  performance/concurrency/audit-trail review, and an explicit final answer:
  today, at least three parallel/competing mechanisms exist; the proposed
  consolidation plan collapses them to one). **Nothing was modified. No
  migration applied. Phase 10D not started.**
- **2026-09-15 (Inventory Core consolidation plan authored)**: the audit was
  accepted as authoritative. Product owner closed 19 architectural decisions
  (see `inventory-core-architecture.md` §0). This session authored the full
  target architecture (`inventory-core-architecture.md`: domain model,
  movement-semantics boundary, source-of-truth contract, core invariant
  specification classified by enforcement layer, sanctioned-movement design,
  reversal design, global lock-order convention, security/performance/
  audit-trail/legal-boundary plans) and the full ordered implementation
  roadmap (`inventory-core-implementation-plan.md`: IC-0 through IC-8, each
  with exact goal/scope/tables-functions-files/what-must-not-change/
  migrations/invariant-changes/tests/live-verification/concurrency-tests/
  data-reset-consequences/rollback-strategy/acceptance-criteria/hard-stop-
  condition; a final minimal movement-code catalog resolving 311's own
  retirement; a receiving-consolidation API boundary; a Handling Unit
  operations plan; a unified test-strategy matrix; and the exact recommended
  scope for IC-1, the first authorized implementation phase). Added an
  explicit cross-reference to the Zone 3 tracker
  (`docs/mvp/zones/03-repair-orders-progress.md`): **Phase 10D is now marked
  BLOCKED ON INVENTORY CORE CONSOLIDATION**, not merely "next." **No IC
  phase was implemented.** No migration applied. No application code
  modified. Phase 10D not started. Stopping point, per explicit instruction:
  IC-1 was NOT started; its own exact authorized scope is recorded in the
  implementation plan for the next turn's own explicit go-ahead.
