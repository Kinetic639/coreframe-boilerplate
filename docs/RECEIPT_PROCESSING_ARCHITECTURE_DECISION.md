# Receipt Processing Architecture Decision

**Date:** 2025-11-03
**Status:** Seeking Expert Opinion
**Context:** Stock movements system implementation - delivery receipt processing

## Executive Summary

We have a functional stock movements system with 31 movement types configured. Deliveries (Type 101 - GR from Purchase Order) are working, but we need to implement the "receipt processing" workflow - what happens when goods physically arrive.

**Core Question:** How should we architect the receipt processing system? Do we need separate database tables for receipt tracking, or can we use the existing `stock_movements` table?

## Current System Architecture

### Database Schema (Working)

#### `stock_movements` Table

Single table handling ALL 31 movement types (SAP-style):

```sql
stock_movements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  movement_type_id UUID NOT NULL REFERENCES movement_types(id),

  -- Product & Location
  product_id UUID NOT NULL,
  variant_id UUID,
  source_location_id UUID,
  destination_location_id UUID,

  -- Quantities & Costs
  quantity DECIMAL(15,3) NOT NULL,
  unit VARCHAR(20) DEFAULT 'pcs',
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),

  -- Status & Workflow
  status VARCHAR(20) DEFAULT 'pending', -- pending | approved | completed | cancelled | reversed
  requires_approval BOOLEAN DEFAULT false,

  -- Approval Tracking
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP,
  cancelled_by UUID,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  -- Document Numbers
  movement_number VARCHAR(50) UNIQUE, -- Auto-generated: MOV-2025-001
  document_number VARCHAR(50), -- Polish document: PZ-2025-001
  reference_number VARCHAR(100), -- External reference (PO number, invoice, etc.)

  -- Polish Compliance
  document_type VARCHAR(10), -- PZ, WZ, MM, RW, INW, KP, KN

  -- Batch/Serial Tracking
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiry_date DATE,

  -- Metadata
  notes TEXT,
  metadata JSONB,

  -- Timestamps
  movement_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);
```

#### `movement_types` Table

31 pre-configured movement types:

- **Receipts (101-105):** GR from PO, GR Reversal, Customer Return, Production Output, Initial Stock
- **Issues (201-206):** GI for Sale, GI Reversal, Return to Supplier, Production Consumption, Cost Center Issue, Waste/Damage
- **Transfers (301-312):** Various location and branch transfers
- **Adjustments (401-411):** Stock corrections, audit adjustments
- **Reservations (501-502):** Stock reservation management
- **E-commerce (601-613):** Shopify, WooCommerce, Allegro integration

#### `stock_inventory` View

Real-time inventory calculation:

```sql
CREATE VIEW stock_inventory AS
SELECT
  product_id,
  variant_id,
  location_id,
  organization_id,
  branch_id,
  SUM(CASE
    WHEN destination_location_id IS NOT NULL THEN quantity
    WHEN source_location_id IS NOT NULL THEN -quantity
    ELSE 0
  END) as available_quantity,
  -- ... other aggregations
FROM stock_movements
WHERE status IN ('approved', 'completed')
  AND deleted_at IS NULL
GROUP BY product_id, variant_id, location_id, organization_id, branch_id;
```

### Current Working Flow

1. **User creates delivery** via UI (`/dashboard/warehouse/deliveries/new`)
   - Select products, quantities, costs, destination location, supplier
   - Creates `stock_movements` record with:
     - `movement_type_id` = 101 (GR from PO)
     - `status` = 'pending'
     - `quantity` = ordered quantity

2. **Movement is approved** (manually or auto)
   - `status` changes to 'approved'
   - Stock appears in `stock_inventory` view

3. **Current gap:** What happens when goods physically arrive?
   - No formal "receiving" process
   - No quality inspection step
   - No way to handle partial receipts
   - No way to track damaged goods separately
   - No PZ document generation

## Business Requirements

Based on Polish warehouse regulations and standard warehouse practices:

### Must Have:

1. **PZ Document Generation** - Legal requirement in Poland for goods received
2. **Discrepancy Tracking** - Record when received quantity ≠ ordered quantity
3. **Damaged Goods Handling** - Track and document damaged/rejected items
4. **Receiving Metadata** - Who received, when, quality notes

