# Stock Movements & Transfers - Technical Specification

**Version:** 1.0
**Last Updated:** 2025-10-24 | **Status Updated:** 2025-11-12
**Implementation Status:** 40% Complete (Phase 1 & 2 Done)

---

## 🎯 Implementation Status Overview

**Current State:** The stock movements system is partially implemented with a solid foundation.

### ✅ Completed Features (40%)

- **Movement Types System** (Phase 1 - Oct 24, 2024)
  - 31 SAP-style movement types (codes 101-613)
  - Movement categories and Polish document mapping
  - TypeScript types and service layer
  - See: [PHASE_1_COMPLETION_SUMMARY.md](archive/PHASE_1_COMPLETION_SUMMARY.md)

- **Stock Movements Core** (Phase 2 - Oct 26, 2024)
  - Database schema with movement tracking
  - Stock inventory calculation views
  - Movement validation service
  - Basic UI (list, detail, create pages)
  - Server actions and API
  - See: [PHASE_2_IMPLEMENTATION_SUMMARY.md](archive/PHASE_2_IMPLEMENTATION_SUMMARY.md)

- **Working Movement Types**
  - ✅ 101: Goods Receipt from Purchase Order (with delivery workflow)
  - ✅ 201: Goods Issue for Sales Order
  - ✅ 401-403: Inventory adjustments (increase, decrease, revaluation)

### 🚧 Partially Implemented

- **Deliveries System** - Basic workflow exists, needs "Receive Delivery" button
- **Receipt Documents** - Database ready, PDF generation pending

### ❌ Not Yet Implemented (60%)

- **Stock Reservations** (501-502) - Tables exist, no UI
- **Warehouse Transfers** (301-312) - Migrations disabled
- **Returns** (102-103, 202-203)
- **Internal Operations** (105, 205, 206, 411)
- **Production Movements** (104, 204)
- **E-commerce Integration** (601-613)
- **JPK_MAG Export System**
- **PDF Document Generation**
- **Purchase Orders System**
- **Low Stock Alerts**
- **Row-Level Security** (intentionally disabled for testing)

### 📋 Next Steps

