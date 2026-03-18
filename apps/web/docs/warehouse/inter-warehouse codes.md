Below is the complete, professional, enterprise-grade list of movement types you should implement in AmbraWMS, based on:

SAP MM & WM standards

Odoo / Oracle WMS logic

Polish warehouse law and document naming (PZ/WZ/MM/RW/PW)

Automotive + e-commerce + manufacturing workflows

Your app architecture (branches, bins, reservations, VMI, audits, expiry lots, etc.)

This is the final list that covers everything you will ever need in a modern multi-warehouse SaaS WMS.

✅ FULL LIST OF 40 MOVEMENT TYPES FOR AmbraWMS

Organized exactly like SAP MM codes, but adapted for SaaS flexibility.

🟩 1. PURCHASE / SUPPLY CHAIN RECEIPTS (PZ)

101 — Goods Receipt from Purchase Order (PZ)
102 — Goods Receipt Reversal / Correction
103 — GR to QA/Hold Location (Pending Inspection)
104 — QA/Hold → Approved (Putaway)
105 — Direct GR to Consignment Stock (optional)

🟥 2. SALES SHIPMENTS (WZ)

201 — Goods Issue to Sales Order (WZ)
202 — Goods Issue Reversal

🟧 3. PRODUCTION / MANUFACTURING (RW / PW)

301 — Raw Material Issue to Production (RW)
302 — Reverse Issue to Production
303 — Finished Goods Receipt from Production (PW)
304 — Production Scrap Write-Off
305 — Semi-Finished Receipt (for multistage production)

🟦 4. INTER-WAREHOUSE TRANSFERS (MM+ / MM–)

(Your app now supports branches → warehouses, so these work perfectly.)

401 — Transfer Out (MM–)
402 — Transfer In (MM+)
403 — Cross-Branch Transfer Request (no stock movement, workflow only)
404 — Cancelled / Rejected Transfer

🟪 5. INTERNAL BIN MOVEMENTS (intra-warehouse)

501 — Bin → Bin (Relocation)
502 — Bulk → Picking (Replenishment)
503 — Picking → Packing Station
504 — Packing → Shipping Staging
505 — Staging → Loading Bay
506 — Loading → Shipping

🟨 6. RETURNS (ZW / REWORK)

601 — Customer Return to Stock
602 — Customer Return to Scrap
603 — Return to Supplier (ZW)
604 — Return to Supplier – Awaiting Approval
605 — Return Reversal

🟫 7. ADJUSTMENTS & CORRECTIONS (INW / INK)

Required for legal compliance for Polish inventory adjustments.

701 — Inventory Gain (Overage) – INW
702 — Inventory Loss (Shortage) – INK
703 — Zero-Cost Correction
704 — Cost Revaluation / Reprice

🟩 8. RESERVATION SYSTEM (Logical Movements)

These work with your hybrid reservation model.

801 — Reservation Create (RES)
802 — Reservation Release (UNRES)
803 — Reservation Expired
804 — Reservation Converted to Issue (auto-close)

🟦 9. LOT / EXPIRY / QUALITY CONTROL MOVEMENTS

901 — Move to QA/Hold
902 — Release from QA to Stock
903 — Reject from QA to Scrap
904 — Repackaging / Relabeling
905 — Lot Merge / Split (for expiry/batch)

🟩 10. VMI (Vendor Managed Inventory) MOVEMENTS

These are optional, but your system supports VMI, so include them.

1001 — VMI Replenishment Receipt
1002 — VMI Adjustment by Supplier
1003 — VMI Stock Correction
1004 — VMI Return to Supplier

🟫 11. AUDITS (CYCLE COUNT & FULL STOCKTAKE)

1101 — Cycle Count Adjustment (positive)
1102 — Cycle Count Adjustment (negative)
1103 — Full Stocktake Adjustment (positive)
1104 — Full Stocktake Adjustment (negative)

🟨 12. PACKAGING, UNPACKING, KITTING, BOM BREAKDOWN

1201 — Kitting (components → kit)
1202 — Unkitting (kit → components)
1203 — Bundle Assembly
1204 — Bundle Disassembly

🟧 13. SCRAP, DAMAGE, WASTE MANAGEMENT

1301 — Scrap Write-Off (damage/expiry)
1302 — Waste Disposal Movement
1303 — Lost Inventory Declaration
1304 — Theft / Incident Adjustment

