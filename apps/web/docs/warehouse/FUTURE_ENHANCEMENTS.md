# Warehouse System - Future Enhancements

**Created:** November 14, 2024
**Status:** Planning (Post-Production)
**Priority:** Post-Release

---

## 📋 Overview

This document contains feature enhancements and improvements planned for **after the initial production release** of the warehouse management system. These features are not critical for the MVP but will significantly improve efficiency and automation.

The features are organized by category and priority for post-production implementation.

---

## 🤖 Automated Reorder System

**Priority:** High (First post-production feature)
**Estimated Time:** 2-3 days
**Dependencies:** Purchase Orders Module (Phase 2)

### Overview

Automatically generate purchase order suggestions based on stock alerts, historical consumption patterns, and supplier lead times. This reduces manual intervention and ensures optimal stock levels.

### Key Features

#### 1. Intelligent Reorder Suggestions

- **Smart Quantity Calculation**
  - Based on historical consumption rate
  - Considers supplier MOQ (minimum order quantity)
  - Respects order multiples (e.g., packs of 12)
  - Accounts for lead time to avoid stockouts
  - Formula: `reorder_qty = MAX(reorder_point + (avg_daily_consumption * lead_time), min_order_qty)`

- **Supplier Selection Logic**
  - Preferred supplier first
  - Falls back to best price if preferred unavailable
  - Considers lead time vs. urgency
  - Evaluates supplier performance history

#### 2. Automated Draft PO Generation

- **Batch Processing**
  - Group multiple low-stock items from same supplier
  - Create single PO for efficiency
  - Optimize shipping costs by combining orders
  - Consider delivery location grouping

- **Smart Scheduling**
  - Run daily/weekly based on configuration
  - Separate urgent vs. normal priority items
  - Consider supplier ordering schedules
  - Avoid duplicate orders

#### 3. Review & Approval Workflow

- **Manual Review Before Approval**
  - All auto-generated POs start as "draft"
  - Warehouse manager reviews suggestions
  - Can adjust quantities before approval
  - Can combine or split suggested orders

- **Approval Rules**
  - Auto-approve for trusted suppliers (optional)
  - Require approval above certain amount
  - Multi-level approval for large orders
  - Budget constraint validation

### Database Schema

#### New Table: `reorder_suggestions`

```sql
CREATE TABLE reorder_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

  -- Product & supplier
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  suggested_supplier_id UUID NOT NULL REFERENCES business_accounts(id),
  product_supplier_id UUID REFERENCES product_suppliers(id),

  -- Stock levels
  current_stock DECIMAL(15,3) NOT NULL,
  reorder_point DECIMAL(15,3) NOT NULL,
  suggested_quantity DECIMAL(15,3) NOT NULL,
  adjusted_quantity DECIMAL(15,3), -- User can adjust

  -- Rationale
  calculation_method TEXT, -- 'consumption_based', 'reorder_point', 'manual'
  avg_daily_consumption DECIMAL(15,3),
  lead_time_days INTEGER,
  days_until_stockout DECIMAL(10,2),

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'converted_to_po'
  purchase_order_id UUID REFERENCES purchase_orders(id),

  -- Actions
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  converted_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

  CHECK (status IN ('pending', 'approved', 'rejected', 'converted_to_po')),
  CHECK (suggested_quantity > 0)
);

CREATE INDEX idx_reorder_suggestions_org ON reorder_suggestions(organization_id);
CREATE INDEX idx_reorder_suggestions_status ON reorder_suggestions(status) WHERE status = 'pending';
CREATE INDEX idx_reorder_suggestions_product ON reorder_suggestions(product_id);
```

#### New Table: `consumption_history`

Track product consumption for smart reordering:

```sql
CREATE TABLE consumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_in_period INTEGER GENERATED ALWAYS AS (period_end - period_start + 1) STORED,

  -- Consumption
  quantity_consumed DECIMAL(15,3) NOT NULL,
  avg_daily_consumption DECIMAL(15,3) GENERATED ALWAYS AS (quantity_consumed / NULLIF(days_in_period, 0)) STORED,

  -- Context
  calculation_date DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, organization_id, branch_id, period_start, period_end)
);

CREATE INDEX idx_consumption_history_product ON consumption_history(product_id);
CREATE INDEX idx_consumption_history_period ON consumption_history(period_start DESC, period_end DESC);
```

### Service Layer