### Nice to Have:

1. **Partial Receipts** - Receive in multiple shipments (common with large orders)
2. **Quality Inspection** - Formal QC step before acceptance
3. **Batch/Serial Entry** - Enter batch numbers, expiry dates during receipt
4. **Receipt History** - Audit trail of all receiving events for an order

### Unknown:

- How frequently do discrepancies occur? (Often = need detailed tracking)
- Are partial receipts common? (Yes = need multiple receipt tracking)
- Is quality control formal or informal? (Formal = need QC workflow)
- How important is receipt audit trail? (Critical = need separate records)

## Proposed Solutions

### Solution A: No Additional Tables (Simplest)

**Approach:** Use existing `stock_movements` table with status workflow.

**Flow:**

```
1. Create delivery → movement with status='pending', quantity=100
2. Approve delivery → status='approved' (stock shows as "on order")
3. Goods arrive → User clicks "Complete Delivery" button
4. UI allows editing quantity if needed → Update quantity=98 (short delivery)
5. Optional: Create damage movement (type 206) for 2 damaged units
6. Status → 'completed', generate PZ document
7. Stock appears in inventory
```

**Implementation:**

- Add "Complete Delivery" UI with:
  - Option to edit quantities
  - Button to create damage movement
  - PZ document generation
  - Status update to 'completed'

**Handling Partial Receipts:**

- **Option A1:** Split the original movement into multiple child movements using `parent_movement_id`

  ```sql
  -- Original order
  movement_1: type=101, quantity=100, status='pending'

  -- First receipt
  movement_2: type=101, quantity=60, status='completed', parent_movement_id=movement_1

  -- Second receipt
  movement_3: type=101, quantity=40, status='completed', parent_movement_id=movement_1

  -- Mark original as fulfilled
  movement_1: status='completed'
  ```

- **Option A2:** Add receipt tracking fields to `stock_movements`:
  ```sql
  ALTER TABLE stock_movements ADD COLUMN quantity_ordered DECIMAL(15,3);
  ALTER TABLE stock_movements ADD COLUMN quantity_received DECIMAL(15,3);
  ALTER TABLE stock_movements ADD COLUMN received_at TIMESTAMP;
  ALTER TABLE stock_movements ADD COLUMN received_by UUID;
  ```

**Pros:**

- ✅ Zero new tables
- ✅ Uses existing proven schema
- ✅ Simple to implement
- ✅ All movements in one place
- ✅ Easy to query and report
- ✅ Parent/child relationships track splits naturally

**Cons:**

- ❌ Can't track multiple receipt events with full detail (unless using child movements)
- ❌ Adding receipt-specific fields clutters the movements table (applies to all types)
- ❌ Ordered vs received tracked only if we add new columns
- ❌ Limited receipt history/audit trail

**Best For:**

- Simple operations where discrepancies are rare
- Trusted suppliers
- Infrequent partial receipts
- Informal quality control

---

### Solution B: Lightweight Receipt Documents Table

**Approach:** Keep movements table clean, add minimal metadata table for receipt documents.

**Schema:**

```sql
CREATE TABLE receipt_documents (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  -- Links to one or more movements
  primary_movement_id UUID NOT NULL REFERENCES stock_movements(id),

  -- Receipt Metadata
  receipt_number VARCHAR(50) UNIQUE, -- RCP-2025-001
  receipt_date TIMESTAMP DEFAULT NOW(),
  received_by UUID REFERENCES users(id),

  -- Document Generation
  pz_document_number VARCHAR(50),
  pz_document_url TEXT, -- PDF in Supabase Storage

  -- Quality Control
  quality_check_passed BOOLEAN DEFAULT true,
  quality_notes TEXT,
  receiving_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Link table if one receipt covers multiple movements
CREATE TABLE receipt_movements (
  receipt_id UUID REFERENCES receipt_documents(id),
  movement_id UUID REFERENCES stock_movements(id),
  PRIMARY KEY (receipt_id, movement_id)
);
```

**Flow:**

```
1. Create delivery → stock_movements record (status='pending')
2. Goods arrive → User clicks "Receive"
3. System creates receipt_document record
4. User enters actual quantities:
   - If short: Creates child movement with actual quantity
   - If damaged: Creates damage movement (type 206)
5. Generate PZ document, link to receipt_document
6. Complete all movements
```

