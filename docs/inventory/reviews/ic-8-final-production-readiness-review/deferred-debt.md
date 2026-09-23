# IC-8 — Section 31: Deferred Debt List

Per Section 37's own change policy, IC-8 fixed exactly one HARD blocker
(the ledger raw-insert bypass) and reconstructed 7 historical migration
files for reproducibility. Everything below was found during this pass
but deliberately NOT fixed, because none of it is a genuine hard
correctness/security blocker for the accepted architecture — fixing any
of it would be feature work, unrelated-domain work, or speculative
cleanup, all explicitly out of scope for a verification-first gate.

## 1. Reproducibility gap beyond the 7 reconstructed zone5 migrations (HIGHEST PRIORITY)

149 live-applied migration versions have no local file at the same
timestamp (106 with no local file even by name), including core
Inventory infrastructure (the movement-engine's own foundational
migration series, `warehouse_locations`' base table, the wdd_matcher
provenance tables). See `migration-reproducibility.md` for the full
finding. **This is the one item on this list that blocks Inventory Core
from being called "final"** — every other item here is real but
non-blocking debt.

## 2. Dead, partially-broken code: `apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts`

An un-cleaned fork of code already deleted from `apps/web` in IC-6. Four
server actions perform direct (non-RPC) writes against
`inventory_containers`/`_lines` and `inventory_balances.allocated_
quantity`. Since PRE-IC8-P0's revoke of `inventory_balances` write
privileges, 3 of 4 functions would fail their balance-side write if
invoked — 2 of those 3 silently swallow the error, which would produce
silent bookkeeping drift on `allocated_quantity` if ever exercised.
Confirmed dead (zero imports anywhere in `apps/public-web`, no
`locations` route exists there at all). See `security-evidence.md`.

**Recommendation**: delete the file, or migrate its 4 actions to the
canonical RPC surface (`inventory_add_to_container`, `inventory_remove_
from_container`, movement-based relocation) the way `apps/web`'s
equivalent was already handled in IC-6.

## 3. Two fully-built-backend, zero-frontend RPCs

- `receive_repair_order_stock` / `putaway_repair_order_stock` — real,
  secured, pgTAP-tested (through A8), zero TypeScript callers in either
  app.