**File:** `src/modules/warehouse/api/automated-reorder-service.ts`

```typescript
class AutomatedReorderService {
  // Generate reorder suggestions for all low-stock items
  async generateReorderSuggestions(
    organizationId: string,
    branchId?: string
  ): Promise<ReorderSuggestion[]>;

  // Calculate consumption rate for a product
  async calculateConsumptionRate(
    productId: string,
    days: number = 30
  ): Promise<{
    avgDailyConsumption: number;
    trend: "increasing" | "decreasing" | "stable";
  }>;

  // Calculate optimal reorder quantity
  async calculateReorderQuantity(
    productId: string,
    supplierId: string
  ): Promise<{
    suggestedQty: number;
    adjustedForMOQ: number;
    rationale: string;
  }>;

  // Convert suggestion to draft PO
  async convertToPurchaseOrder(suggestionId: string, userId: string): Promise<PurchaseOrder>;

  // Batch convert multiple suggestions to single PO
  async batchConvertToPO(suggestionIds: string[], userId: string): Promise<PurchaseOrder>;

  // Review and approve/reject suggestion
  async reviewSuggestion(
    suggestionId: string,
    action: "approve" | "reject",
    userId: string,
    adjustedQty?: number,
    reason?: string
  ): Promise<ReorderSuggestion>;
}
```

### UI Components

1. **Reorder Suggestions Dashboard** (`/dashboard/warehouse/reorder-suggestions`)
   - List of pending suggestions
   - Grouped by supplier
   - Quick approve/reject actions
   - Batch operations

2. **Suggestion Review Modal**
   - Product details and stock levels
   - Consumption chart
   - Suggested vs. adjusted quantity
   - Supplier comparison
   - Approve/reject buttons

3. **Automation Settings** (`/dashboard/warehouse/settings/automation`)
   - Enable/disable automated suggestions
   - Frequency (daily, weekly)
   - Auto-approval rules
   - Notification preferences

### Success Metrics

- [ ] Reorder suggestions generated daily
- [ ] Consumption rate calculated accurately
- [ ] Suggestions respect MOQ and order multiples
- [ ] Batch PO creation from multiple suggestions
- [ ] Manual review and adjustment workflow
- [ ] Auto-approval rules configurable
- [ ] Suggestion expiry (7 days default)

---

## 📄 Advanced PDF Document Generation

**Priority:** Medium-High
**Estimated Time:** 2-3 days
**Dependencies:** Purchase Orders Module

### Overview

Generate professional PDF documents for purchase orders, receipts, and stock movement documents that comply with Polish legal requirements.

### Features to Implement

#### 1. Purchase Order PDFs

- **Company branding** (logo, colors)
- **Supplier information**
- **Itemized list** with prices
- **Terms and conditions**
- **QR code** for quick lookup
- **Multi-language support** (Polish/English)

#### 2. Receipt Documents (PZ, WZ, MM)

- **Polish legal compliance** (document type, numbering)
- **Signature fields**
- **Product details** with batch/lot numbers
- **Location information**
- **Movement type documentation**

#### 3. Stock Labels

- **Product labels** with barcodes
- **Location labels** with QR codes
- **Batch labels**
- **Customizable templates**

### Technical Approach

- Use **React-PDF** or **PDFKit** for generation
- Create reusable PDF templates
- Support custom branding per organization
- Store generated PDFs in Supabase Storage
- Email PDF attachments to suppliers

---

## 📊 Advanced Analytics & Reporting

**Priority:** Medium
**Estimated Time:** 3-4 days
**Dependencies:** Consumption history data

### Reports to Build

#### 1. Supplier Performance Analytics

- **Delivery time accuracy** (promised vs. actual)
- **Price trend analysis** over time
- **Order fulfillment rate** (partial vs. complete)
- **Quality metrics** (returns, damages)
- **Cost comparison** across suppliers

#### 2. Inventory Forecasting

- **Demand prediction** using historical data
- **Seasonal trend analysis**
- **Stock turnover rates**
- **Dead stock identification**
- **Optimal reorder point suggestions**

#### 3. Cost Analysis

- **Total cost of ownership** per product
- **Carrying cost calculations**
- **Price variance reports**
- **Budget vs. actual spending**

### Technical Implementation

- Create database views for common queries
- Use charting library (Recharts/Chart.js)
- Export to Excel/CSV
- Scheduled email reports
- Dashboard widgets

---

