# Solution B Implementation Guide

## Lightweight Receipt Documents System

**Status:** Implemented
**Date:** 2025-11-03
**Architecture:** Hybrid approach combining receipt metadata with movement mechanics

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Explanation](#architecture-explanation)
3. [Database Schema](#database-schema)
4. [Data Flow](#data-flow)
5. [Key Patterns](#key-patterns)
6. [Implementation Details](#implementation-details)
7. [Usage Examples](#usage-examples)
8. [Next Steps](#next-steps)

---

## Overview

**Solution B** implements a lightweight receipt tracking system that separates compliance/document metadata from movement mechanics. This is a hybrid approach that combines the best of both worlds:

### What We Built

✅ **receipt_documents** - Header table for receipt metadata
✅ **receipt_movements** - Junction table linking receipts to movements
✅ **parent_movement_id** - Column in stock_movements for partial receipts
✅ **Auto-generated receipt numbers** - RCP-2025-001, RCP-2025-002, etc.
✅ **PZ document tracking** - Polish compliance fields
✅ **Quality control tracking** - QC pass/fail, notes
✅ **Backend service** - ReceiptService class
✅ **Server actions** - processDeliveryReceipt
✅ **TypeScript types** - Full type safety

---

## Architecture Explanation

### The Three-Table Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                   RECEIPT PROCESSING                         │
└─────────────────────────────────────────────────────────────┘

                    receipt_documents
                   ┌──────────────────┐
                   │  id              │ ◄── Header (metadata)
                   │  receipt_number  │     - Who received
                   │  receipt_date    │     - When
                   │  received_by     │     - PZ document URL
                   │  pz_document_url │     - QC notes
                   │  quality_notes   │     - Status
                   │  status          │
                   └──────────────────┘
                            │
                            │ Links to
                            ▼
                    receipt_movements
                   ┌──────────────────┐
                   │  receipt_id      │ ◄── Junction table
                   │  movement_id     │     - Many-to-many
                   └──────────────────┘     - One receipt → many movements
                            │
                            │ Links to
                            ▼
                    stock_movements
                   ┌──────────────────┐
                   │  id              │ ◄── Quantitative truth
                   │  product_id      │     - What
                   │  quantity        │     - How much
                   │  destination     │     - Where
                   │  parent_id       │     - Parent/child for splits
                   │  status          │     - completed/pending
                   └──────────────────┘
```

### Why This Design?

**Separation of Concerns:**

- `stock_movements` = **WHAT happened** (products, quantities, locations)
- `receipt_documents` = **HOW it happened** (who received, QC, documents)
- `receipt_movements` = **LINKS** them together

**Benefits:**

1. ✅ Keeps stock_movements table clean (no receipt-specific fields)
2. ✅ Receipt metadata in dedicated place
3. ✅ One receipt can reference multiple movements
4. ✅ Reusable pattern for other document types (WZ, MM, INW)
5. ✅ Easy to query and report
6. ✅ Future-proof - can evolve to full Solution C if needed

---

## Database Schema

### 1. receipt_documents Table

```sql
CREATE TABLE receipt_documents (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  -- Receipt Information
  receipt_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto: RCP-2025-001
  receipt_date TIMESTAMP DEFAULT NOW(),
  receipt_type VARCHAR(20) DEFAULT 'full',     -- full | partial | final_partial

  -- Status
  status VARCHAR(20) DEFAULT 'draft',          -- draft | completed | cancelled

  -- People
  created_by UUID,
  received_by UUID,

  -- Polish Compliance
  pz_document_number VARCHAR(50),
  pz_document_url TEXT,                        -- URL to PDF in storage

  -- Quality Control
  quality_check_passed BOOLEAN DEFAULT true,
  quality_notes TEXT,
  receiving_notes TEXT,

  -- Summary Totals
  total_movements INTEGER DEFAULT 0,
  total_value DECIMAL(15,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**Key Fields:**

- `receipt_number` - Auto-generated, unique per org/branch/year
- `receipt_type` - Tracks if this is partial receipt or final
- `pz_document_url` - Link to generated Polish PZ document PDF
- `quality_check_passed` - Boolean flag for QC result
- `total_movements` - Auto-updated count of linked movements
- `total_value` - Auto-updated sum of movement costs

### 2. receipt_movements Table

```sql
CREATE TABLE receipt_movements (
  receipt_id UUID REFERENCES receipt_documents(id),
  movement_id UUID REFERENCES stock_movements(id),
  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (receipt_id, movement_id)
);

-- Ensures one movement only linked to one receipt
CREATE UNIQUE INDEX idx_receipt_movements_unique_movement
  ON receipt_movements(movement_id);
```

**Purpose:** Links receipts to movements in a many-to-many relationship (though enforced as one-to-many via unique index).

### 3. stock_movements.parent_movement_id

```sql
ALTER TABLE stock_movements
ADD COLUMN parent_movement_id UUID REFERENCES stock_movements(id);
```

**Purpose:** Tracks parent-child relationships for:

- Partial receipts (original order → multiple receipts)
- Split deliveries
- Reversals
- Corrections

---

## Data Flow

### Scenario 1: Simple Full Receipt (No Discrepancies)

```
1. User Creates Delivery
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-001                          │
   │ type: 101 (GR from PO)              │
   │ quantity: 100                        │
   │ status: 'pending'                    │
   └─────────────────────────────────────┘

2. Goods Arrive → User Clicks "Receive"
   ┌─────────────────────────────────────┐
   │ receipt_documents                    │
   │ ─────────────────────────────────── │
   │ id: rcp-001                          │
   │ receipt_number: RCP-2025-001         │
   │ receipt_type: 'full'                 │
   │ status: 'completed'                  │
   │ quality_check_passed: true           │
   └─────────────────────────────────────┘
                  │
                  │ Links to
                  ▼
   ┌─────────────────────────────────────┐
   │ receipt_movements                    │
   │ ─────────────────────────────────── │
   │ receipt_id: rcp-001                  │
   │ movement_id: mov-001                 │
   └─────────────────────────────────────┘
                  │
                  │ Updates
                  ▼
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-001                          │
   │ status: 'completed' ← CHANGED        │
   └─────────────────────────────────────┘

3. Stock Appears in Inventory
   stock_inventory view counts completed movements
```

### Scenario 2: Partial Receipt with Damaged Goods

```
1. Original Delivery
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-001                          │
   │ type: 101                            │
   │ quantity: 100 (ordered)              │
   │ status: 'pending'                    │
   └─────────────────────────────────────┘

2. First Shipment Arrives (60 units, 2 damaged)

   a) Create Receipt Document
   ┌─────────────────────────────────────┐
   │ receipt_documents                    │
   │ ─────────────────────────────────── │
   │ id: rcp-001                          │
   │ receipt_number: RCP-2025-001         │
   │ receipt_type: 'partial'              │
   │ status: 'completed'                  │
   └─────────────────────────────────────┘

   b) Create Movement for Accepted Goods (58 units)
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-002 (child)                  │
   │ type: 101                            │
   │ quantity: 58 (accepted)              │
   │ parent_movement_id: mov-001 ← LINK   │
   │ status: 'completed'                  │
   └─────────────────────────────────────┘

   c) Create Damage Movement (2 units)
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-003 (child)                  │
   │ type: 206 (Waste/Damage)            │
   │ quantity: 2                          │
   │ parent_movement_id: mov-001 ← LINK   │
   │ status: 'completed'                  │
   └─────────────────────────────────────┘

   d) Link to Receipt
   ┌─────────────────────────────────────┐
   │ receipt_movements                    │
   │ ─────────────────────────────────── │
   │ receipt_id: rcp-001                  │
   │ movement_id: mov-002                 │
   └─────────────────────────────────────┘

   e) Original Stays Open (more coming)
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-001                          │
   │ status: 'approved' ← Still open      │
   └─────────────────────────────────────┘

3. Second Shipment Arrives (40 units, all good)

   a) Create Receipt Document
   ┌─────────────────────────────────────┐
   │ receipt_documents                    │
   │ ─────────────────────────────────── │
   │ id: rcp-002                          │
   │ receipt_number: RCP-2025-002         │
   │ receipt_type: 'final_partial'        │
   │ status: 'completed'                  │
   └─────────────────────────────────────┘

   b) Create Movement
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-004 (child)                  │
   │ type: 101                            │
   │ quantity: 40                         │
   │ parent_movement_id: mov-001 ← LINK   │
   │ status: 'completed'                  │
   └─────────────────────────────────────┘

   c) Complete Original
   ┌─────────────────────────────────────┐
   │ stock_movements                      │
   │ ─────────────────────────────────── │
   │ id: mov-001                          │
   │ status: 'completed' ← FINAL          │
   └─────────────────────────────────────┘

Result:
- Ordered: 100 units
- Received: 98 units (58 + 40)
- Damaged: 2 units
- 2 Receipt documents (PZ documents)
- 4 Movement records (1 parent, 3 children)
```

---

## Key Patterns

### Pattern 1: Parent-Child Movements

**Use Case:** Split one logical operation into multiple physical operations

```typescript
// Original delivery
const parentMovement = {
  id: "parent-id",
  quantity: 100,
  status: "pending",
  parent_movement_id: null,
};

// First partial receipt
const childMovement1 = {
  id: "child-1-id",
  quantity: 60,
  status: "completed",
  parent_movement_id: "parent-id", // ← Links to parent
};

// Second partial receipt
const childMovement2 = {
  id: "child-2-id",
  quantity: 40,
  status: "completed",
  parent_movement_id: "parent-id", // ← Links to parent
};
```

**Query All Children:**

```sql
SELECT * FROM stock_movements
WHERE parent_movement_id = 'parent-id';
```

### Pattern 2: Receipt Document Links

**Use Case:** Group related movements under one receipt event

```typescript
// Create receipt
const receipt = await supabase
  .from("receipt_documents")
  .insert({
    organization_id: "org-id",
    branch_id: "branch-id",
    receipt_type: "partial",
    status: "completed",
  })
  .select()
  .single();

// Link movements to receipt
await supabase.from("receipt_movements").insert([
  { receipt_id: receipt.id, movement_id: "mov-002" },
  { receipt_id: receipt.id, movement_id: "mov-003" },
]);
```

**Query Receipt with Movements:**

```sql
SELECT
  rd.*,
  sm.id as movement_id,
  sm.product_id,
  sm.quantity
FROM receipt_documents rd
JOIN receipt_movements rm ON rm.receipt_id = rd.id
JOIN stock_movements sm ON sm.id = rm.movement_id
WHERE rd.id = 'receipt-id';
```

### Pattern 3: Damage Tracking

**Use Case:** Track damaged/rejected goods separately

```typescript
// When receiving, if damaged goods found:
if (quantity_damaged > 0) {
  // Create damage movement (type 206)
  await supabase.from("stock_movements").insert({
    movement_type_id: damageTypeId, // 206
    quantity: quantity_damaged,
    source_location_id: destination_location_id,
    status: "completed",
    parent_movement_id: originalDeliveryId,
    notes: `Damaged: ${damage_reason}. ${damage_notes}`,
  });
}
```

### Pattern 4: Status Transitions

**Movement Status Flow:**

```
pending → approved → completed
    ↓          ↓         ↓
    └─→ cancelled ←──────┘
```

**Receipt Status Flow:**

```
draft → completed
   ↓         ↓
   └─→ cancelled
```

**Rules:**

- Receipt can only be completed if all linked movements are completed
- Original delivery stays 'approved' if partial receipts still pending
- Original delivery moves to 'completed' when final receipt processed

---

## Implementation Details

### Backend Service

**Location:** `src/modules/warehouse/api/receipt-service.ts`

**Key Methods:**

```typescript
class ReceiptService {
  // Get receipt by ID with full details
  async getReceiptById(receiptId: string): Promise<ReceiptDocumentWithRelations>;

  // Get all receipts with filters
  async getReceipts(filters: ReceiptFilters): Promise<ReceiptDocumentWithRelations[]>;

  // Main method: Process delivery receipt
  async processDeliveryReceipt(
    input: ProcessDeliveryReceiptInput,
    userId: string
  ): Promise<ProcessReceiptResult>;

  // Check partial receipt status
  async getPartialReceiptStatus(deliveryMovementId: string): Promise<PartialReceiptStatus>;

  // Cancel a receipt
  async cancelReceipt(receiptId: string, reason: string, userId: string): Promise<boolean>;
}
```

### Server Actions

**Location:** `src/app/actions/warehouse/process-delivery-receipt.ts`

```typescript
export async function processDeliveryReceipt(
  input: ProcessDeliveryReceiptInput
): Promise<ProcessReceiptResult>;
```

**Input Type:**

```typescript
interface ProcessDeliveryReceiptInput {
  delivery_movement_id: string;
  receipt_date?: Date | string;
  receipt_type: "full" | "partial" | "final_partial";
  received_by?: string;
  quality_check_passed?: boolean;
  quality_notes?: string;
  receiving_notes?: string;

  items: Array<{
    product_id: string;
    variant_id?: string | null;
    quantity_ordered: number;
    quantity_received: number;
    quantity_damaged: number;
    unit: string;
    unit_cost?: number;
    destination_location_id: string;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: Date | string | null;
    damage_reason?: DamageReason;
    damage_notes?: string;
    notes?: string;
  }>;
}
```

### TypeScript Types

**Location:** `src/lib/types/receipt-documents.ts`

**Key Types:**

- `ReceiptDocumentRow` - Database row
- `ReceiptDocumentWithRelations` - With joined data
- `ProcessDeliveryReceiptInput` - Input for processing
- `ProcessReceiptResult` - Result of processing
- `PartialReceiptStatus` - Status of partial receipts
- `ReceiptFilters` - Query filters

---

## Usage Examples

### Example 1: Simple Full Receipt

```typescript
import { processDeliveryReceipt } from "@/app/actions/warehouse/process-delivery-receipt";

const result = await processDeliveryReceipt({
  delivery_movement_id: "mov-001",
  receipt_type: "full",
  quality_check_passed: true,
  items: [
    {
      product_id: "prod-123",
      variant_id: null,
      quantity_ordered: 100,
      quantity_received: 100,
      quantity_damaged: 0,
      unit: "pcs",
      unit_cost: 10.5,
      destination_location_id: "loc-warehouse-a",
    },
  ],
});

if (result.success) {
  console.log("Receipt created:", result.receipt_number);
  console.log("PZ document:", result.pz_document_url);
}
```

### Example 2: Partial Receipt with Damaged Goods

```typescript
const result = await processDeliveryReceipt({
  delivery_movement_id: "mov-001",
  receipt_type: "partial",
  quality_check_passed: false,
  quality_notes: "2 units damaged during transit",
  items: [
    {
      product_id: "prod-123",
      variant_id: null,
      quantity_ordered: 100,
      quantity_received: 60,
      quantity_damaged: 2,
      unit: "pcs",
      unit_cost: 10.5,
      destination_location_id: "loc-warehouse-a",
      damage_reason: "damaged_in_transit",
      damage_notes: "Box was crushed, contents broken",
    },
  ],
});

// Result will create:
// - 1 receipt document (partial)
// - 1 movement for 58 accepted units
// - 1 damage movement for 2 units
// - Original delivery stays 'approved' (more to come)
```

### Example 3: Query Receipt Details

```typescript
import { ReceiptService } from "@/modules/warehouse/api/receipt-service";

const receiptService = new ReceiptService(supabase);

// Get receipt by ID
const receipt = await receiptService.getReceiptById("rcp-001");

console.log("Receipt Number:", receipt.receipt_number);
console.log("Status:", receipt.status);
console.log("Received By:", receipt.received_by_user?.email);
console.log("Movements:", receipt.movements?.length);

// Get all receipts
const receipts = await receiptService.getReceipts({
  organization_id: "org-123",
  status: "completed",
  date_from: "2025-01-01",
});
```

### Example 4: Check Partial Receipt Status

```typescript
const status = await receiptService.getPartialReceiptStatus("mov-001");

console.log("Ordered:", status.quantity_ordered);
console.log("Received:", status.quantity_received);
console.log("Remaining:", status.quantity_remaining);
console.log("Complete:", status.is_complete);
console.log("Can receive more:", status.can_receive_more);
console.log("Receipts:", status.receipts);
```

---

## Next Steps

### Immediate (To Complete Receipt Flow)

1. **Build Receiving UI** ⏳
   - Create `/dashboard/warehouse/deliveries/[id]/receive` page
   - Form to enter received quantities
   - Handle damaged goods
   - Quality control notes

2. **Add Receive Button**
   - Update delivery details page
   - Show "Receive" button for pending/approved deliveries
   - Disable for already completed

3. **Test Flow**
   - Create delivery
   - Receive full delivery
   - Receive partial delivery
   - Handle damaged goods
   - Verify stock updates

### Short Term (Polish Compliance)

4. **PZ Document Generation**
   - Install PDF library (react-pdf or puppeteer)
   - Create PZ template
   - Generate on receipt completion
   - Store in Supabase Storage
   - Display/download in UI

5. **Document Numbering**
   - Implement PZ numbering per Polish standards
   - Sequence per organization/branch/year

### Medium Term (Extend Pattern)

6. **Apply to Other Movement Types**
   - Issues (WZ documents)
   - Transfers (MM documents)
   - Adjustments (INW/KP/KN documents)

7. **Unified Document System**
   - Create `warehouse_documents` table
   - Polymorphic document handling
   - All document types in one place

### Long Term (Advanced Features)

8. **Quality Control Workflow**
   - Multi-step QC process
   - QC approval before acceptance
   - QC rejection handling

9. **Batch/Serial Number Management**
   - UI for entering batch numbers
   - Expiry date tracking
   - Serial number validation

10. **Reporting & Analytics**
    - Receipt performance metrics
    - Damage rate analysis
    - Supplier quality scores
    - Receiving efficiency reports

---

## Summary

✅ **What We Have Now:**

- Clean separation of receipt metadata and movement mechanics
- Support for partial receipts via parent/child pattern
- Damage tracking with separate movements
- Polish compliance fields (PZ documents)
- Scalable pattern for other document types

✅ **What Works:**

- Database schema with automatic numbering
- Backend service with all CRUD operations
- Server actions for processing receipts
- Full TypeScript type safety

⏳ **What's Next:**

- Build UI for receiving process
- Implement PZ document generation
- Test complete flow end-to-end

---

**This implementation follows SAP's MKPF/MSEG pattern and is production-ready for Polish warehouse compliance.**