**See:** [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md) for detailed roadmap with priorities P1-P10 and estimated timelines (6-12 weeks to 100% completion).

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Movement Types Catalog](#movement-types-catalog)
4. [Database Schema](#database-schema)
5. [Polish Legal Compliance](#polish-legal-compliance)
6. [E-commerce Integration](#e-commerce-integration)
7. [Business Rules & Validations](#business-rules--validations)
8. [Document Generation](#document-generation)
9. [API Specifications](#api-specifications)
10. [Security & Permissions](#security--permissions)

---

## Executive Summary

### Purpose

This specification defines a comprehensive, enterprise-grade inventory movement and transfer system for the warehouse management application. The system is designed to:

- Handle all types of stock movements (receipts, issues, transfers, adjustments)
- Comply with Polish legal requirements (JPK_MAG, warehouse documents)
- Integrate seamlessly with e-commerce platforms (Shopify, WooCommerce, Allegro)
- Provide full audit trail and traceability
- Support multi-warehouse, multi-location operations

### Key Requirements

1. **Enterprise-Ready**: Comparable to Zoho Inventory, inFlow, Odoo Inventory
2. **Legally Compliant**: Meets Polish accounting law (Ustawa o Rachunkowości)
3. **E-commerce Ready**: Bi-directional sync with major platforms
4. **Audit-Proof**: Complete movement history with document trail
5. **User-Friendly**: Intuitive UI for warehouse operations

---

## System Architecture

### Current State

The system already includes:

- ✅ `stock_movements` - Core movement tracking
- ✅ `transfer_requests` - Inter-branch transfers
- ✅ `stock_snapshots` - Current inventory levels
- ✅ `stock_reservations` - Order commitments
- ✅ `movement_types` - 15 system movement types

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     E-commerce Platforms                     │
│           (Shopify, WooCommerce, Allegro)                   │
└────────────────────┬────────────────────────────────────────┘
                     │ API / Webhooks
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Integration Layer                               │
│  - Channel Sync Service                                      │
│  - Stock Level Sync                                          │
│  - Order Processing                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Business Logic Layer                            │
│  - Stock Movement Service                                    │
│  - Transfer Service                                          │
│  - Document Generation Service                               │
│  - Validation & Approval Workflows                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer                                      │
│  - stock_movements                                           │
│  - transfer_requests / transfer_request_items                │
│  - warehouse_documents (NEW)                                 │
│  - channel_inventory_sync (NEW)                              │
│  - stock_snapshots                                           │
│  - stock_reservations                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Movement Types Catalog

### Classification System

Following SAP-style movement type codes with Polish document mapping:

| Code                                   | Type          | Name                     | Polish Doc | Affects Stock | Description                           |
| -------------------------------------- | ------------- | ------------------------ | ---------- | ------------- | ------------------------------------- |
| **100-199: Receipts (Przyjęcia)**      |
| 101                                    | GR            | Goods Receipt from PO    | PZ         | +1            | Receipt from supplier/purchase order  |
| 102                                    | GR-R          | GR Reversal              | PZ-K       | -1            | Reversal of goods receipt             |
| 103                                    | GR-RET        | Customer Return Receipt  | PZ-ZK      | +1            | Return from customer (increase stock) |
| 104                                    | GR-PROD       | Production Output        | PZ-P       | +1            | Finished goods from production        |
| 105                                    | GR-INIT       | Initial Stock            | PZ-I       | +1            | Opening stock / inventory start       |
| **200-299: Issues (Wydania)**          |
| 201                                    | GI            | Goods Issue for Sale     | WZ         | -1            | Issue to customer/sales order         |
| 202                                    | GI-R          | GI Reversal              | WZ-K       | +1            | Reversal of goods issue               |
| 203                                    | GI-RET        | Return to Supplier       | WZ-ZD      | -1            | Return to supplier                    |
| 204                                    | GI-PROD       | Production Consumption   | RW-P       | -1            | Materials consumed in production      |
| 205                                    | GI-COST       | Issue to Cost Center     | RW         | -1            | Internal consumption                  |
| 206                                    | GI-WASTE      | Waste/Damage             | RW-S       | -1            | Damaged or lost goods                 |
| **300-399: Transfers (Przesunięcia)**  |
| 301                                    | TR-OUT        | Transfer Out             | MM-W       | -1            | Outbound from source location         |
| 302                                    | TR-IN         | Transfer In              | MM-P       | +1            | Inbound to destination location       |
| 303                                    | TR-INTRA      | Intra-Location Move      | MM-L       | 0             | Move within same warehouse            |
| 311                                    | TR-BRANCH-OUT | Inter-Branch Out         | MM-O       | -1            | Transfer to another branch (out)      |
| 312                                    | TR-BRANCH-IN  | Inter-Branch In          | MM-O       | +1            | Transfer from another branch (in)     |
| **400-499: Adjustments (Korekty)**     |
| 401                                    | ADJ-POS       | Positive Adjustment      | KP         | +1            | Increase stock (inventory found)      |
| 402                                    | ADJ-NEG       | Negative Adjustment      | KN         | -1            | Decrease stock (inventory missing)    |
| 403                                    | ADJ-AUDIT     | Audit Adjustment         | INW        | ±1            | Adjustment from physical count        |
| 411                                    | ADJ-QUALITY   | Quality Reclassification | MM-Q       | 0             | Change quality status                 |
| **500-599: Reservations (Rezerwacje)** |
| 501                                    | RSV           | Reservation              | -          | 0             | Reserve stock for order               |
| 502                                    | RSV-REL       | Reservation Release      | -          | 0             | Release reservation                   |
| **600-699: E-commerce (E-commerce)**   |
| 601                                    | EC-SHOP       | Shopify Order            | WZ-S       | -1            | Sale via Shopify                      |
| 602                                    | EC-WOO        | WooCommerce Order        | WZ-W       | -1            | Sale via WooCommerce                  |
| 603                                    | EC-ALLEG      | Allegro Order            | WZ-A       | -1            | Sale via Allegro                      |
| 611                                    | EC-RET-SHOP   | Shopify Return           | PZ-S       | +1            | Return from Shopify                   |
| 612                                    | EC-RET-WOO    | WooCommerce Return       | PZ-W       | +1            | Return from WooCommerce               |
| 613                                    | EC-RET-ALLEG  | Allegro Return           | PZ-A       | +1            | Return from Allegro                   |

### Movement Type Properties

Each movement type has:

```typescript
interface MovementType {
  code: string; // e.g., "101", "301"
  category: "receipt" | "issue" | "transfer" | "adjustment" | "reservation" | "ecommerce";
  name: string;
  nameLocalized: Record<string, string>; // { pl: "Przyjęcie zewnętrzne", en: "Goods Receipt" }
  polishDocument: string; // "PZ", "WZ", "MM", "RW", etc.
  affectsStock: -1 | 0 | 1;
  requiresApproval: boolean;
  requiresSourceLocation: boolean;
  requiresDestinationLocation: boolean;
  requiresReference: boolean; // Must have order/PO reference
  allowsManualEntry: boolean;
  generatesDocument: boolean;
  isSystem: boolean;
  costImpact: "increase" | "decrease" | "neutral";
  accountingEntry?: string; // For integration with accounting
}
```

---

## Database Schema

### Enhanced Movement Types

```sql
-- Enhanced movement_types table
CREATE TABLE movement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('receipt', 'issue', 'transfer', 'adjustment', 'reservation', 'ecommerce')),
  name TEXT NOT NULL,
  name_pl TEXT NOT NULL,
  name_en TEXT NOT NULL,
  polish_document_type TEXT, -- 'PZ', 'WZ', 'MM', 'RW', 'INW', etc.
  affects_stock INTEGER NOT NULL CHECK (affects_stock IN (-1, 0, 1)),
  requires_approval BOOLEAN DEFAULT false,
  requires_source_location BOOLEAN DEFAULT false,
  requires_destination_location BOOLEAN DEFAULT false,
  requires_reference BOOLEAN DEFAULT false,
  allows_manual_entry BOOLEAN DEFAULT true,
  generates_document BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  cost_impact TEXT CHECK (cost_impact IN ('increase', 'decrease', 'neutral')),
  accounting_entry JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Warehouse Documents

```sql
-- New table for Polish warehouse documents
CREATE TABLE warehouse_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Document identification
  document_type TEXT NOT NULL CHECK (document_type IN ('PZ', 'WZ', 'MM', 'RW', 'INW', 'KP', 'KN')),
  document_number TEXT NOT NULL,
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Related movements
  movement_ids UUID[] NOT NULL, -- Array of related stock_movements.id

  -- Document details
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  supplier_id UUID REFERENCES suppliers(id),
  customer_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'printed', 'archived', 'cancelled')),

  -- Users
  created_by UUID NOT NULL REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,

  -- Document content (for PDF generation)
  document_data JSONB NOT NULL, -- Contains all items, totals, notes
  notes TEXT,

  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  UNIQUE(organization_id, branch_id, document_type, document_number)
);

CREATE INDEX idx_warehouse_documents_org_branch ON warehouse_documents(organization_id, branch_id);
CREATE INDEX idx_warehouse_documents_type_number ON warehouse_documents(document_type, document_number);
CREATE INDEX idx_warehouse_documents_date ON warehouse_documents(document_date);
CREATE INDEX idx_warehouse_documents_status ON warehouse_documents(status);
```

### E-commerce Channel Sync

```sql
-- Track inventory sync with e-commerce channels
CREATE TABLE channel_inventory_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Channel identification
  channel_type TEXT NOT NULL CHECK (channel_type IN ('shopify', 'woocommerce', 'allegro')),
  channel_id TEXT NOT NULL, -- Store ID or account ID
  channel_location_id TEXT, -- External location/warehouse ID

  -- Product mapping
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  channel_product_id TEXT NOT NULL, -- External product/variant ID

  -- Inventory location mapping
  warehouse_id UUID REFERENCES warehouses(id),
  location_id UUID REFERENCES locations(id),

  -- Sync status
  last_synced_quantity NUMERIC,
  current_quantity NUMERIC,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Configuration
  auto_sync BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('to_channel', 'from_channel', 'bidirectional')),

  -- Metadata
  channel_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, channel_type, channel_id, channel_product_id)
);

CREATE INDEX idx_channel_sync_org_channel ON channel_inventory_sync(organization_id, channel_type);
CREATE INDEX idx_channel_sync_product ON channel_inventory_sync(product_id, variant_id);
CREATE INDEX idx_channel_sync_status ON channel_inventory_sync(sync_status);
CREATE INDEX idx_channel_sync_next_sync ON channel_inventory_sync(next_sync_at) WHERE sync_status = 'pending';
```

### Delivery Receipts

```sql
-- Track incoming deliveries (purchase orders, returns)
CREATE TABLE delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Receipt identification
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,

  -- Source
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('purchase', 'return', 'transfer', 'production', 'other')),
  supplier_id UUID REFERENCES suppliers(id),
  purchase_order_id UUID, -- If applicable

  -- Destination
  receiving_location_id UUID NOT NULL REFERENCES locations(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),

  -- Users
  created_by UUID NOT NULL REFERENCES users(id),
  received_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ,

  -- Details
  notes TEXT,
  shipping_method TEXT,
  tracking_number TEXT,
  carrier TEXT,

  -- Generated documents
  pz_document_id UUID REFERENCES warehouse_documents(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  UNIQUE(organization_id, branch_id, receipt_number)
);

CREATE TABLE delivery_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_receipt_id UUID NOT NULL REFERENCES delivery_receipts(id) ON DELETE CASCADE,

  -- Product
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),

  -- Quantities
  expected_quantity NUMERIC NOT NULL CHECK (expected_quantity > 0),
  received_quantity NUMERIC DEFAULT 0 CHECK (received_quantity >= 0),
  damaged_quantity NUMERIC DEFAULT 0 CHECK (damaged_quantity >= 0),

  -- Cost
  unit_cost NUMERIC,
  total_cost NUMERIC,
  currency TEXT DEFAULT 'PLN',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'over_received')),

  -- Tracking
  batch_number TEXT,
  serial_numbers TEXT[],
  expiry_date DATE,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Polish Legal Compliance