- `inventory_reverse_movement` — real, secured, extensively tested
  (including this pass's own ledger-fix regression check), zero
  TypeScript callers in either app. The only reachable "undo" today is
  `inventory_cancel_movement` (draft-only cancellation) — reversing an
  already-posted movement has no product entry point.

Both are DB-layer-correct; this is a product/frontend gap, not an
architectural defect. See `security-evidence.md`.

## 4. Bare `RAISE EXCEPTION` without explicit `USING ERRCODE` in reservation/allocation RPCs

`inventory_create_reservation`/`inventory_release_reservation`/
`inventory_create_allocation` all default to `P0001` for every internal
error condition (no explicit errcode assigned). This is a broad,
easily-collided error class — if a future change to any of these
functions (or anything they call) introduces a new `P0001` in the same
call chain, the TS-layer's `_KNOWN_ERRORS` allowlist pattern-matching
could silently misclassify it. No live collision currently exists.
Flagged by the caller-audit agent's error-contract review
(`security-evidence.md`, Section 8).

## 5. Orphaned error-allowlist entry for `inventory_seal_container`

The `REPAIR_ORDER_CONTAINER_KNOWN_ERRORS` allowlist includes an entry for
`Container cannot be sealed from its current status`, but no TypeScript
caller anywhere invokes `inventory_seal_container`. Harmless (the
allowlist entry is simply ready for a not-yet-wired RPC), but worth
confirming whether sealing is a planned near-term feature or should be
removed from the allowlist for clarity.

## 6. Pre-existing, unrelated test failures (not caused by Inventory Core work)

Found during Section 11's Vitest run, all traced to commits that predate
and are unrelated to the Inventory Core A1-A8/Zone3-Zone5 work:

- `rls-permission-invariants.test.ts` — stale assertion missing the
  pre-existing `vmi.*` wildcard (from `b420f68b`, already on `main`).
- `event-visual-model.test.ts` — stale assertion missing the pre-existing
  `QR` audit category (from `76b7694b`, already on `main`).
- `build-admin-sidebar-model.test.ts` — fails identically on `main`
  (zero diff on this branch).
- `organization/__tests__/actions.test.ts` (`createInvitationAction`) —
  a genuine, real bug: the test's own mocks never mock `next/headers`,
  so `getTrustedRequestOrigin(await headers())` throws outside a request
  context and the action swallows it into a generic error. Traced to
  commit `d4e0c32e "mvp base"`, near the start of this branch's history,
  unrelated to Inventory Core.
- `placeholder-pages.test.tsx` — whole-suite module-resolution failure
  from a broken/incomplete pnpm-hoisted `next-intl` → `next/navigation`
  nested install. Environment/dependency issue, zero source diff.

None of these are Inventory Core regressions; none were fixed in this
pass per Section 37's own domain-scope discipline. Worth separate
tickets outside Inventory Core's own tracking.

## 7. Redundant index on `inventory_balances`

`inventory_balances_last_movement_idx` (partial, `WHERE last_movement_id
IS NOT NULL`) is made strictly redundant by `inventory_balances_last_
movement_id_idx` (same column, no WHERE clause). Negligible cost at
current row counts; safe to drop the partial one in a future pass. See
`performance-evidence.md`, Section 14.

## 8. Shared per-organization `inventory_settings` row lock (unmeasured contention risk)

Every document-numbering RPC (movement, reservation, allocation, PO,
branch-transfer create) locks the same one `inventory_settings` row per
org before incrementing its own counter. This serializes unrelated
concurrent document creation within the same org. Flagged by the
architecture compression review's own performance handoff; still
structurally true post-A1-A8 (confirmed via `pg_get_functiondef`); not
measured under real load in IC-8 due to lack of safe concurrent-session
tooling this pass (see `performance-evidence.md`, Section 15, item 7).
Worth a genuine concurrent-session benchmark before high-volume
production use, and worth reconsidering as part of any future
document-numbering centralization pass.

## 9. `inventory_stock_ledger_entries` unbounded growth, no partitioning

Deliberately append-only (correct), but no `PARTITION BY`/archival
strategy exists. Not urgent at current (118-row) volume; worth a
`posted_at`-range partitioning plan before production volume grows large.
See `performance-evidence.md`, Section 15, item 9.

## 10. Valuation-snapshot defect (`inventory_balance_analytics` view missing live)

Pre-existing, found by the architecture compression review (not this
pass): a tracked migration defining `inventory_balance_analytics`
appears to have never been applied to (or was lost from) the live
database — a migration/DB-drift bug, not a removed-on-purpose feature.
Zero current usage/callers found at the time of that finding.
Recommendation from that review: DEFER (a combined SQL-fix + UI-build
decision, not urgent). Not independently re-verified live in this pass
(out of IC-8's own scope — no evidence found that this defect relates
to the accepted architecture's own hard-blocker criteria); carried
forward here for visibility.

## 11. Reservation/allocation/container lifecycle has no dedicated audit trail

Only the bare row (`created_by`/`created_at`/`cancelled_by`) records
who/when for reservation, allocation, and container state changes — no
structured audit-log entry the way the movement lifecycle gets (ledger +
`inventory_movement_audit_log` + app-level event). Architecturally
consistent (the ledger is scoped to physical `on_hand` effects only), but
a real gap for "who released this reservation and why"-style questions.
See `audit-trail-matrix.md`.

## 12. Naming/discoverability debt (not correctness debt)

- The RepairOrder-specific container wrapper (`repair_order_add_
allocation_to_container`) vs. the generic primitive it wraps
  (`inventory_add_to_container`) is not self-evident without knowing the
  A7 domain-boundary history — a developer reaching for the generic
  primitive directly for a RepairOrder use case will get correctly
  rejected (Section 6/16(F)), but the "why" requires migration-history
  archaeology.
- Movement-type numeric codes (e.g. `"801"` for relocation) require
  cross-referencing `inventory_movement_type_field_policies` seed data;
  not documented inline anywhere a new developer would naturally look.
- `inventory_balances` cannot be touched directly even from trusted
  internal code paths (enforced via table-privilege revoke +
  `inventory_guard_balance_write()` trigger) — the "why" requires reading
  the PRE-IC8-P0 review bundle, not just the schema.

See the caller-audit agent's full Part 3 (developer onboarding test) for
the complete list of onboarding friction points, most of which are
documentation debt rather than code debt.