⭐ Summary Table
Code Movement Name Document Type
101–105 Purchase Receipts PZ
201–202 Sales Shipments WZ
301–305 Production RW / PW
401–404 Inter-Warehouse Transfers MM+ / MM–
501–506 Bin Movements –
601–605 Returns ZW
701–704 Adjustments INW / INK
801–804 Reservations Logical
901–905 Quality Control QA
1001–1004 VMI Movements VMI
1101–1104 Audit Corrections Inwentaryzacja
1201–1204 Kitting / Bundling –
1301–1304 Scrap / Waste –
🔥 Is this list final and correct for your app?

YES.
This list covers every real-world warehouse process, complies with Polish documentation standards, and is aligned with your movement-based inventory architecture.

If you want, I can generate:

✅ SQL migrations for all movement types
✅ Seed data
✅ Movement type categories
✅ Enums + TypeScript types
✅ API endpoints + validation
✅ UI for all document creation flows (PZ/WZ/MM/RW/PW)

Just tell me.

Powiedziałeś(-aś):
create specification and explanation for claude on implementing all movements within single warehouse between bins. explain all movements, codes and how they work but do not tell him on database structures or anything about code/ backend. i just want you to xplain him how those movements hould be implemented in order to be compliant with polish law and regulations
ChatGPT powiedział:

Below is a clean, clear, implementation-oriented specification for Claude Code.

It describes how each movement type inside a single warehouse (between bins/locations) should behave, what rules apply, and what is required for legal compliance in Poland, WITHOUT mentioning databases, backend, tables, SQL, schemas, or code.

It is purely functional + regulatory specification.

You can send this directly to Claude Code.

✅ SPECIFICATION: BIN-LEVEL MOVEMENTS INSIDE A SINGLE WAREHOUSE (POLAND-COMPLIANT)

This specification describes how warehouse movements must work inside one warehouse, when stock is moved between bins, shelves, racks, zones, picking areas, bulk storage, packing, staging, QA, etc.

It applies to all movement types that do NOT cross to another warehouse (branch).
These are internal movements, documented internally, compliant with Polish warehouse practice.

🧭 General Regulatory Rules (Poland)

Polish law does NOT require a formal document (like PZ/WZ/MM) for internal bin movements, but to remain compliant with:

Ustawa o rachunkowości (Accounting Act), art. 20–22

Ustawa o VAT (only applies to stock value changes, not pure movements)

Standard warehouse operating procedures (Instrukcja magazynowa)

You MUST:

1. Maintain traceability

Every movement must produce a clear audit trail:

What was moved

From where → to where

When

By whom

Why

How much (quantity, batch, expiry, serials if applicable)

2. Maintain real-time stock accuracy per bin

Stock on each bin must remain consistent with:

Physical reality

FIFO/FEFO/LIFO rules (if applicable)

Lot/batch/expiry tracking

Reservation and picking rules

Cycle counting

3. Support corrections and reversals

To legally comply with "rzetelność i bezbłędność zapisów", every movement must allow:

Reversal

Correction

Annotation of reason

4. Support inventory valuation (no need to calculate in bin movements)

Moving goods inside warehouse does not change valuation, only the physical location.
But the system must keep valuation associated with stock lots.

🟦 1. Movement Type: 501 — Bin to Bin (Relocation)
Purpose

Move goods from one bin/location to another without changing ownership, quantity, value, VAT status, or stock state.

Required behavior

Decrease stock in the source bin

Increase stock in the destination bin

Respect FEFO/FIFO/LIFO rules when selecting lots

Keep batch/lot/expiry unchanged

Must support moving:

A full pallet

A carton

Mixed quantities

Loose items

Serialised items

Legal compliance

Internal relocation does not require formal document (PZ/WZ/MM)

System must keep traceable movement record (art. 20 UoR)

🟦 2. Movement Type: 502 — Replenishment (Bulk → Picking)
Purpose

Move goods from bulk storage to picking shelves when picking location runs low.

Required behavior

Should be triggered manually or automatically (replenishment rules)

Must follow FEFO/FIFO/LIFO if product is date-sensitive

Quantities must match physical action (partial box, full box, etc.)

Affects only bin stock, not warehouse total

Legal compliance

Treat as internal movement (same as 501)

Must be traceable, especially if replenishment triggers are automated

🟦 3. Movement Type: 503 — Picking (Bin → Picking Tote/Cart)
Purpose

Move goods from picking/bin locations into a virtual picking container during order picking.

Required behavior

Temporary reservation + physical removal from bin

Must support:

Wave picking

Batch picking

Discrete picking

Single-order picking

Must track:

Picker user

Timestamp

Lot/expiry if product requires

Legal compliance

Still an internal movement