**Pros:**

- ✅ Keeps stock_movements clean (no receipt-specific fields)
- ✅ Receipt metadata in dedicated place
- ✅ One receipt can reference multiple movements
- ✅ Good separation of concerns
- ✅ Reusable for other movement types that need documents

**Cons:**

- ❌ One additional table (though very simple)
- ❌ Still needs child movements for partial receipts
- ❌ Another join when querying receipts

**Best For:**

- Need receipt metadata (documents, QC notes)
- Want clean movements table
- Multiple movements per receipt
- Document-centric workflow

---

### Solution C: Full Receipt Tracking Tables

**Approach:** Separate receipt process from ordering process with dedicated tables.

**Schema:**

```sql
CREATE TABLE delivery_receipts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  delivery_id UUID NOT NULL REFERENCES stock_movements(id), -- Original delivery/order

  -- Receipt Information
  receipt_number VARCHAR(50) UNIQUE,
  receipt_date TIMESTAMP DEFAULT NOW(),
  receipt_type VARCHAR(20) DEFAULT 'full', -- 'full' | 'partial' | 'final_partial'
  received_by UUID REFERENCES users(id),

  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'completed' | 'cancelled'

  -- Document
  pz_document_number VARCHAR(50),
  pz_document_url TEXT,

  -- Quality
  quality_check_passed BOOLEAN DEFAULT true,
  quality_notes TEXT,
  receiving_notes TEXT,

  -- Totals (denormalized)
  total_items_ordered INTEGER,
  total_items_received INTEGER,
  total_items_damaged INTEGER,
  total_value DECIMAL(15,2),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  CONSTRAINT delivery_receipts_org_fkey FOREIGN KEY (organization_id)
    REFERENCES organizations(organization_id) ON DELETE CASCADE
);

CREATE TABLE delivery_receipt_items (
  id UUID PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES delivery_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),

  -- Quantities
  quantity_ordered DECIMAL(15,3) NOT NULL,
  quantity_received DECIMAL(15,3) NOT NULL DEFAULT 0,
  quantity_damaged DECIMAL(15,3) DEFAULT 0,
  quantity_accepted DECIMAL(15,3) GENERATED ALWAYS AS
    (quantity_received - quantity_damaged) STORED,

  -- Unit & Pricing
  unit VARCHAR(20) DEFAULT 'pcs',
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS
    (quantity_accepted * unit_cost) STORED,

  -- Location
  destination_location_id UUID NOT NULL REFERENCES locations(id),

  -- Batch/Serial
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiry_date DATE,
  manufacturing_date DATE,

  -- Damage Tracking
  damage_reason VARCHAR(50), -- 'damaged_in_transit' | 'wrong_product' | 'expired' | 'quality_issue'
  damage_notes TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_quantities CHECK (
    quantity_received >= 0 AND
    quantity_damaged >= 0 AND
    quantity_damaged <= quantity_received AND
    quantity_ordered > 0
  )
);
```

**Flow:**

```
1. Create delivery → stock_movements (status='pending', quantity=100)
2. Goods arrive → Create delivery_receipts record (status='draft')
3. For each product → Create delivery_receipt_items
   - quantity_ordered = 100
   - quantity_received = 98
   - quantity_damaged = 2
4. Complete receipt →
   - delivery_receipts.status = 'completed'
   - Generate PZ document
   - Create stock_movements for accepted quantities (96 units)
   - Create damage movement (type 206) for 2 units
   - Update original delivery status
```

**Pros:**

- ✅ Complete separation of order vs receipt
- ✅ Full history of all receipt events
- ✅ Detailed line-item tracking (ordered vs received per product)
- ✅ Easy to query discrepancies
- ✅ Supports complex workflows (multi-step QC)
- ✅ Perfect audit trail
- ✅ Handles partial receipts naturally

**Cons:**

- ❌ Two additional tables
- ❌ More complex to implement
- ❌ Data duplication (receipt items mirror movement data)
- ❌ More joins when querying
- ❌ Might be overkill for simple operations

**Best For:**

- Frequent discrepancies
- Strict quality control requirements
- Regulatory compliance needs
- Complex receiving workflows
- Multiple partial receipts per order
- Need detailed audit trails

