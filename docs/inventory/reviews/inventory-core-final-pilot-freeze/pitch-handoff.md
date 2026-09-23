# Inventory Core — Pitch Handoff

Input for the AMBRA PITCH READINESS AUDIT. This is the exhaustive list
of product-facing Inventory gaps IC-8 discovered — backend/UI status
per capability, not a re-litigation of the architecture itself.

## 1. `inventory_reverse_movement`

- Backend: ✅ ready — secure, tested (IC-2 origin, re-verified through
  IC-8 and this closing pass's own narrow regression).
- UI: ❌ zero callers in either `apps/web` or `apps/public-web`.
- Product impact: a user who posts an incorrect movement today has
  no way to undo it from the product. The only reachable "undo" is
  `inventory_cancel_movement`, which only applies to still-draft,
  never-posted movements.
- Pitch audit should check: does the pitch script demo an
  error-correction/undo flow? If yes, this needs UI before the pitch.
  If no, this is safe to leave as a known, disclosed gap.

## 2. `receive_repair_order_stock`

- Backend: ✅ ready — secure, pgTAP-tested through A8.
- UI: ❌ zero callers in either app.
- Product impact: RepairOrder's stock-receiving story is "not yet
  connected to any UI" — the capability exists and is correct, but no
  user can trigger it through the product today.
- Pitch audit should check: does the pitch script demo RepairOrder
  stock receiving specifically?

## 3. `putaway_repair_order_stock`

- Backend: ✅ ready — secure, pgTAP-tested through A8.
- UI: ❌ zero callers in either app.
- Product impact: same pattern as #2 — receiving and putaway are a
  matched pair; if receiving needs UI for the pitch, putaway almost
  certainly does too.
- Pitch audit should check: same as #2.

## 4. Branch transfer

- Backend: ✅ ready — full create→send→accept/decline/cancel lifecycle,
  proven safe under genuine live concurrency (double-send, double-accept
  both tested).
- UI: ✅ already wired — `acceptInventoryBranchTransferAction`/
  `declineInventoryBranchTransferAction` are imported and invoked from
  `inventory-movement-detail-panel.tsx`; the full lifecycle is reachable
  from the generic Movements UI (embedded there, not a standalone
  "Transfers" page — a minor discoverability wrinkle, not a
  completeness gap).
- Product impact: none — this capability is demo-ready as-is.
- Pitch audit should check: nothing blocking; note the embedded-not-
  standalone UI placement if the pitch script expects a dedicated
  Transfers screen.

## 5. A8 RepairOrder physical-state live read (`get_repair_order_line_physical_state`)

- Backend: ✅ ready — single-query, `SECURITY INVOKER`, replaces the
  entire pre-A8 incremental-projection subsystem (removed).
- UI: ❌ currently zero production UI callers.
- Product impact: the underlying data (where a RepairOrder's stock
  physically sits) is correctly computable on demand, but nothing in
  the shipped product currently displays it.
- Pitch audit should check: does the pitch script show RepairOrder
  physical-location state anywhere (e.g., "this part is on shelf X")?
  If yes, this needs a UI caller wired up first.

## 6. Dead public-web writer

- `apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts`
  — confirmed dead (zero imports, zero dynamic references, zero test
  dependencies, no route in `apps/public-web` ever exposed it) and
  **removed in this closing pass**. See `changed-files.md`.
- Product impact: none — it was unreachable before removal and remains
  unreachable now; removal only eliminates latent risk (2 of its 4
  actions would have silently corrupted `allocated_quantity`
  bookkeeping if ever wired up after PRE-IC8-P0's balance-write revoke).
- Pitch audit should check: nothing — this item is closed.

## Summary table

| Capability             | Backend       | UI  | Pitch-blocking?                               |
| ---------------------- | ------------- | --- | --------------------------------------------- |
| Reversal               | ✅            | ❌  | Only if pitch demos undo/error-correction     |
| RepairOrder receive    | ✅            | ❌  | Only if pitch demos RepairOrder receiving     |
| RepairOrder putaway    | ✅            | ❌  | Only if pitch demos RepairOrder receiving     |
| Branch transfer        | ✅            | ✅  | No                                            |
| A8 physical-state read | ✅            | ❌  | Only if pitch demos physical-location display |
| Dead public-web writer | N/A (removed) | N/A | No — closed                                   |

## What pitch work may and may not do (architecture freeze rule)

Pitch work MAY: add UI, add service callers, expose existing RPCs,
improve loading/error/empty states, prepare demo data, add browser/UAT
coverage, fix concrete bugs.

Pitch work MUST NOT: bypass canonical Inventory RPCs, raw-write
protected Inventory tables, introduce a second stock source of truth,
duplicate movement logic in TypeScript, or reopen A1-A8 architecture
without a concrete, proven blocker.

Every gap in this document is a "needs a UI caller for an existing,
secure, tested RPC" gap — none of them require touching Inventory Core's
own architecture, migrations, or RLS policies. This is by design: the
backend was deliberately built ahead of its UI in these five spots, not
left accidentally incomplete.
