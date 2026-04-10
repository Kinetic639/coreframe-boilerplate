---
title: "Stock Movements Specification"
slug: "stock-movements"
lang: "en"
version: "2.0"
lastUpdated: "2025-11-26"
tags: ["stock-movements", "inventory", "specification"]
category: "specification"
difficulty: "advanced"
audience: ["developers", "warehouse-managers", "administrators"]
status: "published"
author: "Technical Team"
estimatedReadTime: 20
related: ["warehouse-basics"]
---

# Stock Movements Specification

Complete technical specification of the Stock Movements system in AmbraWMS.

## Overview

The Stock Movements system tracks all inventory changes using SAP-style movement types with numeric codes (101-613). The system supports Polish warehouse regulations and provides full audit trails.

## Movement Type Categories

### 1. Receipts (100-105)

#### 101 - Goods Receipt from Purchase Order

- **Direction**: Increase inventory
- **Polish Doc**: PZ (Przyjęcie Zewnętrzne)
- **Use Case**: Receiving goods from suppliers
- **Required Fields**:
  - Source: Supplier
  - Destination Location: Warehouse location
  - Purchase Order reference

#### 102 - Goods Receipt from Production

- **Direction**: Increase inventory
- **Polish Doc**: PW (Przyjęcie Wewnętrzne)
- **Use Case**: Finished goods from manufacturing
- **Required Fields**:
  - Source: Production order
  - Destination Location: Finished goods location

#### 103 - Goods Receipt (Return from Customer)

- **Direction**: Increase inventory
- **Polish Doc**: PZ (Przyjęcie Zewnętrzne)
- **Use Case**: Customer returns
- **Required Fields**:
  - Source: Sales Order reference
  - Destination Location: Returns location
  - Reason code

### 2. Issues (201-206)

#### 201 - Goods Issue for Sales Order

- **Direction**: Decrease inventory
- **Polish Doc**: WZ (Wydanie Zewnętrzne)
- **Use Case**: Fulfilling customer orders
- **Required Fields**:
  - Source Location: Pick location
  - Destination: Customer/Sales Order
  - Sales Order reference

#### 202 - Goods Issue (Return to Supplier)

- **Direction**: Decrease inventory
- **Polish Doc**: WZ (Wydanie Zewnętrzne)
- **Use Case**: Returning defective goods
- **Required Fields**:
  - Source Location: Warehouse location
  - Destination: Supplier
  - Reason code
  - Original PO reference

#### 261 - Goods Issue for Production

- **Direction**: Decrease inventory
- **Polish Doc**: RW (Rozchód Wewnętrzny)
- **Use Case**: Materials for production
- **Required Fields**:
  - Source Location: Raw materials location
  - Destination: Production order
  - Production order reference

### 3. Transfers (301-312)

#### 301 - Transfer Posting (Location to Location)

- **Direction**: Neutral (same branch)
- **Polish Doc**: MM (Przesunięcie Magazynowe)
- **Use Case**: Moving stock between locations
- **Required Fields**:
  - Source Location: From location
  - Destination Location: To location
  - Same branch required

#### 305 - Transfer Posting (Branch to Branch)

- **Direction**: Neutral (cross-branch)
- **Polish Doc**: MM (Przesunięcie Magazynowe)
- **Use Case**: Moving stock between warehouses
- **Required Fields**:
  - Source Location: From location in Branch A
  - Destination Location: To location in Branch B
  - Creates paired movements

### 4. Adjustments (401-411)

#### 401 - Inventory Increase (Count Correction)

- **Direction**: Increase inventory
- **Polish Doc**: PW (Przyjęcie Wewnętrzne)
- **Use Case**: Correcting undercounted stock
- **Required Fields**:
  - Location: Where stock was found
  - Reason code
  - Adjustment reason

#### 402 - Inventory Decrease (Count Correction)

