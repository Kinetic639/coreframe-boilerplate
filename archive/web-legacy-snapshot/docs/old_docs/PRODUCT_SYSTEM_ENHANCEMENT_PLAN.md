# Product & Variant System Enhancement Plan

**Goal:** Transform into World-Class Inventory Management (Zoho/inFlow/Odoo Level)

**Date Created:** 2025-10-17
**Status:** Planning Phase
**Priority:** High - Critical for Production Launch

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Critical Gaps Identified](#critical-gaps-identified)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Technical Architecture](#technical-architecture)
6. [Success Metrics](#success-metrics)
7. [Resources & References](#resources--references)

---

## Executive Summary

This document outlines the comprehensive plan to transform our inventory management system from a basic product catalog into a **production-ready, legally compliant, multi-channel inventory management platform** that rivals industry leaders like Zoho Inventory, inFlow, and Odoo.

**Key Objectives:**

- ✅ Achieve full Polish/EU regulatory compliance (Omnibus, VAT, CE, WEEE)
- ✅ Enable seamless integration with Shopify, WooCommerce, and Allegro
- ✅ Implement advanced inventory features (lot/serial tracking, FIFO costing, multi-warehouse)
- ✅ Create professional variant management system
- ✅ Build comprehensive media management for e-commerce

**Timeline:** 10-13 weeks for full implementation
**Phases:** 6 major phases (detailed below)

---

## Current State Analysis

### ✅ What's Already Implemented

Our current system has a solid foundation:

#### 1. **Product Data Model**

- **Tables:**
  - `products` - Main product table with types: `goods`, `service`, `item_group`
  - `product_variants` - Variant support for item groups
  - `variant_option_groups` - Reusable attribute groups (Color, Size, etc.)
  - `variant_option_values` - Values for each group
  - `product_barcodes` - Multi-barcode support per product/variant
  - `product_categories` - Hierarchical category structure
  - `product_custom_field_definitions` - Extensible custom fields
  - `product_custom_field_values` - Custom field data
  - `product_images` - Image storage references

- **Key Fields Present:**
  - Identifiers: SKU, UPC, EAN, ISBN, MPN
  - Measurements: Dimensions (L/W/H), Weight
  - Pricing: Selling price, Cost price
  - Inventory: Track inventory flag, Reorder point, Opening stock
  - Classification: Brand, Manufacturer, Category
  - Accounts: Sales account, Purchase account, Inventory account

#### 2. **Inventory Management System**

- **Movement-Based Tracking** (similar to Shopify/Amazon):
  - `movement_types` - Predefined movement types
  - `stock_movements` - Immutable audit trail of all stock changes
  - `stock_snapshots` - Materialized view of current stock levels
  - `stock_reservations` - Reserved stock for orders/transfers
  - `transfer_requests` - Inter-branch stock transfers
  - `transfer_request_items` - Line items for transfers

- **Features:**
  - Multi-location stock tracking
  - Automated snapshot calculation via triggers
  - Movement types: purchase, sale, adjustment, damaged, transfer, return, etc.
  - Reservation system (active, fulfilled, cancelled, expired)
  - Transfer workflow (pending → approved → in_transit → completed)

#### 3. **UI Components**

- Product creation dialog with 5 tabs:
  - Basic Info (name, SKU, description, brand, manufacturer)
  - Sales Info (selling price, sales account)
  - Purchase Info (cost price, vendor)
  - Inventory Settings (track inventory, reorder point, opening stock)
  - Additional (identifiers: UPC/EAN/ISBN/MPN, measurements)
- Multiple product views: Cards, List, Table
- Advanced filtering system
- Barcode management UI

#### 4. **Integration Points**

- Supabase backend with TypeScript types
- RLS (Row Level Security) ready (currently disabled)
- Multi-organization/branch support
- User role-based access control framework

---

## Critical Gaps Identified

Despite the solid foundation, there are critical gaps that prevent production deployment in Poland and integration with major e-commerce platforms.

### ❌ 1. Polish/EU Regulatory Compliance (CRITICAL - BLOCKING LAUNCH)

#### 1.1 **Omnibus Directive Compliance** (MISSING)

**Legal Requirement:** When displaying a reduced price, merchants must show the lowest price from the previous 30 days.

**Current State:** ❌ No price history tracking
**Impact:** Legal liability, fines from UOKiK (Polish consumer protection office)

**Required:**

- Price change logging with timestamps
- Automated calculation of "lowest price in last 30 days"
- Display of lowest price badge when showing discounts
- Price history retention for audit purposes

**References:**

- [UOKiK Omnibus Guidance](https://www.uokik.gov.pl/omnibus)
- EU Directive 2019/2161 (Omnibus Directive)

#### 1.2 **VAT Compliance** (MISSING)

**Legal Requirement:** Products must have correct VAT rates assigned for invoicing and reporting.

**Current State:** ❌ No VAT rate field on products
**Impact:** Incorrect invoicing, tax compliance issues

**Required:**

- VAT rate field per product (23%, 8%, 5%, 0%, exempt)
- Variant-level VAT override capability
- Tax code classification
- Excise tax flag for applicable products
- Historical VAT rate tracking (rates change over time)

**Polish VAT Rates (2025):**

- 23% - Standard rate (most goods)
- 8% - Reduced rate (construction services, books, restaurants)
- 5% - Super-reduced rate (basic food, pharma)
- 0% - Zero rate (exports, intra-EU supplies)
- Exempt - No VAT (financial services, insurance, education)

#### 1.3 **Customs & Cross-Border** (INCOMPLETE)

**Legal Requirement:** Products sold cross-border require HS codes and country of origin.

**Current State:** ⚠️ Fields exist but not enforced or validated
**Impact:** Customs delays, incorrect duty calculations

**Required:**

- Mandatory HS code (Harmonized System) for cross-border products
- Country of origin (ISO 3166-1 alpha-2 code)
- HS code validation (6-digit minimum, up to 10 digits)
- Material composition for textiles (EU Regulation 1007/2011)

#### 1.4 **CE Marking & Product Safety** (MISSING)

**Legal Requirement:** Many product categories require CE marking and declarations of conformity.

**Current State:** ❌ No compliance tracking
**Impact:** Cannot legally sell CE-regulated products (toys, electronics, machinery, etc.)

**Required:**

- CE applicability flag per product
- CE directive selection (e.g., Toy Safety 2009/48/EC, LVD, EMC)
- Declaration of Conformity (DoC) document storage
- User manual in Polish (mandatory for B2C)
- Warning labels in Polish
- Age restrictions for toys, alcohol, etc.

**Categories Requiring CE:**

- Toys (Directive 2009/48/EC)
- Low Voltage Equipment (LVD 2014/35/EU)
- Electromagnetic Compatibility (EMC 2014/30/EU)
- Machinery (2006/42/EC)
- Personal Protective Equipment (PPE)
- Medical Devices

#### 1.5 **Environmental Compliance** (MISSING)

**Legal Requirement:** WEEE (electronics), batteries, and packaging have specific labeling and EPR obligations.

**Current State:** ❌ No environmental compliance tracking
**Impact:** Cannot legally sell electronics/batteries in Poland without BDO registration

**Required:**

- WEEE flag (Waste Electrical and Electronic Equipment)
- Battery flag (Battery Directive 2006/66/EC)
- WEEE symbol requirement
- Packaging material tracking (for BDO reporting)
- BDO registration number (organization-level)

**Polish BDO System:**

- Mandatory registration for product/packaging producers
- Annual reporting of quantities
- Financial contributions to recycling schemes
- [BDO Portal](https://bdo.mos.gov.pl/)

#### 1.6 **Category-Specific Regulations** (MISSING)

**Food Products (EU 1169/2011 - FIC):**

- ❌ Name of food
- ❌ Ingredients list with allergens highlighted
- ❌ Net quantity
- ❌ Best before / Use by date
- ❌ Storage conditions
- ❌ Operator details (name, address)
- ❌ Nutritional information
- ❌ Country of origin (specific foods)

**Textiles (EU 1007/2011):**

- ❌ Fiber composition (% breakdown)
- ❌ Care instructions (washing symbols)
- ❌ Country of manufacture

**Chemicals/Mixtures (CLP Regulation 1272/2008):**

- ❌ Hazard classifications
- ❌ Pictograms
- ❌ Signal words (Danger/Warning)
- ❌ H-statements (hazard statements)
- ❌ P-statements (precautionary statements)
- ❌ Safety Data Sheet (SDS) storage

**Cosmetics (EU 1223/2009):**

- ❌ Ingredients list (INCI names)
- ❌ Function of product
- ❌ Responsible person details
- ❌ Warnings and precautions
- ❌ Batch number and shelf life

---

### ❌ 2. Marketplace Integration Requirements (CRITICAL FOR SALES)

#### 2.1 **No Integration Layer**

**Current State:** ❌ Zero marketplace connectivity
**Impact:** Cannot sell on Shopify, WooCommerce, or Allegro - major revenue loss

**Required Infrastructure:**

- Marketplace connection management (API credentials, store URLs)
- Product → Platform mapping tables
- Sync status tracking (pending, synced, error)
- Bi-directional inventory sync
- Attribute mapping layer (internal fields → platform fields)
- Error handling and retry logic
- Webhook receivers for platform updates

#### 2.2 **Shopify Integration Requirements**

**Shopify Data Model:**

- **Product** (parent) → **Variant** (SKU level)
- **InventoryItem** (SKU properties: HS code, country of origin)
- **InventoryLevel** (location-level stock quantities)

**Required Mappings:**

```
products.sku → Variant.sku
products.ean → Variant.barcode
products.name → Product.title
products.description → Product.body_html
product_variants → Variant (option1, option2, option3)
products.hs_code → InventoryItem.harmonized_system_code
products.country_of_origin → InventoryItem.country_code_of_origin
stock_snapshots.quantity_on_hand → InventoryLevel.available
```

**API Endpoints Needed:**

- `POST /admin/api/2024-10/products.json` (create product)
- `PUT /admin/api/2024-10/products/{id}.json` (update)
- `POST /admin/api/2024-10/inventory_levels/set.json` (set stock)
- Webhooks: `products/update`, `inventory_levels/update`

**Limitations:**

- Max 3 options per product (Color, Size, Material → pick 3)
- Max 100 variants per product
- Images: max 250 per product

**References:**

- [Shopify Admin API](https://shopify.dev/api/admin-rest)
- [Inventory API](https://shopify.dev/api/admin-rest/2024-10/resources/inventorylevel)

#### 2.3 **WooCommerce Integration Requirements**

**WooCommerce Data Model:**

- **Product** (simple, variable, grouped)
- **Product Variation** (variants of variable products)
- **Attributes** (custom attributes for variations)

**Required Mappings:**

```
products.sku → product.sku
products.ean → product.meta_data._ean
products.name → product.name
products.description → product.description
product_variants → product_variation
products.hs_code → product.meta_data._hs_code (custom)
products.country_of_origin → product.meta_data._country_of_origin
stock_snapshots.quantity_on_hand → product.stock_quantity
```

**API Endpoints Needed:**

- `POST /wp-json/wc/v3/products` (create)
- `PUT /wp-json/wc/v3/products/{id}` (update)
- `POST /wp-json/wc/v3/products/{id}/variations` (create variant)
- Webhooks: `product.updated`, `product.deleted`

**Custom Fields:**

- HS code, Country of Origin → via `meta_data`
- Use plugins like "WooCommerce Custom Fields" or custom development

**References:**

- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)

#### 2.4 **Allegro Integration Requirements**

**Allegro Data Model:**

- **Offer** (auction/buy-now listing)
- **Category** (category ID with required parameters)
- **Parameters** (category-specific attributes)

**Required Mappings:**

```
products.sku → offer.external.id
products.ean → offer.product.parameters[id=GTIN]
products.name → offer.name
products.description → offer.description.sections[0].items[0].content
products.brand → offer.product.parameters[id=brand]
products.mpn → offer.product.parameters[id=manufacturer_code]
stock_snapshots.quantity_on_hand → offer.stock.available
```

**Category Parameters (Examples):**

- GTIN (EAN/UPC) - Required for many categories
- Brand - Required
- Manufacturer code (MPN) - Recommended
- Model - Category-specific
- Color, Size - Category-specific

**API Endpoints Needed:**

- `POST /sale/offers` (create offer)
- `PUT /sale/offers/{id}` (update)
- `PUT /sale/offer-quantity/{id}` (update stock)
- OAuth 2.0 authentication

**Allegro-Specific Requirements:**

- Category selection with required parameter validation
- High-quality images (min 600x600, max 8MB)
- Polish language mandatory for Polish market
- Delivery time specification
- Return policy

**References:**

- [Allegro REST API](https://developer.allegro.pl/documentation/)
- [Category parameters API](https://developer.allegro.pl/tutorials/jak-zarzadzac-parametrami-oferty-6dXE4Oga8om)

---

### ❌ 3. Advanced Inventory Features (PARTIAL)

#### 3.1 **Lot/Batch Tracking** (MISSING)

**Use Cases:**

- Food products (batch recall capability)
- Pharmaceuticals (expiry tracking)
- Cosmetics (batch codes for quality issues)
- Manufacturing (raw material traceability)

**Current State:** ❌ No lot management system
**Impact:** Cannot track product recalls, expiry dates, or batch-level quality issues

**Required:**

```sql
CREATE TABLE product_lots (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  lot_code TEXT NOT NULL UNIQUE,
  manufacture_date DATE,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id),
  received_quantity NUMERIC,
  remaining_quantity NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'active', -- active, recalled, expired
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features Needed:**

- Lot code assignment on product receipt
- Lot selection during stock movements
- Expiry date alerts (30, 15, 7 days before expiry)
- FEFO (First Expired, First Out) picking strategy
- Recall management (quarantine specific lots)

#### 3.2 **Serial Number Tracking** (MISSING)

**Use Cases:**

- Electronics (warranty tracking)
- Appliances (RMA management)
- High-value items (theft prevention)
- Equipment (maintenance scheduling)

**Current State:** ❌ No serial tracking
**Impact:** Cannot track individual item warranties, returns, or location

**Required:**

```sql
CREATE TABLE product_serials (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  serial_number TEXT NOT NULL UNIQUE,
  lot_id UUID REFERENCES product_lots(id),
  status TEXT DEFAULT 'in_stock', -- in_stock, sold, returned, defective, repaired
  location_id UUID REFERENCES locations(id),
  sold_at TIMESTAMPTZ,
  sold_to_customer_id UUID REFERENCES customers(id),
  warranty_expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features Needed:**

- Serial number entry on receipt
- Serial selection during sales
- Serial number history (location movements, ownership)
- Warranty expiration tracking
- RMA/return processing by serial

#### 3.3 **Cost Accounting (FIFO/Average)** (MISSING)

**Business Need:** Accurate COGS (Cost of Goods Sold) for financial reporting

**Current State:** ❌ No cost layers, no COGS calculation
**Impact:** Cannot calculate profit margins, inventory valuation for accounting

**Required:**

```sql
CREATE TABLE product_cost_layers (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  location_id UUID REFERENCES locations(id),
  lot_id UUID REFERENCES product_lots(id),

  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  remaining_quantity NUMERIC NOT NULL,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  remaining_value NUMERIC GENERATED ALWAYS AS (remaining_quantity * unit_cost) STORED,

  received_at TIMESTAMPTZ NOT NULL,
  stock_movement_id UUID REFERENCES stock_movements(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features Needed:**

- **FIFO (First In, First Out):**
  - Create cost layer on each receipt
  - Consume oldest layers first on sales
  - Track remaining quantity per layer

- **Average Cost:**
  - Recalculate average cost on each receipt
  - Use average cost for all sales
  - Update average cost in `stock_snapshots.average_cost`

- **Standard Cost:**
  - Use fixed cost per product
  - Variance tracking (actual vs. standard)

- **Reports:**
  - Inventory valuation by cost method
  - COGS by period, product, category
  - Cost variance reports

#### 3.4 **UoM (Unit of Measure) Conversions** (MISSING)

**Use Cases:**

- Buy in boxes, sell in pieces
- Purchase in kilograms, sell in grams
- Import in pallets, store in cases

**Current State:** ⚠️ Basic `units_of_measure` table exists, no conversions
**Impact:** Manual conversion errors, inefficient inventory management

**Required:**

```sql
CREATE TABLE uom_conversions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  from_uom_id UUID REFERENCES units_of_measure(id),
  to_uom_id UUID REFERENCES units_of_measure(id),
  conversion_factor NUMERIC NOT NULL, -- from * factor = to
  is_bidirectional BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, from_uom_id, to_uom_id)
);

-- Add to products table
ALTER TABLE products
  ADD COLUMN purchase_uom_id UUID REFERENCES units_of_measure(id),
  ADD COLUMN sales_uom_id UUID REFERENCES units_of_measure(id),
  ADD COLUMN stock_uom_id UUID REFERENCES units_of_measure(id);
```

**Features Needed:**

- Conversion rule management UI
- Automatic quantity conversion on purchase orders
- Automatic quantity conversion on sales orders
- Display multiple UoMs in stock reports (e.g., "120 pieces (10 boxes)")

**Example Conversions:**

- 1 box = 12 pieces
- 1 kilogram = 1000 grams
- 1 pallet = 40 boxes = 480 pieces

#### 3.5 **Warehouse/Bin Hierarchy** (INCOMPLETE)

**Use Cases:**

- Large warehouses with zones, aisles, shelves
- Multi-warehouse organizations
- Efficient picking (know exact bin location)

**Current State:** ⚠️ `locations` table exists but flat structure
**Impact:** Inefficient picking, no putaway rules, no bin capacity management

**Required:**

- Hierarchical location structure:
  - **Warehouse** → **Zone** → **Aisle** → **Shelf** → **Bin**
- Location attributes:
  - Type (warehouse, zone, aisle, shelf, bin, virtual)
  - Capacity (weight, volume, pallet count)
  - Restrictions (refrigerated, hazmat, secure)
- Putaway rules:
  - "Put new electronics in Zone A, Aisle 3"
  - "Fill nearest empty bin first"
- Picking strategies:
  - FIFO (oldest stock first)
  - FEFO (earliest expiry first)
  - Nearest location (minimize travel)

#### 3.6 **Reorder Automation** (INCOMPLETE)

**Current State:** ⚠️ `reorder_point` field exists, no automation
**Impact:** Manual monitoring, frequent stockouts or overstocking

**Required:**

- **Automated Reorder Suggestions:**
  - Check stock levels daily
  - Compare against `reorder_point`
  - Calculate suggested order quantity (Economic Order Quantity formula)
  - Generate draft purchase orders

- **Demand Forecasting:**
  - Historical sales analysis (last 30, 60, 90 days)
  - Seasonal adjustments
  - Trend detection (growing/declining demand)
  - Lead time consideration

- **Notifications:**
  - Email alerts for low stock
  - Dashboard widget showing items to reorder
  - Push notifications (if applicable)

---

### ❌ 4. Variant Management (INCOMPLETE)

#### 4.1 **Variant Generation Wizard** (MISSING)

**Current State:** ❌ Manual variant creation only
**Impact:** Creating 100+ variants (e.g., 5 colors × 4 sizes × 5 materials = 100 variants) is tedious and error-prone

**Required UI:**

1. **Step 1: Select Option Groups**
   - Checkboxes: [✓] Color, [✓] Size, [ ] Material

2. **Step 2: Select Values**
   - Color: [✓] Red, [✓] Blue, [✓] Green, [✓] Yellow, [✓] Black
   - Size: [✓] Small, [✓] Medium, [✓] Large, [✓] XL

3. **Step 3: Preview Combinations**
   - 20 variants will be created (5 colors × 4 sizes)
   - Show preview table with all combinations

4. **Step 4: Bulk Edit**
   - Editable table:
     - Name (auto-generated: "Red - Small")
     - SKU (auto-generated or manual: "TSHIRT-RED-S")
     - Price (inherit or override)
     - Cost (inherit or override)
     - Stock (set initial stock)
     - Active (yes/no)

5. **Step 5: Confirm & Create**
   - Batch insert all variants
   - Link to variant option values

**SKU Auto-Generation Patterns:**

- Template: `{product_sku}-{color_code}-{size_code}`
- Example: `TSHIRT-RED-S`, `TSHIRT-BLU-M`
- Code mapping: Red→RED, Blue→BLU, Small→S, Medium→M

#### 4.2 **Bulk Variant Operations** (MISSING)

**Current State:** ❌ Individual variant editing only
**Impact:** Slow to apply price changes, activate/deactivate variants, sync to marketplaces

**Required Features:**

- **Bulk Select:** Checkbox column in variant table
- **Bulk Actions Menu:**
  - Update Price (add % or fixed amount)
  - Update Cost
  - Set Reorder Point
  - Activate/Deactivate
  - Push to Marketplace (Shopify/WooCommerce/Allegro)
  - Export to CSV
  - Delete (soft delete)

- **Inline Editing:** Edit cells directly in table
- **CSV Import/Export:**
  - Export variants to CSV for Excel editing
  - Import CSV to bulk update (match by SKU)

#### 4.3 **Variant-Specific Attributes** (INCOMPLETE)

**Current State:** ⚠️ Images table supports variant_id, but no UI
**Impact:** Cannot show variant-specific images (e.g., red shirt photo for red variant)

**Required:**

- **Variant Images:**
  - Assign images to specific variants
  - Show variant image in product page when option selected
  - Default to parent product images if no variant image

- **Variant Compliance:**
  - Per-variant HS codes (some colors may have different tariffs)
  - Per-variant GTIN/EAN
  - Per-variant country of origin (if sourced differently)

- **Variant Attributes:**
  - Custom attributes per variant (e.g., "Sleeve Length: Long")
  - Override parent product attributes

---

### ❌ 5. Media Management (BASIC)

#### 5.1 **Image Upload** (MISSING)

**Current State:** ❌ `product_images` table exists, no upload UI
**Impact:** Cannot add product images for e-commerce

**Required:**

- **Supabase Storage Integration:**
  - Create `product-images` bucket
  - RLS policies (org-scoped access)
  - Public URLs for images

- **Upload UI:**
  - Drag-and-drop file upload
  - Multi-file selection
  - Image preview before upload
  - Progress indicators

- **Image Processing:**
  - Client-side resize (max 2048px)
  - Thumbnail generation (200x200, 500x500)
  - WebP conversion (optional, for performance)
  - Alt text input (SEO)

#### 5.2 **Image Management** (MISSING)

**Current State:** ❌ No image management UI
**Impact:** Cannot organize, reorder, or assign images to variants

**Required:**

- **Image Gallery View:**
  - Grid view of all product images
  - Primary image badge
  - Drag-to-reorder
  - Delete with confirmation

- **Variant Image Assignment:**
  - Dropdown to assign image to specific variant
  - "Apply to all" option for parent product

- **Image Metadata:**
  - Alt text editor (for SEO and accessibility)
  - Image tags (for organization)
  - File size and dimensions display

#### 5.3 **CDN & Performance** (MISSING)

**Current State:** ❌ No CDN integration
**Impact:** Slow image loading, poor e-commerce performance

**Required:**

- Supabase Storage provides CDN automatically
- Lazy loading for image grids
- Responsive images (different sizes for mobile/desktop)
- Image optimization (compression, format selection)

---

## Implementation Roadmap

### Phase 1: Polish/EU Compliance Foundation (2-3 weeks)

**Goal:** Achieve basic legal compliance for Polish market launch

#### Week 1: Database Schema & Price History

**Tasks:**

1. Create `product_price_history` table
2. Create `product_compliance_profiles` table
3. Add VAT fields to `products` and `product_variants`
4. Create trigger for automatic price logging
5. Create function to calculate `lowest_price_30d`
6. Create indexes for performance

**Deliverables:**

- Migration file: `20250120000000_compliance_foundation.sql`
- Price history automatically captured on price changes
- Omnibus calculation function tested

#### Week 2: Compliance UI

**Tasks:**

1. Add "Compliance" tab to product creation/edit dialog
2. VAT rate selector (dropdown: 23%, 8%, 5%, 0%, Exempt)
3. Tax code input field
4. HS code input with validation (6-10 digits)
5. Country of origin dropdown (ISO 3166-1 alpha-2 codes)
6. CE marking section:
   - "Is CE applicable?" checkbox
   - Directive multi-select (Toys, LVD, EMC, etc.)
   - File upload for Declaration of Conformity
   - File upload for User Manual (Polish)
7. Environmental section:
   - WEEE checkbox
   - Battery checkbox
   - Packaging materials input (JSON editor or form)
8. Category-specific sections (show/hide based on flags):
   - Food: allergens, ingredients, nutritional info
   - Textile: fiber composition, care instructions
   - Chemical: CLP classifications, SDS upload
   - Cosmetic: INCI ingredients, warnings

**Deliverables:**

- `ComplianceTab.tsx` component
- File upload to Supabase Storage (`compliance-documents` bucket)
- Form validation for required fields
- Omnibus lowest price badge in product display

#### Week 3: Compliance Reports & Validation

**Tasks:**

1. Compliance audit report:
   - Products missing HS codes
   - Products missing country of origin
   - Products missing DoC (where CE applicable)
   - Products with prices but no price history
2. Bulk compliance update tool
3. Export compliance data for customs/authorities
4. Admin dashboard widget: Compliance score (% compliant)

**Deliverables:**

- `ComplianceReport.tsx` page
- CSV export of compliance data
- Dashboard compliance widget

---

### Phase 2: Marketplace Integration Layer (3-4 weeks)

**Goal:** Enable product syncing to Shopify, WooCommerce, Allegro

#### Week 4: Integration Infrastructure

**Tasks:**

1. Create tables:
   - `marketplace_connections`
   - `product_marketplace_mappings`
   - `marketplace_sync_logs`
2. Create services:
   - `MarketplaceConnectionService` (CRUD for connections)
   - `MarketplaceBaseAdapter` (abstract class)
3. Credential encryption:
   - Use Supabase Vault or encrypt at app level
4. Connection management UI:
   - List connections
   - Add/edit/delete connection
   - Test connection button
   - Last sync status display

**Deliverables:**

- Migration: `20250125000000_marketplace_integration.sql`
- `MarketplaceConnectionService.ts`
- `MarketplaceConnectionsPage.tsx`

#### Week 5-6: Shopify Integration

**Tasks:**

1. Create `ShopifyAdapter extends MarketplaceBaseAdapter`
2. Implement methods:
   - `authenticate()` - API key validation
   - `createProduct()` - POST to Shopify API
   - `updateProduct()` - PUT to Shopify API
   - `syncInventory()` - Update InventoryLevel
   - `getProduct()` - Fetch product by ID
   - `handleWebhook()` - Process Shopify webhooks
3. Mapping UI:
   - "Push to Shopify" button in product detail
   - Mapping form:
     - Product title
     - Product type
     - Tags
     - Collections
     - Variant options (limit to 3)
     - HS code → InventoryItem
     - Country of origin → InventoryItem
   - Sync status indicator
4. Webhook receiver:
   - `/api/webhooks/shopify` endpoint
   - Signature verification
   - Handle `products/update`, `inventory_levels/update`
5. Error handling:
   - Retry logic (exponential backoff)
   - Error display in UI
   - Sync log storage

**Deliverables:**

- `ShopifyAdapter.ts`
- `PushToShopifyDialog.tsx`
- Webhook API route
- Documentation: "Shopify Integration Guide"

#### Week 7: WooCommerce & Allegro (Parallel Development)

**WooCommerce Tasks:**

1. `WooCommerceAdapter.ts`
2. OAuth authentication (if using WooCommerce.com) or API key
3. Product/variation creation
4. Custom meta fields for HS code, COO
5. Image sync
6. Inventory sync

**Allegro Tasks:**

1. `AllegroAdapter.ts`
2. OAuth 2.0 flow (authorization code grant)
3. Category selection UI (fetch categories via API)
4. Required parameter validation per category
5. Offer creation with images
6. Stock quantity updates

**Deliverables:**

- `WooCommerceAdapter.ts`
- `AllegroAdapter.ts`
- OAuth flows
- Platform-specific mapping UIs

#### Week 8: Bi-Directional Sync & Monitoring

**Tasks:**

1. Scheduled sync job:
   - Every hour: push inventory updates
   - Daily: full product sync (detect external changes)
2. Conflict resolution:
   - Last-write-wins (default)
   - Manual review queue (optional)
3. Sync dashboard:
   - Table of all mapped products
   - Sync status per platform
   - Last synced timestamp
   - Error count
   - Retry button
4. Notifications:
   - Email on sync errors
   - Dashboard alert badge

**Deliverables:**

- Scheduled job (Supabase Edge Function or cron)
- `MarketplaceSyncDashboard.tsx`
- Email notification templates

---

### Phase 3: Advanced Inventory Features (2-3 weeks)

**Goal:** Match Zoho/inFlow/Odoo inventory capabilities

#### Week 9: Lot & Serial Tracking

**Tasks:**

1. Create tables:
   - `product_lots`
   - `product_serials`
2. Add flags to products:
   - `track_lots BOOLEAN`
   - `track_serials BOOLEAN`
   - `expiry_tracking BOOLEAN`
3. Update `stock_movements` to reference `lot_id` and `serial_id`
4. Lot management UI:
   - Create lot (on product receipt)
   - List lots per product
   - Lot details (manufacture date, expiry, quantity)
   - Quarantine lot (status: recalled)
5. Serial management UI:
   - Register serials (on receipt)
   - Serial selection (on sale)
   - Serial history (movements, ownership)
   - Warranty tracking
6. Expiry alerts:
   - Dashboard widget: Expiring products (30, 15, 7 days)
   - Email notifications
7. FEFO picking strategy:
   - Auto-select lot with earliest expiry date

**Deliverables:**

- Migration: `20250201000000_lot_serial_tracking.sql`
- `LotManagementPage.tsx`
- `SerialManagementPage.tsx`
- `ExpiryAlertWidget.tsx`

#### Week 10: Cost Accounting (FIFO/Average)

**Tasks:**

1. Create `product_cost_layers` table
2. Add `cost_method` to products (FIFO, Average, Standard)
3. Implement FIFO logic:
   - Create cost layer on receipt
   - Consume oldest layers first on sale
   - Calculate COGS
4. Implement Average Cost logic:
   - Recalculate average on receipt
   - Use average for all sales
5. Add `average_cost` and `total_value` to `stock_snapshots`
6. Cost reports:
   - Inventory valuation by product/location
   - COGS by period
   - Cost variance (actual vs. standard)

**Deliverables:**

- Migration: `20250203000000_cost_accounting.sql`
- `CostAccountingService.ts`
- `InventoryValuationReport.tsx`
- `COGSReport.tsx`

#### Week 11: UoM Conversions & Warehouse Hierarchy

**UoM Tasks:**

1. Create `uom_conversions` table
2. Add purchase/sales/stock UoM fields to products
3. Conversion rule management UI
4. Auto-convert quantities in POs, SOs, transfers
5. Display conversions in stock reports

**Warehouse Tasks:**

1. Add hierarchy to `locations`:
   - `parent_location_id`
   - `location_type` (warehouse, zone, aisle, shelf, bin)
   - `capacity_weight`, `capacity_volume`
   - `restrictions` JSONB
2. Location hierarchy tree view
3. Putaway rules:
   - Default location per product category
   - Fill strategy (nearest, FIFO, FEFO)
4. Bin capacity warnings

**Deliverables:**

- Migration: `20250205000000_uom_and_warehouse.sql`
- `UoMConversionsPage.tsx`
- `LocationHierarchyTree.tsx`
- `PutawayRulesPage.tsx`

---

### Phase 4: Variant System Enhancements (1-2 weeks)

**Goal:** Make variant creation as easy as Shopify

#### Week 12: Variant Generation Wizard

**Tasks:**

1. Multi-step wizard component:
   - Step 1: Select option groups
   - Step 2: Select values per group
   - Step 3: Preview combinations (count)
   - Step 4: Bulk edit table (inline editing)
   - Step 5: Confirm & create
2. SKU auto-generation:
   - Pattern editor (use placeholders like `{product_sku}-{color}-{size}`)
   - Code mapping (Color: Red→RD, Blue→BL)
3. Bulk operations:
   - Price multiplication (increase all by 10%)
   - Activate/deactivate selected
   - Export/import CSV
4. Variant image assignment:
   - Drag image onto variant row
   - "Apply to variants with Color=Red"

**Deliverables:**

- `VariantGeneratorWizard.tsx` (multi-step form)
- `BulkVariantEditor.tsx` (editable table)
- `VariantImageAssignment.tsx`
- SKU pattern configuration in organization settings

---

### Phase 5: Media Management (1 week)

**Goal:** Professional product images for e-commerce

#### Week 13: Image Upload & Management

**Tasks:**

1. Create Supabase Storage bucket: `product-images`
2. RLS policies (org-scoped)
3. Upload UI:
   - Drag-and-drop zone
   - Multi-file selection
   - Client-side resize (Canvas API or library)
   - Thumbnail generation
   - Upload progress bar
4. Image gallery:
   - Grid view with thumbnails
   - Primary image badge
   - Drag-to-reorder
   - Delete confirmation
5. Alt text editor (SEO)
6. Variant image assignment dropdown

**Deliverables:**

- `ProductImageUploader.tsx`
- `ProductImageGallery.tsx`
- Supabase Storage bucket with policies
- Image optimization utilities

---

### Phase 6: Reports & Analytics (1 week)

**Goal:** Business intelligence for inventory decisions

#### Week 14: Report Suite

**Tasks:**

1. Stock valuation report:
   - Total inventory value by cost method
   - By product, category, location
   - Trend over time (chart)
2. Inventory aging report:
   - Slow-moving items (no sales in X days)
   - Stock turnover ratio
3. Expiry report:
   - Items expiring in next 30/60/90 days
   - Quantity, value at risk
4. Reorder report:
   - Items below reorder point
   - Suggested order quantities
   - Supplier information
5. Movement history report:
   - All movements by date range, product, location
   - Filter by movement type
6. Marketplace sync report:
   - Products synced/not synced per platform
   - Errors and warnings
   - Last sync timestamps
7. Compliance audit report:
   - Products missing HS codes, DoC, etc.
   - Compliance score by category

**Deliverables:**

- `ReportsPage.tsx` with sub-tabs
- Chart components (using recharts or similar)
- CSV export for all reports
- Scheduled email reports (optional)

---

## Technical Architecture

### Database Layer

#### New Tables Summary

```sql
-- Phase 1: Compliance
product_price_history (price tracking for Omnibus)
product_compliance_profiles (VAT, HS codes, CE, WEEE, etc.)

-- Phase 2: Marketplaces
marketplace_connections (API credentials per platform)
product_marketplace_mappings (product ↔ platform links)
marketplace_sync_logs (sync history and errors)

-- Phase 3: Advanced Inventory
product_lots (batch tracking)
product_serials (individual item tracking)
product_cost_layers (FIFO cost accounting)
uom_conversions (unit conversions)

-- Updated: locations (add hierarchy fields)
ALTER TABLE locations ADD parent_location_id, location_type, capacity_*;
```

#### Indexes for Performance

```sql
-- Price history
CREATE INDEX idx_price_history_product_date ON product_price_history(product_id, valid_from DESC);
CREATE INDEX idx_price_history_variant_date ON product_price_history(variant_id, valid_from DESC);

-- Marketplace mappings
CREATE INDEX idx_marketplace_mappings_product ON product_marketplace_mappings(product_id);
CREATE INDEX idx_marketplace_mappings_connection ON product_marketplace_mappings(marketplace_connection_id);
CREATE INDEX idx_marketplace_mappings_external_id ON product_marketplace_mappings(external_product_id, external_variant_id);

-- Lots
CREATE INDEX idx_lots_variant_expiry ON product_lots(variant_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_lots_status ON product_lots(status);

-- Serials
CREATE INDEX idx_serials_serial_number ON product_serials(serial_number);
CREATE INDEX idx_serials_status_location ON product_serials(status, location_id);

-- Cost layers
CREATE INDEX idx_cost_layers_variant_location ON product_cost_layers(variant_id, location_id, received_at);
```

#### Views for Common Queries

```sql
-- Available stock with cost
CREATE VIEW v_stock_with_cost AS
SELECT
  ss.*,
  pc.average_cost,
  (ss.quantity_available * COALESCE(pc.average_cost, p.cost_price, 0)) AS available_value
FROM stock_snapshots ss
JOIN products p ON ss.product_id = p.id
LEFT JOIN product_cost_layers pc ON pc.variant_id = ss.variant_id AND pc.remaining_quantity > 0;

-- Compliance checklist
CREATE VIEW v_compliance_checklist AS
SELECT
  p.id,
  p.name,
  p.sku,
  pcp.vat_rate IS NOT NULL AS has_vat,
  pcp.hs_code IS NOT NULL AS has_hs_code,
  pcp.country_of_origin_iso2 IS NOT NULL AS has_origin,
  (pcp.is_ce_applicable = false OR pcp.declaration_of_conformity_url IS NOT NULL) AS has_ce_doc,
  CASE
    WHEN pcp.vat_rate IS NOT NULL AND
         (pcp.hs_code IS NOT NULL OR NOT p.track_inventory) AND
         (pcp.is_ce_applicable = false OR pcp.declaration_of_conformity_url IS NOT NULL)
    THEN true ELSE false
  END AS is_compliant
FROM products p
LEFT JOIN product_compliance_profiles pcp ON pcp.product_id = p.id
WHERE p.deleted_at IS NULL;
```

### Service Layer

#### Core Services

```typescript
// Compliance
class ComplianceService {
  async getComplianceProfile(productId: string): Promise<ComplianceProfile>;
  async updateComplianceProfile(data: ComplianceProfileUpdate): Promise<void>;
  async validateHSCode(code: string): Promise<boolean>;
  async auditCompliance(organizationId: string): Promise<ComplianceReport>;
}

class PriceHistoryService {
  async logPrice(productId: string, price: number): Promise<void>;
  async getLowestPrice30d(productId: string): Promise<number>;
  async getPriceHistory(productId: string, days: number): Promise<PriceHistory[]>;
}

// Marketplaces
abstract class MarketplaceAdapter {
  abstract authenticate(): Promise<boolean>;
  abstract createProduct(product: Product): Promise<string>; // returns external_id
  abstract updateProduct(externalId: string, product: Product): Promise<void>;
  abstract syncInventory(externalId: string, quantity: number): Promise<void>;
  abstract getProduct(externalId: string): Promise<any>;
  abstract handleWebhook(payload: any): Promise<void>;
}

class ShopifyAdapter extends MarketplaceAdapter {
  /* ... */
}
class WooCommerceAdapter extends MarketplaceAdapter {
  /* ... */
}
class AllegroAdapter extends MarketplaceAdapter {
  /* ... */
}

class MarketplaceSyncService {
  async pushProduct(productId: string, connectionId: string): Promise<void>;
  async syncInventory(connectionId: string): Promise<void>;
  async handleWebhook(platform: string, payload: any): Promise<void>;
  async getAdapterForConnection(connectionId: string): Promise<MarketplaceAdapter>;
}

// Inventory
class LotService {
  async createLot(data: CreateLot): Promise<Lot>;
  async getLots(variantId: string): Promise<Lot[]>;
  async getExpiringLots(days: number): Promise<Lot[]>;
  async quarantineLot(lotId: string): Promise<void>;
}

class SerialService {
  async registerSerials(variantId: string, serials: string[]): Promise<void>;
  async getSerialHistory(serialNumber: string): Promise<SerialHistory[]>;
  async markSerialsAsSold(serialNumbers: string[], customerId: string): Promise<void>;
}

class CostAccountingService {
  async createCostLayer(data: CreateCostLayer): Promise<void>;
  async consumeLayers(variantId: string, quantity: number): Promise<number>; // returns COGS
  async calculateAverageCost(variantId: string): Promise<number>;
  async getInventoryValuation(locationId?: string): Promise<ValuationReport>;
}

// UoM
class UoMService {
  async createConversion(fromUoM: string, toUoM: string, factor: number): Promise<void>;
  async convert(quantity: number, fromUoM: string, toUoM: string): Promise<number>;
}

// Variants
class VariantService {
  async generateVariants(config: VariantGenerationConfig): Promise<Variant[]>;
  async bulkUpdateVariants(variantIds: string[], updates: Partial<Variant>): Promise<void>;
  async autoGenerateSKU(productSKU: string, optionValues: string[]): Promise<string>;
}
```

### Background Jobs (Supabase Edge Functions or Cron)

```typescript
// jobs/price-history-snapshot.ts
// Runs daily at midnight
// Snapshot current prices for Omnibus calculation
export async function priceHistorySnapshot() {
  const products = await getActiveProducts();
  for (const product of products) {
    await PriceHistoryService.logPrice(product.id, product.selling_price);
  }
}

// jobs/expiry-alerts.ts
// Runs daily at 8 AM
// Send email alerts for products expiring soon
export async function expiryAlerts() {
  const expiringLots = await LotService.getExpiringLots(30); // 30 days
  const recipients = await getUsersWithPermission("inventory.view");
  await sendEmail(recipients, "expiry-alert", { lots: expiringLots });
}

// jobs/marketplace-sync.ts
// Runs every hour
// Push inventory updates to all connected marketplaces
export async function marketplaceSync() {
  const connections = await getActiveMarketplaceConnections();
  for (const connection of connections) {
    try {
      await MarketplaceSyncService.syncInventory(connection.id);
    } catch (error) {
      await logSyncError(connection.id, error);
    }
  }
}

// jobs/reorder-check.ts
// Runs daily at 9 AM
// Check stock levels and send reorder alerts
export async function reorderCheck() {
  const lowStockProducts = await getProductsBelowReorderPoint();
  const recipients = await getUsersWithPermission("inventory.manage");
  await sendEmail(recipients, "reorder-alert", { products: lowStockProducts });
}
```

### API Routes (Next.js App Router)

```typescript
// app/api/webhooks/shopify/route.ts
export async function POST(request: Request) {
  const signature = request.headers.get("X-Shopify-Hmac-SHA256");
  const payload = await request.json();

  // Verify signature
  if (!verifyShopifySignature(payload, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Handle webhook
  await ShopifyAdapter.handleWebhook(payload);
  return new Response("OK", { status: 200 });
}

// app/api/webhooks/woocommerce/route.ts
export async function POST(request: Request) {
  /* ... */
}

// app/api/webhooks/allegro/route.ts
export async function POST(request: Request) {
  /* ... */
}

// app/api/compliance/validate-hs-code/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const isValid = await ComplianceService.validateHSCode(code);
  return Response.json({ valid: isValid });
}
```

### UI Components

#### New Components Overview

```
src/modules/warehouse/
├── compliance/
│   ├── components/
│   │   ├── ComplianceTab.tsx              (product form tab)
│   │   ├── ComplianceAuditReport.tsx      (report page)
│   │   ├── LowestPriceBadge.tsx           (Omnibus badge)
│   │   └── ComplianceDashboardWidget.tsx
│   └── api/
│       └── compliance-service.ts
│
├── marketplaces/
│   ├── components/
│   │   ├── MarketplaceConnectionsList.tsx
│   │   ├── AddConnectionDialog.tsx
│   │   ├── PushToMarketplaceDialog.tsx    (product → platform)
│   │   ├── MarketplaceSyncDashboard.tsx
│   │   └── AttributeMappingForm.tsx
│   └── api/
│       ├── marketplace-service.ts
│       ├── shopify-adapter.ts
│       ├── woocommerce-adapter.ts
│       └── allegro-adapter.ts
│
├── lots/
│   ├── components/
│   │   ├── LotManagementPage.tsx
│   │   ├── CreateLotDialog.tsx
│   │   ├── LotDetailsDialog.tsx
│   │   └── ExpiryAlertsWidget.tsx
│   └── api/
│       └── lot-service.ts
│
├── serials/
│   ├── components/
│   │   ├── SerialManagementPage.tsx
│   │   ├── RegisterSerialsDialog.tsx
│   │   ├── SerialHistoryDialog.tsx
│   │   └── SerialScannerInput.tsx         (barcode scanner)
│   └── api/
│       └── serial-service.ts
│
├── cost-accounting/
│   ├── components/
│   │   ├── InventoryValuationReport.tsx
│   │   ├── COGSReport.tsx
│   │   └── CostMethodSelector.tsx
│   └── api/
│       └── cost-accounting-service.ts
│
├── variants/
│   ├── components/
│   │   ├── VariantGeneratorWizard.tsx     (multi-step)
│   │   ├── BulkVariantEditor.tsx          (editable table)
│   │   ├── SKUPatternEditor.tsx
│   │   └── VariantImageAssignment.tsx
│   └── api/
│       └── variant-service.ts
│
└── images/
    ├── components/
    │   ├── ProductImageUploader.tsx       (drag-drop)
    │   ├── ProductImageGallery.tsx
    │   └── ImageEditor.tsx                (crop, resize)
    └── api/
        └── image-service.ts
```

### Security Considerations

#### 1. Credential Encryption

```typescript
// Use Supabase Vault for sensitive data
import { createClient } from "@supabase/supabase-js";

async function encryptAPIKey(key: string): Promise<string> {
  const { data, error } = await supabase.rpc("vault.create_secret", {
    secret: key,
    name: `marketplace_key_${Date.now()}`,
  });
  return data.key_id;
}

async function decryptAPIKey(keyId: string): Promise<string> {
  const { data, error } = await supabase.rpc("vault.get_secret", { key_id: keyId });
  return data.secret;
}
```

#### 2. RLS Policies

```sql
-- Product compliance profiles - organization scoped
CREATE POLICY "Users can view compliance for their org products"
  ON product_compliance_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_compliance_profiles.product_id
      AND p.organization_id = auth.jwt() ->> 'organization_id'
    )
  );

-- Marketplace connections - organization scoped
CREATE POLICY "Users can manage their org marketplace connections"
  ON marketplace_connections FOR ALL
  USING (organization_id = auth.jwt() ->> 'organization_id');
```

#### 3. Webhook Signature Verification

```typescript
// Shopify webhook verification
function verifyShopifySignature(payload: any, signature: string): boolean {
  const hmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest("base64");
  return hmac === signature;
}

// WooCommerce webhook verification
function verifyWooCommerceSignature(payload: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", process.env.WOOCOMMERCE_WEBHOOK_SECRET!)
    .update(payload)
    .digest("base64");
  return hash === signature;
}
```

#### 4. Rate Limiting

```typescript
// Implement rate limiting for API calls
import rateLimit from "express-rate-limit";

const marketplaceApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (Shopify limit: 2 req/sec = 120/min)
  message: "Too many API requests, please try again later",
});
```

---

## Success Metrics

### Phase 1: Compliance

- [ ] 100% of products have VAT rates assigned
- [ ] Price history captured for all price changes
- [ ] Omnibus lowest price displayed when showing discounts
- [ ] 90%+ of cross-border products have HS codes and country of origin
- [ ] CE-applicable products have declarations of conformity uploaded
- [ ] Compliance audit report shows >80% compliance rate

### Phase 2: Marketplace Integration

- [ ] Successfully connect to Shopify, WooCommerce, and Allegro
- [ ] Push at least 100 products to each platform
- [ ] Bi-directional inventory sync operational (hourly)
- [ ] Sync error rate <5%
- [ ] Order webhook processing <2 seconds
- [ ] Marketplace sync dashboard shows real-time status

### Phase 3: Advanced Inventory

- [ ] Lot tracking enabled for at least 50 products
- [ ] Serial tracking enabled for at least 20 products
- [ ] FIFO cost accounting calculates accurate COGS
- [ ] UoM conversions reduce manual errors by 90%
- [ ] Warehouse hierarchy improves picking speed by 30%
- [ ] Automated reorder suggestions reduce stockouts by 50%

### Phase 4: Variant Management

- [ ] Variant generator creates 100+ variants in <1 minute
- [ ] Bulk variant operations save 80% of time vs. individual edits
- [ ] SKU auto-generation reduces manual errors to near zero
- [ ] Variant-specific images improve conversion rate by 15%

### Phase 5: Media Management

- [ ] Average 5+ images per product
- [ ] Image upload time <10 seconds per image
- [ ] Alt text present on 90%+ of images (for SEO)
- [ ] Image load time <1 second (CDN + optimization)

### Phase 6: Reports & Analytics

- [ ] Stock valuation report accuracy: 99%+
- [ ] Expiry report prevents waste (reduce expired stock by 50%)
- [ ] Reorder report increases stock availability to 95%+
- [ ] Marketplace sync report used weekly by operations team
- [ ] Compliance audit report used monthly for regulatory review

### Overall Business Impact

- [ ] Launch in Polish market within regulatory compliance
- [ ] Reduce inventory management time by 50%
- [ ] Increase multi-channel sales by 200% (via marketplace integrations)
- [ ] Improve inventory accuracy to 99%+ (via lot/serial tracking)
- [ ] Reduce manual data entry errors by 90%
- [ ] Achieve feature parity with Zoho Inventory / inFlow

---

## Resources & References

### Polish/EU Regulations

#### Omnibus Directive

- **Official EU Directive:** [Directive (EU) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
- **Polish Implementation:** [UOKiK Omnibus Guidance](https://www.uokik.gov.pl/omnibus)
- **Key Requirement:** Display lowest price from last 30 days when showing reduction
- **Penalties:** Up to 10% of annual turnover for non-compliance

#### VAT Rates (Poland)

- **Standard:** 23% (most goods and services)
- **Reduced:** 8% (construction services, books, restaurants)
- **Super-reduced:** 5% (basic food, pharmaceuticals)
- **Zero-rated:** 0% (exports, intra-EU supplies)
- **Exempt:** No VAT (financial services, insurance, education)
- **Source:** [Polish Ministry of Finance](https://www.gov.pl/web/finanse/stawki-vat)

#### CE Marking

- **Official Guide:** [European Commission - CE Marking](https://ec.europa.eu/growth/single-market/ce-marking_en)
- **Key Directives:**
  - Toy Safety: [2009/48/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009L0048)
  - Low Voltage (LVD): [2014/35/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014L0035)
  - EMC: [2014/30/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014L0030)
  - Machinery: [2006/42/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0042)

#### WEEE & Batteries

- **WEEE Directive:** [2012/19/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32012L0019)
- **Battery Directive:** [2006/66/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0066)
- **Polish BDO System:** [https://bdo.mos.gov.pl/](https://bdo.mos.gov.pl/)
- **Registration Required:** Yes, for producers/importers of electronics, batteries, packaging

#### Food Labeling (FIC)

- **Regulation:** [EU 1169/2011](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1169)
- **Requirements:** Name, ingredients, allergens, net quantity, date, storage, operator, nutrition
- **Language:** Polish mandatory for B2C in Poland

#### Textiles

- **Regulation:** [EU 1007/2011](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1007)
- **Requirements:** Fiber composition (%), care instructions, country of manufacture

#### Chemicals (CLP)

- **Regulation:** [CLP 1272/2008](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1272)
- **Requirements:** Hazard classifications, pictograms, signal words, H/P statements, SDS
- **Database:** [ECHA CHEM Database](https://chem.echa.europa.eu/)

#### Customs & HS Codes

- **Harmonized System:** [World Customs Organization](http://www.wcoomd.org/en/topics/nomenclature/overview/what-is-the-harmonized-system.aspx)
- **EU TARIC:** [EU Customs Tariff Database](https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp)
- **Lookup Tool:** [Tariff Number Database](https://www.tariffnumber.com/)

---

### Marketplace Documentation

#### Shopify

- **Admin REST API:** [https://shopify.dev/api/admin-rest](https://shopify.dev/api/admin-rest)
- **Product API:** [https://shopify.dev/api/admin-rest/2024-10/resources/product](https://shopify.dev/api/admin-rest/2024-10/resources/product)
- **Inventory API:** [https://shopify.dev/api/admin-rest/2024-10/resources/inventorylevel](https://shopify.dev/api/admin-rest/2024-10/resources/inventorylevel)
- **Webhooks:** [https://shopify.dev/api/admin-rest/2024-10/resources/webhook](https://shopify.dev/api/admin-rest/2024-10/resources/webhook)
- **Duties & Import Taxes:** [https://help.shopify.com/en/manual/markets/duties-and-import-taxes](https://help.shopify.com/en/manual/markets/duties-and-import-taxes)
- **HS Codes:** [https://help.shopify.com/en/manual/markets/duties-and-import-taxes/hs-codes](https://help.shopify.com/en/manual/markets/duties-and-import-taxes/hs-codes)

#### WooCommerce

- **REST API:** [https://woocommerce.github.io/woocommerce-rest-api-docs/](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- **Product API:** [https://woocommerce.github.io/woocommerce-rest-api-docs/#products](https://woocommerce.github.io/woocommerce-rest-api-docs/#products)
- **Webhooks:** [https://woocommerce.github.io/woocommerce-rest-api-docs/#webhooks](https://woocommerce.github.io/woocommerce-rest-api-docs/#webhooks)
- **Custom Fields:** Use `meta_data` array for HS codes, country of origin

#### Allegro

- **REST API:** [https://developer.allegro.pl/documentation/](https://developer.allegro.pl/documentation/)
- **Offers API:** [https://developer.allegro.pl/documentation/#tag/Offers](https://developer.allegro.pl/documentation/#tag/Offers)
- **Category Parameters:** [https://developer.allegro.pl/tutorials/jak-zarzadzac-parametrami-oferty-6dXE4Oga8om](https://developer.allegro.pl/tutorials/jak-zarzadzac-parametrami-oferty-6dXE4Oga8om)
- **OAuth 2.0:** [https://developer.allegro.pl/auth/](https://developer.allegro.pl/auth/)
- **Image Requirements:** Min 600x600, max 8MB, JPEG/PNG

---

### Inventory Management Best Practices

#### Zoho Inventory

- **Feature Overview:** [https://www.zoho.com/inventory/features/](https://www.zoho.com/inventory/features/)
- **Multi-location Tracking:** [https://www.zoho.com/inventory/multi-warehouse-inventory-management-software.html](https://www.zoho.com/inventory/multi-warehouse-inventory-management-software.html)
- **Batch/Serial Tracking:** [https://www.zoho.com/inventory/help/inventory/serial-number-tracking.html](https://www.zoho.com/inventory/help/inventory/serial-number-tracking.html)
- **Pricing:** ~$29-79/month for small businesses

#### inFlow Inventory

- **Feature Overview:** [https://www.inflowinventory.com/features/](https://www.inflowinventory.com/features/)
- **Location Tracking:** [https://www.inflowinventory.com/blog/multi-location-inventory/](https://www.inflowinventory.com/blog/multi-location-inventory/)
- **Lot Tracking:** [https://www.inflowinventory.com/features/lot-tracking/](https://www.inflowinventory.com/features/lot-tracking/)
- **Pricing:** ~$71-239/month

#### Odoo Inventory

- **Documentation:** [https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory.html](https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory.html)
- **Warehouse Management:** [https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/warehouses_storage/management.html](https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/warehouses_storage/management.html)
- **Lots & Serial Numbers:** [https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/management/lots_serial_numbers.html](https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/management/lots_serial_numbers.html)
- **Inventory Valuation:** [https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_valuation.html](https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_valuation.html)
- **Open Source:** Yes (Community Edition free)

#### Sortly

- **Feature Overview:** [https://www.sortly.com/features/](https://www.sortly.com/features/)
- **Simpler System:** Focus on ease of use, QR codes, mobile-first
- **Pricing:** ~$39-149/month

---

### Technical Tools & Libraries

#### TypeScript Libraries

- **Shopify API:** `@shopify/shopify-api` (official Node.js library)
- **WooCommerce API:** `@woocommerce/woocommerce-rest-api`
- **Allegro API:** Custom implementation (no official JS library)
- **Image Processing:** `sharp` (server-side), `browser-image-compression` (client-side)
- **CSV Export:** `papaparse` or `csv-writer`
- **Barcode Generation:** `jsbarcode` or `react-barcode`

#### Supabase

- **Storage:** [https://supabase.com/docs/guides/storage](https://supabase.com/docs/guides/storage)
- **RLS:** [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)
- **Edge Functions:** [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **Vault (Secrets):** [https://supabase.com/docs/guides/database/vault](https://supabase.com/docs/guides/database/vault)

#### UI Components (shadcn/ui)

- **Dialog:** `npx shadcn@latest add dialog`
- **Tabs:** `npx shadcn@latest add tabs`
- **Select:** `npx shadcn@latest add select`
- **Checkbox:** `npx shadcn@latest add checkbox`
- **Table:** `npx shadcn@latest add table`
- **Upload:** Custom component using `react-dropzone`

---

## Conclusion

This comprehensive plan transforms the product and inventory system into a **world-class, production-ready platform** that:

1. **Complies with Polish/EU regulations** (Omnibus, VAT, CE, WEEE)
2. **Integrates seamlessly** with Shopify, WooCommerce, and Allegro
3. **Matches enterprise features** of Zoho Inventory, inFlow, and Odoo
4. **Provides professional e-commerce capabilities** (images, variants, compliance)
5. **Enables data-driven decisions** (reports, analytics, forecasting)

**Estimated Total Timeline:** 13-14 weeks (3-4 months)
**Estimated Effort:** ~400-500 hours of development
**Team Size:** 2-3 developers (1 backend, 1 frontend, 1 full-stack)

**Next Steps:**

1. Review and approve this plan
2. Prioritize phases based on business needs
3. Allocate development resources
4. Begin Phase 1 (Compliance) immediately to unblock market launch
5. Set up project tracking (e.g., Jira, Linear, GitHub Projects)
6. Schedule weekly progress reviews

**Success Indicators:**

- Phase 1 completion → Legal to sell in Poland
- Phase 2 completion → Multi-channel sales operational
- Phase 3 completion → Feature parity with competitors
- Full implementation → World-class inventory management system

---

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Author:** System Architect
**Status:** Ready for Implementation