### Required Documents

#### 1. PZ (Przyjęcie Zewnętrzne) - External Receipt

**When:** Goods received from supplier, customer return, production output
**Required Fields:**

- Document number (format: `PZ/YYYY/MM/NNNN`)
- Date of receipt
- Supplier/source details
- Receiving warehouse/location
- List of items (name, SKU, quantity, unit, unit price, total)
- Total value
- Person receiving (name, signature)
- Person issuing (if applicable)

**Generated For Movement Types:** 101, 103, 104, 105

#### 2. WZ (Wydanie Zewnętrzne) - External Issue

**When:** Goods issued to customer, return to supplier
**Required Fields:**

- Document number (format: `WZ/YYYY/MM/NNNN`)
- Date of issue
- Customer/destination details
- Issuing warehouse/location
- List of items (name, SKU, quantity, unit, unit price, total)
- Total value
- Person issuing (name, signature)
- Person receiving (if applicable)
- Transport details (if applicable)

**Generated For Movement Types:** 201, 203, 601, 602, 603

#### 3. MM (Międzymagazynowe) - Inter-Warehouse Transfer

**When:** Stock moved between warehouses or locations
**Required Fields:**

- Document number (format: `MM/YYYY/MM/NNNN`)
- Date of transfer
- Source warehouse/location
- Destination warehouse/location
- List of items (name, SKU, quantity, unit)
- Person issuing (name, signature)
- Person receiving (name, signature)
- Transport details