- **Direction**: Decrease inventory
- **Polish Doc**: RW (Rozchód Wewnętrzny)
- **Use Case**: Correcting overcounted stock
- **Required Fields**:
  - Location: Where stock is missing
  - Reason code
  - Adjustment reason

#### 411 - Physical Inventory Adjustment

- **Direction**: Either
- **Polish Doc**: INW (Inwentaryzacja)
- **Use Case**: Annual inventory audit corrections
- **Required Fields**:
  - Location: Audited location
  - Audit reference
  - Counted quantity vs system quantity

### 5. Reservations (501-502)

#### 501 - Goods Receipt (Reservation)

- **Direction**: Reserve stock
- **Use Case**: Allocating stock to sales order
- **Effect**: Decreases Available stock, not On Hand

#### 502 - Goods Issue (Reservation Cancellation)

- **Direction**: Release reservation
- **Use Case**: Canceling order or releasing allocated stock
- **Effect**: Increases Available stock

### 6. E-commerce (601-613)

#### 601 - Shopify Order Fulfillment

- **Direction**: Decrease inventory
- **Integration**: Shopify
- **Auto-created**: Yes

#### 602 - WooCommerce Order Fulfillment

- **Direction**: Decrease inventory
- **Integration**: WooCommerce
- **Auto-created**: Yes

#### 603 - Allegro Order Fulfillment

- **Direction**: Decrease inventory
- **Integration**: Allegro (Polish marketplace)
- **Auto-created**: Yes

## Movement Statuses

### Status Flow

```
draft → pending → approved → completed
                     ↓
                 cancelled
                     ↓
                 reversed
```

### Status Definitions

#### Draft

- Created but not submitted
- Can be edited freely
- Does not affect stock

#### Pending

- Submitted for approval
- Awaiting warehouse manager approval
- Does not affect stock yet

#### Approved

- Approved by authorized user
- Ready for execution
- Still does not affect stock

#### Completed

- Executed and stock updated
- **This is when stock changes happen**
- Cannot be edited
- Can only be reversed

#### Cancelled

- Cancelled before completion
- Does not affect stock
- Includes cancellation reason

#### Reversed

- Reversal movement created
- Original movement marked as reversed
- Stock effect cancelled out

## Database Schema

### stock_movements Table

```sql
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid NOT NULL REFERENCES branches(id),

  -- Movement identification
  movement_number text GENERATED ALWAYS AS (
    'MOV-' || to_char(created_at, 'YYYYMMDD') || '-' ||
    lpad(movement_sequence::text, 5, '0')
  ) STORED,
  movement_type smallint NOT NULL,

  -- Product information
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),

  -- Quantity and units
  quantity numeric(10,3) NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id),

  -- Locations
  source_location_id uuid REFERENCES locations(id),
  destination_location_id uuid REFERENCES locations(id),

  -- Financial
  unit_cost numeric(10,2),
  total_cost numeric(12,2),
  currency text DEFAULT 'PLN',

  -- References
  reference_type text, -- 'purchase_order', 'sales_order', etc.
  reference_id uuid,
  reference_number text,

  -- Tracking
  batch_number text,
  serial_number text,
  lot_number text,
  expiry_date date,

  -- Status
  status text NOT NULL DEFAULT 'pending',
  notes text,

  -- Audit
  created_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  -- Constraints
  CHECK (quantity != 0),
  CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled', 'reversed'))
);
```

### Indexes

```sql
CREATE INDEX idx_movements_org_branch ON stock_movements(organization_id, branch_id);
CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_status ON stock_movements(status);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_movements_occurred ON stock_movements(occurred_at);
CREATE INDEX idx_movements_reference ON stock_movements(reference_type, reference_id);
```

## Stock Calculation Views

### current_stock_view

Real-time inventory levels:

```sql
CREATE VIEW current_stock_view AS
SELECT
  product_id,
  variant_id,
  branch_id,
  location_id,
  SUM(CASE
    WHEN movement_type BETWEEN 101 AND 199 THEN quantity
    WHEN movement_type BETWEEN 201 AND 299 THEN -quantity
    WHEN movement_type BETWEEN 401 AND 499 THEN quantity
    ELSE 0
  END) as on_hand_quantity
FROM stock_movements
WHERE status = 'completed'
  AND movement_type NOT IN (501, 502) -- Exclude reservations
GROUP BY product_id, variant_id, branch_id, location_id;
```

### available_stock_view

Available to promise:

```sql
CREATE VIEW available_stock_view AS
SELECT
  c.product_id,
  c.variant_id,
  c.branch_id,
  c.on_hand_quantity,
  COALESCE(r.reserved_quantity, 0) as reserved_quantity,
  (c.on_hand_quantity - COALESCE(r.reserved_quantity, 0)) as available_quantity
FROM current_stock_view c
LEFT JOIN (
  SELECT
    product_id,
    variant_id,
    branch_id,
    SUM(quantity) as reserved_quantity
  FROM stock_movements
  WHERE status = 'completed'
    AND movement_type = 501
  GROUP BY product_id, variant_id, branch_id
) r USING (product_id, variant_id, branch_id);
```

## Business Rules

### Validation Rules

1. **Quantity Validation**
   - Quantity must be non-zero
   - For issues, available stock must be sufficient
   - Unit must match product's base unit

2. **Location Validation**
   - Source/destination based on movement type
   - Locations must belong to correct branch
   - Cannot transfer to same location

3. **Permission Validation**
   - User must have appropriate permissions
   - Branch-level permissions enforced
   - Approval requires manager role

4. **Status Transitions**
   - Only valid status transitions allowed
   - Completed movements are immutable
   - Reversals require special permission

### Polish Compliance

1. **Document Numbers**
   - Sequential numbering per document type
   - Format: DOC-YYYYMMDD-NNNNN
   - No gaps allowed in sequence

2. **Audit Trail**
   - All changes logged
   - User identification required
   - Timestamps in local time (CET/CEST)

3. **Retention**
   - Minimum 5 years retention
   - Soft delete only (no hard deletes)
   - Archive after retention period

## API Reference

### Create Movement

```typescript
interface CreateMovementInput {
  movementType: number;
  productId: string;
  variantId?: string;
  quantity: number;
  unitId: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

async function createMovement(input: CreateMovementInput): Promise<Movement>;
```

### Approve Movement

```typescript
async function approveMovement(movementId: string): Promise<Movement>;
```

### Complete Movement

```typescript
async function completeMovement(movementId: string): Promise<Movement>;
```

### Reverse Movement

```typescript
interface ReverseMovementInput {
  originalMovementId: string;
  reason: string;
}

async function reverseMovement(input: ReverseMovementInput): Promise<Movement>;
```

## Testing Requirements

### Unit Tests

- Movement type validation
- Quantity calculations
- Status transitions

### Integration Tests

- End-to-end movement flow
- Stock calculation verification
- Multi-user scenarios

### Performance Tests

- 10,000+ movements per day
- Complex queries on large datasets
- Concurrent operations

## Implementation Status

✅ **Implemented (65% Complete)**

- Movement types 101-105 (Receipts)
- Movement types 201-206 (Issues)
- Movement types 401-411 (Adjustments)
- Movement types 501-502 (Reservations)
- Status workflow
- Stock views

🚧 **In Progress**

- Movement types 301-312 (Transfers)
- Movement types 601-613 (E-commerce)

❌ **Not Yet Implemented**

- PDF document generation
- Returns processing (203-206)
- Advanced audit trail UI

## See Also

- [Warehouse Basics](/docs/user/warehouse-basics)
- [System Architecture](/docs/dev/architecture)
- [API Reference](/docs/api)

---

_Version 2.0 | Last updated: November 26, 2025_