## 🔄 Batch Purchase Orders

**Priority:** Medium
**Estimated Time:** 1-2 days
**Dependencies:** Purchase Orders Module

### Overview

Allow users to quickly create purchase orders for multiple low-stock items from the same supplier in a single operation.

### Features

- **Multi-select low stock items**
- **Automatic supplier grouping**
- **Bulk quantity editing**
- **One-click PO generation**
- **Preview before creation**

### UI Flow

1. Low stock alerts page
2. Select multiple items (checkboxes)
3. Click "Create Batch PO"
4. System groups by supplier
5. Review/adjust quantities
6. Generate multiple POs (one per supplier)

---

## 📱 Mobile Warehouse App

**Priority:** Low (Future)
**Estimated Time:** 4-6 weeks
**Dependencies:** Core warehouse features

### Overview

Mobile application for warehouse workers to perform stock operations on the go.

### Key Features

- **Barcode/QR code scanning**
- **Quick stock movements**
- **Receive goods mobile flow**
- **Stock counts and audits**
- **Location navigation**
- **Offline mode support**

### Technology Stack

- **React Native** or **Progressive Web App (PWA)**
- **Camera access** for scanning
- **Local storage** for offline mode
- **Real-time sync** with backend

---

## 🔗 E-commerce Integration Enhancements

**Priority:** Low (Future)
**Estimated Time:** 2-3 weeks
**Dependencies:** E-commerce movement types (601-613)

### Integrations to Build

#### 1. Shopify Integration

- **Bi-directional sync** (orders → movements, stock → Shopify)
- **Automatic fulfillment** updates
- **Multi-location support**
- **Webhook handlers**

#### 2. WooCommerce Integration

- **Stock sync**
- **Order import**
- **Fulfillment export**

#### 3. Allegro Integration (Polish marketplace)

- **Listing sync**
- **Order processing**
- **Stock updates**

---

## 🔐 Advanced Row-Level Security (RLS)

**Priority:** CRITICAL (Before Production)
**Estimated Time:** 1 week
**Dependencies:** None (blockes production)

### Overview

Implement comprehensive RLS policies for all warehouse tables to ensure proper data isolation and security.

**Note:** This is marked as P10 in the main roadmap and MUST be completed before production deployment.

### Tables Requiring RLS

- `products`, `product_variants`, `product_suppliers`
- `stock_movements`, `stock_movement_items`
- `purchase_orders`, `purchase_order_items`
- `stock_alerts`, `reorder_suggestions`
- `locations`, `business_accounts`
- All other warehouse tables

### Policy Types

- **Organization isolation** - Users only see their org data
- **Branch isolation** - Branch-specific data access
- **Role-based access** - Different permissions per role
- **Action-based policies** - Read vs. Write vs. Delete

---

## 💡 Additional Ideas (Low Priority)

### 1. Smart Inventory Optimization

- **ABC analysis** - Categorize products by value/volume
- **Economic Order Quantity (EOQ)** calculations
- **Safety stock recommendations**
- **Seasonal adjustment factors**

### 2. Supplier Portal

- **Self-service login** for suppliers
- **View their POs**
- **Update delivery status**
- **Upload invoices**
- **Product catalog management**

### 3. Multi-warehouse Transfers

- **Inter-warehouse stock transfers**
- **Transfer requests and approvals**
- **Transit tracking**
- **Automatic cost calculations**

### 4. Advanced Barcode Support

- **GS1 barcode parsing**
- **Batch/Lot tracking from barcodes**
- **Expiry date extraction**
- **Multi-pack scanning**

### 5. Integration with Accounting Systems

- **Export to accounting software** (e.g., Symfonia, Comarch)
- **Automatic journal entries**
- **Cost center allocation**
- **VAT calculations**

---

## 📝 Implementation Priority Order (Post-Production)

1. **Automated Reorder System** (2-3 days) - High value, moderate effort
2. **Advanced PDF Generation** (2-3 days) - Required for professional operations
3. **Batch Purchase Orders** (1-2 days) - Quick win for efficiency
4. **Supplier Performance Analytics** (3-4 days) - Data-driven decisions
5. **Mobile Warehouse App** (4-6 weeks) - Long-term project
6. **E-commerce Integration** (2-3 weeks) - Depends on business needs

---

**Last Updated:** November 14, 2024
**Review Schedule:** After each production release
**Questions?** See main roadmap in REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md
