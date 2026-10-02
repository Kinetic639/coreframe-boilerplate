# Repair-order import, storno, KPZ (2026-10-02)

## Product decisions

- **The Matcher only parses, matches and saves a session.** Its "approve" button now only marks a session as reviewed. It no longer creates repair orders.
- **Repair orders come from a generic import in the Workshop** (`/dashboard/warsztat/import`). Sources plug in as adapters; the Matcher is the first one.
- **The PZ import reuses the same import** for its Matcher session: a "Zlecenia z tej dostawy" section creates the missing orders before posting.
- **A PZ line is attributed to a repair order by ZL number + part code**, whatever created the order:
  - capped at what is still outstanding (ordered − received on posted PZs + taken back by KPZ);
  - a re-imported delivery never receives the same part twice;
  - the excess stays as free stock.
- **Storno (900)** reverses a whole document. **KPZ (102)** corrects a posted PZ downwards, line by line, linked to it.

## Database

Migration `20261002113940_repair_order_import_and_receipt_correction` (applied to supabase-target, additive):

- **`repair_orders_import(actor, org, branch, orders)`**
  - reuses an open order with the same ZL; closed or archived is a conflict; otherwise creates the order;
  - writes Matcher provenance (source documents/lines), so re-importing a session is a no-op.
- **`inventory_attribute_receipt_to_repair_orders(actor, movement, lines[{movement_line_id, zl_number, product_code}])`**
  - open orders only; product codes are compared normalised (`repair_order_normalize_product_code`);
  - capped by `repair_order_line_outstanding_receipt`.
- **KPZ catalog entry** `inventory_ensure_receipt_correction_type`: document `KPZ/{year}/{seq:6}` and movement 102 (adjustment, on_hand decrease at the source), seeded for every organisation.
- **Table `inventory_movement_correction_lines`** records which PZ line each KPZ line corrects and by how much.
  - RLS: read requires `warehouse.inventory.read`.
  - It is written only by the RPC.
- **`inventory_post_receipt_correction(actor, org, branch, pz, lines[{original_line_id, quantity}], reason)`**
  - takes back at most the line quantity minus earlier posted KPZs, from the location the PZ put it;
  - corrects free stock first, then the repair-order receipt (a `reversal` link on the KPZ line);
  - if the stock has moved on or is committed, the engine refuses with P0003.

Migration `20261002121410_seed_movement_field_policies_for_new_orgs`:

- **Fixes:** an organisation created after the June seed had no movement field policies, so the PZ import failed with "Movement field policy is missing".
- **`inventory_seed_movement_field_policies(org)`** seeds the canonical definitions and policies for 101/311/801. It is idempotent and never touches customised rows.
- **Trigger on `inventory_movement_types`** runs it when one of those types is added.
- **Backfill:** run for all organisations; all five now have 66 policies.

The engine (`inventory_create_draft` / `inventory_finalize_posting`) is unchanged.

## Why the old attribution was replaced

`inventory_attribute_receipt_lines` matched the WDD matcher line id against `workshop_source_document_lines`. Those lines come from the brand-order blocks, while the PZ imports WDD blocks. So only direct-order lines ever matched, even for a materialised session.

## App

- **Storno**
  - "Storno" button on a posted movement, with a required reason; error codes are mapped.
  - Not offered for 311/312/900, or when the movement is already reversed.
  - The detail page links related documents both ways (reversed by / reversal of / correction / correction of).
- **KPZ**
  - "Korekta (KPZ)" on a posted PZ: per-line quantity up to what is still correctable, plus a reason.
- **Workshop "Import zleceń"**
  - pick a source and session, then a preview per ZL (new / existing / existing with new parts / conflict) with per-part state;
  - import the selected orders.
- **PZ import dialog**
  - the same review embedded;
  - "Set unit for all rows without one";
  - toasts show the server's reason;
  - after posting, a toast says how many lines went to repair orders and how many stayed free.
- **Movement editor** no longer offers 102/261/900; they are posted by their own flows.
- **Location history** shows 102 as an adjustment.

## Tests

- Vitest:
  - new `repair-order-import.service.test.ts`;
  - updated receiving-service, PZ attribution, matcher approval and inventory-actions tests.
- The broad run is green except the pre-existing failures this branch does not touch: `placeholder-pages.test.tsx` and the organization-invitation tests.
- `pnpm type-check`, `pnpm build`: pass.
- **Not run live:** the new RPCs have no pgTAP coverage yet and were not exercised against real data; they need an end-to-end pass in the app.

## Known limits

- A PZ saved as a draft and posted later is still not attributed: the ZL and part code are not stored on draft lines.
- KPZ only corrects downwards; a surplus is a new PZ.
- KPZ is refused once the stock has left the receiving location (put away, issued or reserved).
