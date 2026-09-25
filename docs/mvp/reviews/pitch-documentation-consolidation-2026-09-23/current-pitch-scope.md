# Current Pitch Scope — Authoritative Statement

Single source of truth for what the pitch demo must include, resolving the container-workflow scope question definitively.

## The governing decision

**2026-09-10, product-owner directive** (`docs/mvp/zones/03-repair-orders-progress.md`, "SCOPE EXPANSION" banner; independently corroborated in `docs/mvp/zones/03-repair-orders-container-workflow-audit.md`'s own "Scope trigger" note):

> The full physical container workflow (`RepairOrderLine → Reservation → Allocation → Container → Container QR → Container location → 801 relocation → WU 201/WZ → issue history`) is now **PITCH**, not PILOT — this supersedes the container-workflow audit's own PILOT classification, which was based solely on the then-active pitch script omitting the workflow. Generic reversal and Legacy Stock 105/PZ-I remain PILOT.

This decision is dated **AFTER** `docs/mvp/mvp-readiness.md`'s own "Otwarte decyzje zakresu przed kodowaniem" section (2026-09-07/08), which had recommended narrowing/removing container QR and container relocation from the demo. **The later decision supersedes the earlier recommendation.** This consolidation pass corrects every document that still presented the earlier recommendation as an open or default choice.

## What this means, concretely

| Capability                                                                 | Status                                                            | Phase                                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Container QR (create, print, scan, resolve)                                | **PITCH REQUIRED** — build it                                     | Phase 10D                                                                               |
| Container relocation (scan container QR → scan new location)               | **PITCH REQUIRED** — build it                                     | Phase 10E                                                                               |
| 201/WZ issue (proper document type, recipient field, not a 402 workaround) | **PITCH REQUIRED** — build it                                     | Phase 10F                                                                               |
| Per-piece (individual part) permanent QR identity                          | **NOT required, correctly narrowed** — select from a list instead | N/A — not part of the container-workflow decision, a separate and still-valid narrowing |
| Generic movement reversal (`inventory_reverse_movement` UI)                | PILOT only                                                        | N/A                                                                                     |
| Legacy Stock 105/PZ-I                                                      | PILOT only                                                        | N/A                                                                                     |

## Why per-piece QR is different from container QR

These are two distinct physical-identification questions, resolved oppositely, on purpose:

- **Container QR**: the container/kit — a physical grouping of multiple parts — gets a real, printable, scannable QR identity. This is now PITCH REQUIRED per the 2026-09-10 directive.
- **Per-piece QR**: an individual part does NOT get a permanent digital QR identity. The accepted architecture's own physical-identification units are location and container — never a single loose part. During putaway, the operator selects the delivery item from a list rather than scanning a part-level code. This narrowing was already correctly recommended in `mvp-readiness.md` and remains correct — it was never reopened by the 2026-09-10 directive, which is specifically about the CONTAINER workflow.

## Corrected pitch script

`docs/mvp/ambra-skrypt-prezentacji.md` has been updated this pass to reflect this scope exactly:

- §5 (platform overview): QR described as covering locations and containers, not "locations, parts, and other objects."
- §7 (receiving/putaway): "select item from delivery list → scan location → confirm" (no part-level scan).
- §9 (daily work): single-part relocation (scan new location) remains as before; a new container-relocation flow added (scan container QR → scan new location).
- §10 (issue): explicitly references the 201/WZ document type with a recipient field, not a generic adjustment.
- §12 (tickets): the unwired ticket↔RepairOrder/part linking claim removed, replaced with an explicit "this is a future direction" note.
- Every section tagged **[LIVE DEMO]** / **[NARRATIVE]** / **[ROADMAP]**.

## Minimum complete presentation flow (current)

```
physical source documents
  → public Matcher                                          [LIVE DEMO]
  → persistent/authenticated Matcher (session)               [LIVE DEMO]
  → RepairOrder materialization                              [LIVE DEMO]
  → receiving (101) + mobile putaway                         [LIVE DEMO — P0 blocker, UI not built]
  → reservation / allocation / container                     [LIVE DEMO — backend ready, container UI pending 10D]
  → container QR                                             [LIVE DEMO — P0 blocker, Phase 10D not started]
  → physical location state / search                         [LIVE DEMO — real, working]
  → relocation (single part + container via QR)               [LIVE DEMO — single-part real; container pending 10E]
  → 201/WZ issue                                              [LIVE DEMO — P0 blocker, Phase 10F not started]
  → history / documentation                                   [LIVE DEMO — real]
  → ticket/exception example                                  [LIVE DEMO — short, narrow]
  → pilot proposal                                            [NARRATIVE]
```

No step in this flow can be safely removed without either (a) contradicting the already-corrected script's own promise, or (b) requiring a NEW product-owner narrowing decision distinct from the 2026-09-10 directive above. This pass does not propose removing any step — it documents what must be built to keep every step honest.