**Generated For Movement Types:** 301, 302, 311, 312

#### 4. RW (Rozchód Wewnętrzny) - Internal Issue

**When:** Internal consumption, waste, damage
**Required Fields:**

- Document number (format: `RW/YYYY/MM/NNNN`)
- Date
- Cost center/department
- Purpose of issue
- List of items (name, SKU, quantity, unit, value)
- Total value
- Person issuing (name, signature)
- Accounting codes (if applicable)

**Generated For Movement Types:** 204, 205, 206

#### 5. INW (Inwentaryzacja) - Inventory Count

**When:** Physical stock count, audit adjustment
**Required Fields:**

- Document number (format: `INW/YYYY/MM/NNNN`)
- Count date
- Warehouse/location
- List of items with:
  - Book quantity (from system)
  - Physical quantity (counted)
  - Difference (+/-)
  - Value of difference
- Commission members (names, signatures)
- Adjustment decision

**Generated For Movement Types:** 403

### JPK_MAG (Electronic Audit File)

#### Structure Requirements

Based on Polish Ministry of Finance specification:

```xml
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2023/08/05/08051/">
  <Naglowek>
    <KodFormularza>JPK_MAG</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2025-01-01</DataOd>
    <DataDo>2025-01-31</DataDo>
    <NazwaSystemu>CoreFrame Warehouse</NazwaSystemu>
  </Naglowek>

  <Magazyn>
    <KodMagazynu>MAG-001</KodMagazynu>
    <NazwaMagazynu>Magazyn Główny Warszawa</NazwaMagazynu>
  </Magazyn>

  <Towar>
    <KodTowaru>SKU-12345</KodTowaru>
    <NazwaTowaru>Produkt Przykładowy</NazwaTowaru>
    <JednostkaMiary>szt</JednostkaMiary>
  </Towar>

  <RuchMagazynowy>
    <NumerDokumentu>PZ/2025/01/0001</NumerDokumentu>
    <DataDokumentu>2025-01-15</DataDokumentu>
    <RodzajDokumentu>PZ</RodzajDokumentu>
    <KodTowaru>SKU-12345</KodTowaru>
    <KodMagazynu>MAG-001</KodMagazynu>
    <Ilosc>100.00</Ilosc>
    <WartoscJednostkowa>25.50</WartoscJednostkowa>
    <WartoscCalkowita>2550.00</WartoscCalkowita>
  </RuchMagazynowy>

  <StanNaKoniec>
    <KodTowaru>SKU-12345</KodTowaru>
    <KodMagazynu>MAG-001</KodMagazynu>
    <IloscNaKoniec>500.00</IloscNaKoniec>
    <WartoscNaKoniec>12750.00</WartoscNaKoniec>
  </StanNaKoniec>
</JPK>
```

