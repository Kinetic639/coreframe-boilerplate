# IC-8 — Section 1: Final Architecture Inventory

This updates the architecture compression review's own `final-proposed-
architecture.md` diagram for everything A1-A8 changed since, and
re-confirms each block live this pass rather than assuming it's still
accurate.

## One-page diagram (post-A8, live-confirmed)

```
┌──────────────────────────────────────────────────────────────────┐
│  PUBLIC APPLICATION SERVICES / DOMAIN INTEGRATIONS                │
│  RepairOrdersService · InventoryEnterpriseService                 │
│  InventoryProductsService · InventoryCountSessionsService         │
│  WarehouseLocationsService                                        │
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  PUBLIC DB COMMANDS (SECURITY DEFINER, actor+permission checked)  │
│  create_draft · finalize_posting · create_and_finalize            │
│  save_draft · cancel_movement · reverse_movement                  │
│  receive_stock · create_reservation/release · create_allocation/  │
│  release · create/send/accept/decline/cancel_branch_transfer      │
│  create/add/remove/seal_container (eligibility-gated, A7 correction)│
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  CANONICAL INVENTORY ENGINE                                       │
│  inventory_finalize_posting_internal (the ONE physical writer)    │
│  inventory_get_or_create_balance_for_update (the ONE lock/get)    │
│  inventory_add_to_container_internal (A7-correction, internal-only)│
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  BALANCE + LEDGER (physical truth + immutable history)            │
│  inventory_balances · inventory_stock_ledger_entries               │
│  (ledger INSERT now unconditionally RLS-denied to all roles       │
│   except the SECURITY DEFINER engine — this pass's own fix)       │
└──────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐  ┌────────────────────┐  ┌───────────────┐
  │ RESERVATION/         │  │ TRANSFER            │  │ REPAIRORDER    │
  │ ALLOCATION            │  │ (uses the engine     │  │ ATTRIBUTION    │
  │ (separate commitments │  │  above, same-owner    │  │ (post-A8)      │
  │  over physical stock) │  │  nesting)             │  │ repair_order_  │
  │                        │  │                       │  │ line_movement_ │
  │                        │  │                       │  │ links (SOLE    │
  │                        │  │                       │  │ persisted      │
  │                        │  │                       │  │ source) +      │
  │                        │  │                       │  │ get_repair_    │
  │                        │  │                       │  │ order_line_    │
  │                        │  │                       │  │ physical_state │
  │                        │  │                       │  │ (live read,    │
  │                        │  │                       │  │ NO projection  │
  │                        │  │                       │  │ table left)    │
  └─────────────────────┘  └────────────────────┘  └───────────────┘
```

**What changed since the compression review's own diagram**: the
"domain projections" box previously held two persisted tables + a
trigger (the incremental RepairOrder projection); A8 removed all of it.
The box is now strictly simpler — one already-existing source-of-truth
table (`repair_order_line_movement_links`, unchanged) plus a single
on-demand read function, no trigger, no second persisted table, no
rebuild RPC. Block count is unchanged (still 8 conceptual blocks) — this
is exactly the simplification the compression review's own "if item A8
is implemented" note anticipated, now confirmed live and tested
(`test-evidence.md`, file 116).

## Live re-confirmation of each block (this pass)

- **Public DB commands / engine boundary**: re-confirmed via Section 6's
  own RPC classification table (`security-evidence.md`) — every
  `_internal` function and `inventory_get_or_create_balance_for_update`
  has zero external EXECUTE grants, zero TS callers.
- **Balance + ledger**: re-confirmed via Section 7's adversarial audit —
  the one real gap found (ledger raw-insert bypass) is fixed and
  regression-verified.
- **Reservation/allocation**: unchanged structurally; the commitment
  invariant is proven under genuine live concurrency (`concurrency-
evidence.md`, item A/B).
- **Transfer**: unchanged structurally; both double-send and
  double-accept proven safe under genuine live concurrency
  (`concurrency-evidence.md`, item D). Per the caller-audit agent, the
  full create→send→accept/decline/cancel lifecycle has real UI wiring in
  the generic Movements UI — this **supersedes** the compression review's
  own earlier caveat ("send has no UI"), which is now out of date;
  flagged here explicitly rather than silently carrying the stale claim
  forward.
- **RepairOrder attribution**: re-confirmed via `invariants-and-final-
review.md` (Section 21) — exactly one persisted source of truth, one
  live-computed read, no opportunity for the two to drift.

## Developer onboarding test — re-answered post-A8 (see also the caller-audit agent's own 12-question Part 3)

The compression review's own 10-question onboarding test still mostly
holds; two answers changed materially since A8, and two caveats from
that review are now confirmed as GENUINE, PERSISTENT gaps rather than
transient ones:

- **"How do I rebuild a derived RepairOrder projection?"** — the old
  answer (`rebuild_repair_order_location_projection`) no longer applies;
  the function doesn't exist. New answer: "you don't — it's computed
  live on read via `get_repair_order_line_physical_state`, there is
  nothing to rebuild." Confirmed live.
- **"How do I reverse a mistake?"** — still `inventory_reverse_
movement`, still zero UI callers. This is NOT a transient, "will get
  wired up soon" gap — it has persisted across every IC phase since its
  own IC-2 introduction. Confirmed still true this pass (caller-audit
  agent). This is the single most user-visible product gap surfaced by
  the entire IC-8 pass: **a real user who posts an incorrect movement
  today has no product path to undo it.**
- **RepairOrder receiving/putaway** (`receive_repair_order_stock`/
  `putaway_repair_order_stock`) — same pattern as reversal: real,
  secured, tested, zero UI callers. Confirmed still true this pass.

## Overengineering verdict — re-affirmed, not re-litigated

The compression review's own verdict ("not generally overengineered;
three specific spots of genuine complexity, not a general pattern")
still holds. Of the three spots that review named, one (`InventoryEnterprise
Service`'s "kitchen sink" shape) was not in scope for A1-A8 or IC-8 to
re-assess (no evidence either pass touched its own module boundaries);
one (the RepairOrder incremental projection) was fully resolved by A8,
exactly as that review's own conditional language anticipated; the third
(document-numbering/idempotency-check duplication) is unchanged and
remains real, disclosed, non-blocking debt (`deferred-debt.md`).
