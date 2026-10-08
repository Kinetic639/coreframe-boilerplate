# Zone 5 — Receiving zone and putaway (2026-10-01)

The design follows the product decisions recorded in
`docs/mvp/zones/05-receiving-putaway.md` → "Product decisions (2026-10-01)".

## Database

Migration `20261001132408_zone5_receiving_zone_and_putaway` was applied live
via MCP and mirrored locally. It is additive only; no existing function was
modified.

| Object                                                                                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Triggers `inventory_reservation_lines_not_at_receiving`, `inventory_allocation_lines_not_at_receiving` | Stock in a `purpose='receiving'` location cannot be reserved or allocated (22023).                                                                                                                                                                                                                                                                                       |
| Table `inventory_product_branch_settings`                                                              | Per-branch `handling_mode` (`standard` / `bulk`) and an optional fixed `default_location_id`. RLS is enabled and forced. Read requires `warehouse.inventory.read`; write requires `warehouse.products.manage`.                                                                                                                                                           |
| `inventory_attribute_receipt_lines(actor, movement, lines)`                                            | Links a posted 101's lines to their RepairOrderLines through their Matcher lines (`attach_repair_order_line_movement`). It fills a RepairOrderLine's missing `variant_id`, and skips and reports lines it cannot resolve.                                                                                                                                                |
| `inventory_receiving_pending(org, branch)`                                                             | What waits in the receiving zone: one row per RepairOrderLine (via the same reversal-aware ledger formula `putaway_repair_order_stock` uses) plus the free remainder per item. Each row carries its handling mode, fixed location and the RepairOrder's container.                                                                                                       |
| `inventory_putaway_from_receiving(actor, org, branch, variant, qty, dest, rol?, container?)`           | One atomic putaway. Free stock gets an 801. A RepairOrder bulk item gets `putaway_repair_order_stock` plus a reservation for the line at the destination. A RepairOrder standard item gets `putaway_repair_order_stock`, then reservation, then allocation, then placement into that RepairOrder's container at the destination: the existing one, or a new `K-<ZL>-NN`. |

The security pattern matches the earlier phases:

- the actor must be the caller (`28000`);
- the caller needs `has_branch_permission(..., 'warehouse.inventory.operate')`, or `read` for the list;
- EXECUTE is revoked from PUBLIC and anon.

**Note on applying migrations.** The Supabase MCP server asks for an extra
confirmation on `DROP ...` statements, and this environment cannot show that
confirmation. Migrations containing `DROP ... IF EXISTS` were therefore
silently declined three times. The applied version has no `DROP` statements;
it does not need them, because all objects are new.

## Application

- **PZ editor / actions.** A 101 always lands in the receiving zone: it is forced server-side in `createDraftMovementAction` and `createAndPostMovementAction`, and the destination is locked in the editor with a hint. Imported lines carry `source_type` / `source_line_id`. After posting, Matcher lines are attributed to RepairOrderLines. This step is best effort; an unlinked line simply appears as free stock in the receiving zone.
- **"Do rozlokowania".** Route `/dashboard/warehouse/putaway` (PL: `/dashboard/magazyn/rozlokowanie`), with a sidebar entry under Inventory.
  - The list is grouped per ZL, with free stock last.
  - Each item shows a suggestion: the RO container, a new container, or its fixed location.
  - "Rozłóż" opens a dialog: scan a location sticker (or take the suggestion, or pick from the list), adjust the quantity for a partial putaway, confirm.
- **Product page.** A "Rozlokowanie w oddziale" card sets the handling mode and the fixed location.
- **PZ detail page.** A "Rozlokowanie dostawy" report shows, per line: ZL, where the line went (location, MM document), container, and what still waits in PRZ. It offers CSV export (semicolon-separated, UTF-8 BOM) and print.
- **Receiving zone excluded** from the RO reservation dialog, the container creation form and the container relocation dialog.

## Tests

- **pgTAP:** `apps/web/supabase/tests/118_zone5_receiving_putaway_test.sql` has 22 assertions covering the full chain on a fresh branch. **Run live 2026-10-08: 22/22 pass**, rolled back, by the product owner in the Supabase SQL Editor (MCP declines the script). The file now ends with a `RAISE EXCEPTION` that reports the result, because the SQL Editor shows only the last statement; the error also aborts the transaction.
- **pgTAP 101 and 102** reserve at a receiving location on purpose, to prove IC-1. They now disable the two new triggers inside their own transaction, which is rolled back. Not yet re-run live.
- **Vitest (new):**
  - `inventory-receiving.service.test.ts`: pending mapping, putaway arguments and result, 9 error mappings, attribution, report tracing;
  - `actions/warehouse/__tests__/receiving.test.ts`: gates, input, identity;
  - `inventory/__tests__/pz-receiving-zone.test.ts`: PZ forced to PRZ, attribution pairing, no attribution on failure or without imported lines;
  - `putaway/_components/__tests__/putaway.test.tsx`: grouping, suggestions, dialog scan, confirm, refusals, partial bulk;
  - `receipt-putaway-report.test.tsx`: status, CSV;
  - `product-handling-card.test.tsx`.
- **Regression:** 52 files, 619/619 tests passed. The pre-existing, unrelated `placeholder-pages.test.tsx` module-resolution failure is unchanged.
- `pnpm type-check` passes. eslint reports 0 errors; the warnings it shows were already there.

## Known limits / next

- A PZ saved as a draft and posted later loses the link from Matcher line to RepairOrder. Those lines show as free stock in PRZ. Manual "assign to repair order" from the receiving zone is not built yet.
- For free lines, the report traces 801s out of PRZ for the same item since the PZ was posted. This is approximate when several PZs bring the same item.
- Ticking off bulk lines on the issue belongs to Phase 10F.
- Live E2E has not been run. The demo needs a real Matcher session materialized into ROs (the existing demo ROs were created via SQL without Matcher provenance).
