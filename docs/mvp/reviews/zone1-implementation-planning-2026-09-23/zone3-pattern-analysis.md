# Zone 3 Execution Pattern Analysis

Source files studied: `03-repair-orders.md`, `03-repair-orders-implementation-plan.md`, `03-repair-orders-progress.md`, `03-repair-orders-phase0a-baseline.md`, `03-repair-orders-container-workflow-audit.md`, `03-05-integration.md`.

## Three-file separation

- **`03-repair-orders.md`** — frozen architecture/product source of truth. Owns accepted decisions, workflows, domain model. Not a daily log.
- **`03-repair-orders-implementation-plan.md`** — owns phase structure: 24 phases (0A, 0B, 1-13, 10A-10F, 14, 15), each with a strict per-phase template.
- **`03-repair-orders-progress.md`** — owns live execution state: phase table, mechanical task counts, evidence, blockers, "SCOPE EXPANSION"/"SCOPE CORRECTION" banners recording later product-owner directives without rewriting history.

This exact three-way separation is reproduced for Zone 1.

## Phase header convention (confirmed via grep)

`## Phase N — Name`, with an optional inline suffix once complete: `DONE (date — details)`, e.g. `## Phase 10C — Container orchestration (Allocation to Container) — DONE (2026-09-14)`. No suffix = not started. Phases 10D/10E/10F carry no suffix, confirming they remain not started — directly relevant since this task's own instructions single out Phase 10D by name as a boundary not to be touched.

## Phase granularity discipline

24 phases for one zone (RepairOrders) — proof that Zone 3's own discipline favors MANY small, single-concern phases over a handful of large multi-surface ones. Phase 10 alone was split into 6 sub-phases (10A-10F) precisely because container orchestration, container QR, and container relocation are distinct concerns with different risk profiles and different completion dates (10A-10C done 2026-09-14, 10D-10F still not started). This is the strongest direct evidence against blindly reusing Zone 1's own 3-change recommendation as final phase structure — Zone 3's own precedent is granular, not consolidated.

## Baseline/reconciliation report pattern (Phase 0A)

`03-repair-orders-phase0a-baseline.md`: a point-in-time, read-only report that closes a Phase 0 WITHOUT attempting full historical migration reconciliation. Corrected an earlier overstated drift claim (172 live migrations, 125/171 name-matched = 73%, not "only 1 matches"). Explicitly rejects "replay/rewrite all N missing migrations" as disproportionate; accepts residual drift as documented, out-of-scope debt; commits going forward to live-verify every new migration. Directly reused for Zone 1's own Phase 0 (marked DONE citing the pre-implementation verification bundle) and for PILOT Phase E's own scoping ("this phase only needs to close THESE specific 6 tables' own missing-source problem," explicitly not reopening Inventory Core's separately-accepted reproducibility gap).

## Open-decisions-block-further-design, not earlier phases (container workflow audit, section 29)

`03-repair-orders-container-workflow-audit.md` section 29 lists 7 numbered "Open Product Decisions (blocking further design, not blocking Phase 3 itself)". This is the template reused for Zone 1's own confirmed-but-deferred security gaps (owner-only gating, anti-escalation, etc.) — they are real, they are recorded, but they do not block the DEMO-READY phase sequence, per this task's own Section 9 instruction. Reused concretely in PILOT Phase D's blocker rule (Help Desk branch-scoping is an explicit open product decision) and in the progress tracker's own change-log entry for that same finding.

## Manual UAT as its own phase, separate from implementation

Zone 3's plan includes a distinct pitch-E2E/DEMO-READY-verification phase, separate from and dependent on the implementation phases preceding it — passing automated tests is a gate INTO that phase, not a substitute for it. Directly reused as Zone 1's Phase 8 (DEMO READY UAT) and PILOT Phase I (PILOT READY verification), each preceded by its own dedicated automated-closeout gate phase (Phase 7 for DEMO; folded into each PILOT phase's own testing requirements for PILOT, since PILOT phases are far enough out that a single closeout gate phase would be premature to define in detail now).

## Mechanical task counts, never rounded percentages

Zone 3's progress tracker keeps exact X/Y counts recomputed from actual checkbox counts. Reused exactly for Zone 1's progress tracker — verified this task by grep-counting checkboxes directly from the implementation plan file rather than estimating (9/95 total, 9/48 pitch-required, 0/47 pilot-required).

## What was deliberately NOT copied

Zone 3's specific phase NAMES/numbers (0A/0B/10A-10F etc.) are domain-specific to RepairOrders/container workflow and were not mechanically reused — Zone 1's own phase names (0-8, A-I) were derived from Zone 1's own gap matrix, not from Zone 3's naming scheme. The "SCOPE EXPANSION" banner pattern was noted but not needed yet for Zone 1, since no product-owner directive has yet superseded any part of this plan — the mechanism is documented as available (see the progress tracker's own change-log section, structured to support such banners later without restructuring).