---

## Comparison Matrix

| Aspect                      | Solution A (No Tables) | Solution B (Receipt Docs) | Solution C (Full Tracking) |
| --------------------------- | ---------------------- | ------------------------- | -------------------------- |
| **Complexity**              | Low                    | Medium                    | High                       |
| **Tables Added**            | 0                      | 1-2                       | 2                          |
| **Implementation Time**     | 1 week                 | 1-2 weeks                 | 2-3 weeks                  |
| **Partial Receipt Support** | Via child movements    | Via child movements       | Native                     |
| **Ordered vs Received**     | Manual or new fields   | Via movements             | Native per item            |
| **Receipt History**         | Limited                | Good                      | Excellent                  |
| **Audit Trail**             | Basic                  | Good                      | Comprehensive              |
| **Discrepancy Tracking**    | Manual                 | Manual                    | Automatic                  |
| **Query Complexity**        | Low                    | Medium                    | High                       |
| **Data Duplication**        | None                   | Minimal                   | Moderate                   |
| **Scalability**             | Good                   | Good                      | Excellent                  |
| **Maintenance**             | Easy                   | Medium                    | Complex                    |

## Questions for Expert Review

1. **Architecture Decision:**
   - Is it better to keep everything in `stock_movements` or separate receipt concerns?
   - What are the long-term maintenance implications of each approach?
   - Which approach scales better for 100k+ movements/year?

2. **Data Modeling:**
   - Should receipt data live in the movements table or separate tables?
   - Is it acceptable to have movement-type-specific fields in a generic movements table?
   - How to avoid data duplication while maintaining clear relationships?

3. **Workflow Design:**
   - Should approval and receipt be separate steps or combined?
   - How to handle the status transitions cleanly?
   - Where should document generation happen?

4. **Partial Receipts:**
   - Is using child movements (parent_movement_id) a good pattern for splits?
   - Or is it better to have explicit receipt line items?
   - How to maintain referential integrity?

5. **Polish Compliance:**
   - Do PZ documents need to be generated per receipt or per movement?
   - Should document metadata live in movements table or separate?
   - How to handle document corrections/cancellations?

6. **Future Considerations:**
   - Same pattern will apply to Issues (201), Transfers (301), Adjustments (401)
   - Will this architecture work for all movement types?
   - How to avoid code/schema duplication across movement types?

7. **Performance:**
   - Impact on query performance with different approaches?
   - Indexing strategies for each solution?
   - View calculation performance with additional tables?

## Additional Context

### Similar Movement Types Planned

This receipt processing pattern may need to be replicated for:

- **Transfers (301-312):** Transfer request → approval → ship → receive
- **Returns (203):** Return request → ship back → supplier receives
- **Production (104/204):** Production order → manufacturing → output/consumption
- **E-commerce (601-613):** Order received → pick → pack → ship

**Question:** Should we design a generic "two-step process" pattern that works for all, or handle each differently?

### Technology Stack

- PostgreSQL 15
- Supabase (PostgREST API)
- Next.js 15 (React Server Components)
- TypeScript (strict mode)

### Scale Expectations

- ~10-50 deliveries/day
- ~100-500 total movements/day (all types)
- 5-10 concurrent users
- 2-3 branches per organization
- 10-20 locations per branch

## Recommendation Requested

We need expert guidance on:

1. **Which solution (A, B, or C) is most appropriate** for our scale and requirements?
2. **Whether to optimize for simplicity now or flexibility later?**
3. **Best practices for handling multi-step workflows in inventory systems?**
4. **How to avoid painting ourselves into a corner** as we add more movement types?
5. **Any alternative approaches** we haven't considered?

## References

- [Stock Movements Specification](./STOCK_MOVEMENTS_SPECIFICATION.md)
- [Stock Movements Implementation Plan](./STOCK_MOVEMENTS_IMPLEMENTATION_PLAN.md)
- [SAP Movement Types Reference](https://help.sap.com/docs/SAP_ERP/eb3fe3e67e314e2e96e7a0f0a01c5e1f/4a8ce41e8bd34c6be10000000a42189b.html)
- [Polish JPK_MAG Regulations](https://www.gov.pl/web/kas/jpk-mag)

---

**Status:** Awaiting expert feedback to make final architecture decision before implementation.
