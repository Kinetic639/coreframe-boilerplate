# Inventory Core — Architecture Compression Review — Context

**Scope**: audit / decision only. No migrations applied, no code
changed, no runtime behavior changed. Answers one question: can
Inventory Core preserve all accepted behavior/invariants/security/
performance with FEWER runtime mechanisms and layers?

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `fb225295` ("ic6a").
- **IC-7 and its closing pass were NOT committed at the start of this
  review** — working tree carried the same 22 modified/untracked paths
  from those two phases (9+4 migrations, 2 new pgTAP files, 3
  corrected pgTAP files, the `ic-7-review` bundle, 3 core doc updates).
  Flagged per this project's standing discipline; treated as the
  accepted IC-0–IC-7 baseline per the user's own explicit framing
  ("IC-0 through IC-7 are ACCEPTED and FINAL"), consistent with the
  standing no-auto-commit policy (nothing was committed by this review
  either).
- IC-8: confirmed not started (no such docs/migrations exist).
- Phase 10D: confirmed not started.

## Methodology

Four parallel, read-only research agents were launched to cover the
full audit scope without risking silent scope-narrowing from a single
pass:

1. **Runtime operation graphs + public RPC classification** — traced
   all 17 named operations end-to-end (UI→action→service→RPC→tables→
   triggers) and classified every `authenticated`-callable Inventory-
   related RPC. (This agent hit a session rate limit right at its own
   finish line; its persisted tool-result output was a complete,
   well-formed two-document synthesis — used directly, not discarded,
   since its content was fully formed and independently verifiable
   against the same live-DB/repo evidence the other three agents also
   produced.)
2. **Internal helper, trigger, and GUC audit** — classified every
   `_internal` function, every Inventory-related trigger, and both
   `ambra.*` GUCs that exist anywhere in the codebase.
3. **Service-layer + RepairOrder domain boundary audit** — audited all
   6 real services (no `RepairOrderStorageService` exists — a
   correction to the task's own assumed service list), classified
   every RepairOrder-specific SQL function/trigger touching core
   tables, and re-derived (rather than accepted) the prior "KEEP"
   verdict on the RepairOrder projection trigger.
4. **Dead code, DRY, and performance audit** — re-verified 5 dead-code
   candidates, classified 4 zero-caller "primitive vs. dead" cases,
   investigated the known valuation-snapshot defect's disposition, ran
   a genuine-duplication (not cosmetic-similarity) DRY sweep, and built
   a 9-item performance-risk inventory for IC-8 to measure.

All findings are live-verified (branch checkout + `supabase-target` DB
via `pg_proc`/`pg_get_functiondef`/`information_schema.triggers`/
`pg_policy`/`pg_indexes`), not copied from prior docs. Every place a
prior document's own claim conflicted with live evidence is flagged
explicitly in the relevant bundle file, not silently corrected.

## Headline findings (full detail in the linked documents)

1. **A CRITICAL, live, currently-exploitable security gap was found
   and escalated to the user immediately during this audit, before the
   full review completed** — `inventory_guard_balance_write`/
   `inventory_guard_settings_write` still treat the caller-settable
   `ambra.inventory_movement_engine` GUC as sufficient authorization on
   `inventory_balances`/`inventory_settings`, directly contradicting
   the frozen fact "raw writes are closed." Not fixed by this audit
   (audit-only scope); recorded as a required pre-IC-8 correctness
   item. See `rpc-helper-trigger-review.md`.
2. **The prior IC-7 "KEEP" verdict on the RepairOrder projection
   trigger is overturned** on evidentiary grounds — the projection it
   maintains has zero production readers, and its own "rebuild always
   equals incremental" justification does not actually hold for the
   generic-movement heuristic branch (a genuine, previously-undisclosed
   P0008 recoverability gap). Recommended: Option D, remove the
   incremental projection, compute live on read. See
   `module-boundary-review.md`.
3. **`InventoryEnterpriseService` is a genuine "kitchen sink"** — 10
   unrelated sub-domains under one non-descriptive name, with one
   concrete duplicated-and-inconsistent business rule (custom-field-
   value writing) found inside it. Recommended SPLIT. See
   `service-boundary-review.md`.
4. **6 confirmed-dead code items** (5 TypeScript, 1 SQL function) with
   zero callers anywhere, including 2 new findings not previously
   disclosed (`InventoryProductsService.listSuppliers`, and — at the
   TS-service-method level — `attachMovementToRepairOrderLine`/
   `getPhysicalStateForLine` both having zero production callers,
   correcting the prior IC-7 review's own entry-point matrix). See
   `dry-review.md` and `service-boundary-review.md`.
5. **Two genuine DRY violations with real drift risk** — document-
   numbering logic (10 sites) and idempotency-check ordering (12
   sites), the latter with direct historical proof of drift (a
   previously-shipped, since-fixed bug in exactly one of the ~10 sites,
   with no evidence the other sites were ever re-audited for the same
   mistake). See `dry-review.md`.
6. **A live UI-completeness gap, not previously surfaced**: 8 distinct
   canonical RPCs (not the 4 the prior docs name) plus 1
   TS-service-method have zero reachable path from the shipped
   product today — most consequentially, `inventory_send_branch_
transfer` has no UI, meaning the branch-transfer lifecycle is not
   actually end-to-end usable from the product as shipped. See
   `runtime-operation-graph.md`.
7. **One confirmed generic-core → RepairOrder-domain dependency**
   (`inventory_add_to_container`'s inline JOIN to `repair_order_lines`)
   with a concrete, TOCTOU-proven-safe extraction design. See
   `module-boundary-review.md`.
8. **The valuation-snapshot defect's root cause was found**: the
   missing `inventory_balance_analytics` view was defined in a tracked
   migration that appears to have never been applied to (or was lost
   from) the live database — a migration/DB-drift bug, not a removed-
   on-purpose feature. Recommendation: DEFER (zero current usage; a
   combined SQL-fix + UI-build decision, not urgent). See
   `dry-review.md`.

## Bundle contents

- `review-context.md` (this file)
- `runtime-operation-graph.md` — all 17 operations, full call graphs, summary table
- `service-boundary-review.md` — all 6 real services audited
- `rpc-helper-trigger-review.md` — every public RPC, internal helper, trigger, and GUC classified; the CRITICAL security finding
- `module-boundary-review.md` — RepairOrder/generic-core boundary, the `inventory_add_to_container` redesign, the projection-trigger challenge
- `dry-review.md` — dead code, zero-caller primitives, valuation snapshot, genuine DRY findings
- `performance-handoff.md` — 9 performance risks for IC-8 to measure
- `simplification-plan.md` — the required SAFE/KEEP/DEFER lists + implementation detail for each SAFE item
- `final-proposed-architecture.md` — the one-page diagram, simplicity test, overengineering verdict

No `diff.patch` — this phase made no code or migration changes.