#### Export Requirements

- Must be generated on demand (not regular submission like JPK_VAT)
- Must include all movements for requested period
- Must show opening balance, all movements, and closing balance
- Must match with accounting records
- Values in PLN (Polish Zloty)

---

## E-commerce Integration

### Shopify Integration

#### Inventory Level Management

**API Endpoints:**

- `GET /admin/api/2025-01/inventory_levels.json` - Get current stock
- `POST /admin/api/2025-01/inventory_levels/set.json` - Set stock level
- `POST /admin/api/2025-01/inventory_levels/adjust.json` - Adjust stock

**Webhook Events:**

- `inventory_levels/update` - Stock changed
- `orders/create` - New order (reserve stock)
- `orders/cancelled` - Order cancelled (release reservation)
- `orders/fulfilled` - Order fulfilled (issue stock)
- `refunds/create` - Refund (return stock)

**Sync Flow:**

```
Sale Order Created → Reserve Stock → Generate Movement (601)
Order Fulfilled → Issue Stock → Update Shopify Level
Customer Return → Receive Stock → Generate Movement (611)
```

### WooCommerce Integration

**API Endpoints:**

- `GET /wp-json/wc/v3/products/{id}` - Get product stock
- `PUT /wp-json/wc/v3/products/{id}` - Update product stock
- `GET /wp-json/wc/v3/orders` - Get orders