Must maintain full traceability (especially for expiry/lot-controlled goods)

🟦 4. Movement Type: 504 — Packing (Picking → Packing Station)
Purpose

Confirm that goods have arrived to packing table/station.

Required behavior

Move items from virtual picking container to packing station

Prepare consolidation (if multiple picks feed one shipment)

Must show shortages or discrepancies

Legal compliance

Internal, traceable movement

No formal WZ yet—WZ is only created at shipping/staging

🟦 5. Movement Type: 505 — Staging (Packing → Shipping Staging)
Purpose

Move packed goods to the shipping staging zone (ready for pickup).

Required behavior

Goods are now physically separated and labelled for shipment

Must lock stock from any other use (ATP = 0)

Prepare for WZ issue

Legal compliance

Still internal movement

Staging → loading will be part of the eventual WZ (201)

🟦 6. Movement Type: 506 — Loading (Staging → Loading Bay/Truck)
Purpose

Confirm that goods physically left the staging zone and were placed on the truck.

Required behavior

Last internal move before WZ confirmation

After this, WZ (201) must be issued

Legal compliance

Must be tightly tied to WZ

Movement must not modify quantities—only bin assignment, because WZ is the legal document of issuing stock

🟨 7. Movement Type: 901 — Move to QA/Hold
Purpose

Move product to quality control isolation area.

Required behavior\*\*

Must update product state to "blocked/QA"

Must track reason (damaged packaging, supplier QA, inspection required)

Lot/expiry MUST remain the same

Legal compliance\*\*

Required by:

HACCP

Automotive quality standards

Cosmetics/chemicals regulations

General Polish warehouse practice
(“Strefa KW – kontrola jakości”)

🟨 8. Movement Type: 902 — Release from QA to Stock
Purpose

Return approved items to active storage.

Required behavior

Move QA → normal stock

Set state to “available”

Legal compliance

Internal movement, but:

Must be traceable

Must indicate “approved by QA inspector”

🟨 9. Movement Type: 903 — Reject from QA to Scrap
Purpose

Move failed QA items to scrap zone.

Required behavior

Move to scrap bin

Mark stock as non-sellable

No value change (value change happens on formal write-off)

Legal compliance

Scrap must be documented later with INK — Inventory Loss Document

🟫 10. Movement Type: 1201 — Kitting (Components → Kit Bin)
Purpose

Combine multiple components into one kit.

Required behavior

Remove components from their bins

Add finished kit to kit bin

Handle lot tracking

Optionally generate internal kitting sheet

Legal compliance

Internal action, but:

If valuation changes (e.g., overhead), only allowed at MM-level, not bin-level

Kit BOM must be traceable

🟫 11. Movement Type: 1202 — Unkitting (Kit → Components)
Purpose

Break a kit back into component stock.

Required behavior

Remove kit stock

Add components back into bins

Legal compliance

Same rules as above.

🟫 12. Movement Type: 1301 — Scrap (Bin → Scrap Zone)
Purpose

Move physically damaged/expired items to scrap holding zone.

Required behavior

Does NOT adjust valuation yet

Only physical relocation

Later must trigger formal inventory write-off (INK)

Legal compliance

Must maintain full lot/expiry traceability

Must support “awaiting approval for INK”

🟫 13. Movement Type: 1302 — Waste Disposal (Scrap Zone → Disposal)
Purpose

Move scrap items to disposal area before removal from warehouse.

Required behavior

Purely internal

The final valuation change must happen only via INW/INK

🟫 14. Movement Type: 1101/1102 — Cycle Count Movements (Physical Count Adjustments)
Purpose

Adjust bin-level stock based on cycle count.

Required behavior

Physical count vs system stock

Differences captured per bin

Generate adjustment suggestion (positive or negative)

Polish compliance

Legal write-off must be recorded via INK/INW, NOT directly via bin movements.

Thus:

Bin movements record physical relocation

INW/INK records financial corrections
(art. 20 ust. 3 – ujawnione błędy i różnice)

⭐ Summary of How These Movements Must Behave
✓ Never modify valuation inside warehouse

Only inter-warehouse or formal documents do.

✓ Every movement must be traceable

“Who → What → When → Where → Why → How much”.

✓ Support batches, expiry, FEFO, serials

This is essential for food, pharma, cosmetics, automotive, electronics.

✓ All internal movements must support reversal

Required by Accounting Act.

✓ Internal movements do NOT generate formal PZ/WZ

They generate internal warehouse movement logs only.

✓ Movements must NOT change branch-level totals

Only reallocate quantities inside the warehouse.