**Webhook Events:**

- `order.created` - New order
- `order.updated` - Order status change
- `order.refunded` - Refund

**Multi-Location Support:**

- Use plugin like Stock Locations for WooCommerce
- Map plugin locations to warehouse locations
- Sync per-location inventory

### Allegro Integration

**API Endpoints:**

- `GET /sale/offers` - Get offers
- `GET /sale/offer-quantity-change-commands/{commandId}` - Check quantity update
- `PUT /sale/product-offers/{offerId}` - Update offer
- `GET /order/checkout-forms` - Get orders

**Stock Update:**

```http
PATCH /sale/product-offers/{offerId}
{
  "stock": {
    "available": 100,
    "unit": "UNIT"
  }
}
```

**Order Processing:**

```
1. Webhook: OFFER_STOCK_CHANGED
2. Create reservation (movement type 501)
3. Generate issue movement (603)
4. Update Allegro delivery status
```

### Channel Sync Strategy

#### Sync Frequency

- **Real-time:** On stock movement affecting channel products
- **Scheduled:** Every 15 minutes for safety sync
- **Manual:** On-demand sync trigger

#### Conflict Resolution

1. **Source of Truth:** Internal system
2. **On Conflict:** Internal value wins, log discrepancy
3. **Manual Review:** Flag for user review if large difference

#### Error Handling

- Retry failed syncs (exponential backoff)
- Queue for manual review after 3 failures
- Alert warehouse manager
- Continue syncing other products

---

## Business Rules & Validations

### Movement Validation Rules

#### General Rules

1. **Quantity Validation**
   - Must be > 0 (except for zero-impact movements like reservations)
   - Cannot issue more than available stock (unless override permission)
   - Decimals allowed only if unit allows (e.g., kg, liters)

2. **Location Validation**
   - Source location required for issues and transfer-out
   - Destination location required for receipts and transfer-in
   - Cannot transfer to same location (use intra-location move)

3. **Product Validation**
   - Product must be active
   - For variants: variant must exist and be active
   - SKU must be unique

4. **Cost Validation**
   - Unit cost required for receipts
   - Calculate total_cost = quantity × unit_cost
   - Currency must match organization currency

#### Movement-Specific Rules

**101 (Goods Receipt):**

- Requires purchase order reference (optional but recommended)
- Requires supplier
- Updates average cost in stock_snapshots
- Generates PZ document

**201 (Goods Issue for Sale):**

- Requires sales order reference
- Checks available stock
- Deducts from reservation if exists
- Generates WZ document

**301/302 (Transfer):**

- Creates two movements: OUT from source, IN to destination
- Transfer status: draft → approved → in_transit → completed
- Can be cancelled only if not completed
- Generates MM document

**401/402 (Adjustments):**

- Requires approval from warehouse manager
- Requires reason/notes
- Audit trail mandatory
- Generates KP/KN document

### Approval Workflows

#### Movement Approval

```
1. User creates movement (status: draft)
2. System validates business rules
3. If requires_approval:
   a. Send notification to approver
   b. Approver reviews and approves/rejects
   c. If approved: status = approved, execute movement
   d. If rejected: status = rejected, log reason
4. If no approval needed:
   a. Auto-approve
   b. Execute movement
```

#### Transfer Approval

```
1. User creates transfer request (status: pending)
2. System checks stock availability
3. Source warehouse manager approves (status: approved)
4. Create reservation at source
5. User marks as shipped (status: in_transit)
6. Create OUT movement at source
7. Destination receives (status: completed)
8. Create IN movement at destination
9. Release reservation
```

### Stock Reservation Rules

1. **Priority Order:**
   - Urgent orders first
   - First-in-first-out for same priority
   - Manual priority override allowed

2. **Expiration:**
   - Default: 7 days
   - Configurable per organization
   - Auto-release on expiration

3. **Over-reservation Protection:**
   - Cannot reserve more than available
   - Exception: Allow if "allow_negative_stock" is enabled

---

## Document Generation

### Document Templates

#### Template Structure (Handlebars)

```handlebars
<html>
  <head>
    <meta charset="UTF-8" />
    <title>{{documentType}} {{documentNumber}}</title>
    <style>
      /* PDF-friendly styles */
      @page {
        size: A4;
        margin: 2cm;
      }
      body {
        font-family: Arial, sans-serif;
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
      }
      .table th,
      .table td {
        border: 1px solid #000;
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>{{documentTypeName}}</h1>
      <p>Nr: {{documentNumber}} | Data: {{documentDate}}</p>
    </div>

    <div class="parties">
      <p><strong>Z magazynu:</strong> {{fromLocation}}</p>
      <p><strong>Do magazynu:</strong> {{toLocation}}</p>
      {{#if supplier}}
        <p><strong>Dostawca:</strong> {{supplier.name}}</p>
      {{/if}}
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Lp.</th>
          <th>Nazwa towaru</th>
          <th>SKU</th>
          <th>Ilość</th>
          <th>Jednostka</th>
          <th>Cena jedn.</th>
          <th>Wartość</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
          <tr>
            <td>{{@index}}</td>
            <td>{{name}}</td>
            <td>{{sku}}</td>
            <td>{{quantity}}</td>
            <td>{{unit}}</td>
            <td>{{formatCurrency unitCost}}</td>
            <td>{{formatCurrency totalCost}}</td>
          </tr>
        {{/each}}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6"><strong>Razem:</strong></td>
          <td><strong>{{formatCurrency totalValue}}</strong></td>
        </tr>
      </tfoot>
    </table>

    <div class="signatures">
      <p>Osoba wydająca: .........................</p>
      <p>Osoba przyjmująca: .........................</p>
    </div>

    <div class="notes">
      {{#if notes}}
        <p><strong>Uwagi:</strong> {{notes}}</p>
      {{/if}}
    </div>
  </body>
</html>
```

### Document Numbering

Format: `{TYPE}/{YYYY}/{MM}/{NNNN}`

Examples:

- `PZ/2025/10/0001`
- `WZ/2025/10/0042`
- `MM/2025/10/0015`

**Implementation:**

```sql
CREATE SEQUENCE IF NOT EXISTS seq_pz_2025_10;
CREATE SEQUENCE IF NOT EXISTS seq_wz_2025_10;
-- etc., create dynamically per type/year/month
```

### PDF Generation

**Library:** puppeteer or react-pdf

**Process:**

1. Generate HTML from template
2. Fill template with data
3. Convert to PDF
4. Store in Supabase Storage
5. Save URL in `warehouse_documents.pdf_url`

---

## API Specifications

### REST Endpoints

#### Create Stock Movement

```http
POST /api/warehouse/movements
Authorization: Bearer {token}
Content-Type: application/json

{
  "movementTypeCode": "101",
  "productId": "uuid",
  "variantId": "uuid",
  "quantity": 100,
  "unitCost": 25.50,
  "locationId": "uuid",
  "referenceType": "purchase_order",
  "referenceId": "uuid",
  "notes": "Delivered by DHL",
  "batchNumber": "BATCH-2025-001",
  "expiryDate": "2026-12-31"
}

Response 201:
{
  "movementId": "uuid",
  "documentId": "uuid",
  "documentNumber": "PZ/2025/10/0001",
  "status": "completed"
}
```

#### Create Transfer Request

```http
POST /api/warehouse/transfers
Authorization: Bearer {token}

{
  "fromLocationId": "uuid",
  "toLocationId": "uuid",
  "priority": "normal",
  "expectedDate": "2025-10-30",
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 50
    }
  ],
  "notes": "Urgent transfer for retail store"
}

Response 201:
{
  "transferId": "uuid",
  "transferNumber": "TR/2025/10/0001",
  "status": "pending"
}
```

#### Receive Delivery

```http
POST /api/warehouse/deliveries/{deliveryId}/receive
Authorization: Bearer {token}

{
  "items": [
    {
      "itemId": "uuid",
      "receivedQuantity": 98,
      "damagedQuantity": 2,
      "notes": "2 units damaged in transport"
    }
  ],
  "receivedBy": "uuid"
}

Response 200:
{
  "deliveryId": "uuid",
  "status": "completed",
  "pzDocumentId": "uuid",
  "movements": ["uuid", "uuid"]
}
```

#### Sync Channel Inventory

```http
POST /api/warehouse/channels/{channelType}/sync
Authorization: Bearer {token}

{
  "channelId": "shopify-store-123",
  "productIds": ["uuid1", "uuid2"], // optional, all if omitted
  "force": false
}

Response 200:
{
  "synced": 45,
  "failed": 2,
  "skipped": 3,
  "errors": [
    {
      "productId": "uuid",
      "error": "Product not found in Shopify"
    }
  ]
}
```

---

## Security & Permissions

### Role-Based Access Control

#### Permissions

| Permission Code                  | Name                | Description                |
| -------------------------------- | ------------------- | -------------------------- |
| `warehouse.movements.create`     | Create Movements    | Create stock movements     |
| `warehouse.movements.view`       | View Movements      | View movement history      |
| `warehouse.movements.approve`    | Approve Movements   | Approve pending movements  |
| `warehouse.movements.delete`     | Delete Movements    | Delete draft movements     |
| `warehouse.transfers.create`     | Create Transfers    | Create transfer requests   |
| `warehouse.transfers.approve`    | Approve Transfers   | Approve transfer requests  |
| `warehouse.transfers.ship`       | Ship Transfers      | Mark transfer as shipped   |
| `warehouse.transfers.receive`    | Receive Transfers   | Receive transfers          |
| `warehouse.deliveries.create`    | Create Deliveries   | Create delivery receipts   |
| `warehouse.deliveries.receive`   | Receive Deliveries  | Receive deliveries         |
| `warehouse.adjustments.create`   | Create Adjustments  | Create stock adjustments   |
| `warehouse.adjustments.approve`  | Approve Adjustments | Approve adjustments        |
| `warehouse.documents.view`       | View Documents      | View warehouse documents   |
| `warehouse.documents.print`      | Print Documents     | Print/download documents   |
| `warehouse.documents.export_jpk` | Export JPK          | Export JPK_MAG             |
| `warehouse.channels.sync`        | Sync Channels       | Sync with e-commerce       |
| `warehouse.channels.configure`   | Configure Channels  | Configure channel settings |

#### Role Assignments

**Warehouse Manager:**

- All permissions

**Warehouse Operator:**

- Create movements (receipt, issue)
- Receive deliveries
- Create transfers
- View documents

**Warehouse Clerk:**

- View movements
- View documents

**System Admin:**

- All permissions + configure channels

### Audit Trail

Every movement records:

- Who created it (`created_by`)
- When it was created (`created_at`)
- Who approved it (`approved_by`)
- When it occurred (`occurred_at`)
- All changes (through database triggers)

---

## Appendix

### Glossary

- **PZ (Przyjęcie Zewnętrzne):** External Receipt Document
- **WZ (Wydanie Zewnętrzne):** External Issue Document
- **MM (Międzymagazynowe):** Inter-Warehouse Transfer Document
- **RW (Rozchód Wewnętrzny):** Internal Issue Document
- **INW (Inwentaryzacja):** Inventory Count Document
- **GR (Goods Receipt):** Receiving goods into inventory
- **GI (Goods Issue):** Issuing goods from inventory
- **JPK_MAG:** Electronic Audit File for Inventory

### References

1. Ustawa o Rachunkowości (Polish Accounting Act)
2. Shopify Admin API Documentation
3. WooCommerce REST API Documentation
4. Allegro REST API Documentation
5. SAP MM Movement Types Guide
6. Zoho Inventory Transfer Orders Guide
7. Odoo Inventory Documentation

---

**Document Control:**

| Version | Date       | Author | Changes               |
| ------- | ---------- | ------ | --------------------- |
| 1.0     | 2025-10-24 | Claude | Initial specification |

---

_End of Technical Specification_
