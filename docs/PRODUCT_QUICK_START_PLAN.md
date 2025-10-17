# Product & Variant Quick Start Plan

**Goal:** Get products and product groups (variants) working for immediate internal use
**Timeline:** 1-2 weeks
**Status:** Ready to Implement

---

## 🎯 Quick Start Objective

Get the product system **minimally functional** so you can start using the app in your workplace immediately, then progressively enhance based on business needs.

**Phase 1 (This Plan):** Basic working product + variant system
**Phase 2+:** Add compliance, marketplaces, advanced features (from main plan)

---

## ✅ What Already Exists (Verified)

### Database Tables (Already Created)

- ✅ `products` - Main product table
- ✅ `product_variants` - Variants for item groups
- ✅ `variant_option_groups` - Reusable options (Color, Size, etc.)
- ✅ `variant_option_values` - Values for each group (Red, Blue, Small, Large)
- ✅ `product_group_attributes` - Links products to option groups
- ✅ `variant_attribute_values` - Links variants to their option values
- ✅ `product_barcodes` - Multi-barcode support
- ✅ `product_categories` - Category hierarchy
- ✅ `product_images` - Image references
- ✅ `stock_movements` - Inventory tracking
- ✅ `stock_snapshots` - Current stock levels
- ✅ `locations` - Warehouse locations

### UI Components (Already Created)

- ✅ `CreateProductDialog` - Product form (basic, sales, purchase, inventory, additional tabs)
- ✅ Product list views (cards, list, table)
- ✅ Advanced filters
- ✅ Products service (API client)

---

## ❌ What's Missing (Must Implement)

### Critical for Basic Functionality

#### 1. **Item Group (Variant Product) Creation Flow** (MISSING)

**Current State:** Can only create `goods` and `service` products, not `item_group`

**What's Needed:**

- Add "Item Group" option to product type selector
- When "Item Group" selected → show variant configuration UI
- Variant generation wizard (simplified version)

#### 2. **Variant Generation System** (MISSING)

**Current State:** No way to create variants

**What's Needed:**

- Select option groups (e.g., Color, Size)
- Select values for each group
- Auto-generate variant combinations
- Bulk edit variant properties (SKU, price, stock)

#### 3. **Variant Management UI** (MISSING)

**Current State:** No UI to view/edit variants of a product

**What's Needed:**

- Variants tab in product detail page
- List all variants with key info (name, SKU, price, stock)
- Edit variant dialog
- Activate/deactivate variants

#### 4. **Stock Management per Variant** (PARTIAL)

**Current State:** Stock system exists but no UI for variant-level operations

**What's Needed:**

- Stock movements for variants (not just products)
- Stock display per variant
- Quick stock adjustment dialog

#### 5. **Option Groups Management** (MISSING)

**Current State:** Tables exist, no UI to create/manage option groups

**What's Needed:**

- Manage option groups page (Color, Size, Material, etc.)
- Add/edit/delete option groups
- Manage values within groups (Red, Blue, Green / S, M, L, XL)

---

## 📋 Implementation Checklist (Week 1-2)

### **Day 1-2: Option Groups Management**

_Foundation - must be done first_

#### Tasks:

1. **Create Option Groups Management Page**
   - Location: `/dashboard/warehouse/settings/option-groups`
   - Features:
     - List all option groups (table view)
     - Add new option group (dialog)
     - Edit option group (inline or dialog)
     - Delete option group (soft delete)
     - Reorder option groups (drag-drop or up/down buttons)

2. **Create Option Values Management**
   - Within option group detail/edit view
   - Add/edit/delete values
   - Reorder values
   - Optional: hex color picker for Color option group

**Files to Create:**

```
src/modules/warehouse/settings/
├── option-groups/
│   ├── components/
│   │   ├── OptionGroupsList.tsx           (main page)
│   │   ├── CreateOptionGroupDialog.tsx
│   │   ├── EditOptionGroupDialog.tsx
│   │   ├── OptionValuesList.tsx           (nested in group)
│   │   └── CreateOptionValueDialog.tsx
│   └── page.tsx                            (Next.js route)

src/modules/warehouse/api/
└── option-groups-service.ts                (CRUD operations)
```

**API Functions Needed:**

```typescript
class OptionGroupsService {
  async getOptionGroups(organizationId: string): Promise<VariantOptionGroup[]>;
  async createOptionGroup(data: CreateOptionGroup): Promise<VariantOptionGroup>;
  async updateOptionGroup(id: string, data: UpdateOptionGroup): Promise<void>;
  async deleteOptionGroup(id: string): Promise<void>;

  async getOptionValues(groupId: string): Promise<VariantOptionValue[]>;
  async createOptionValue(groupId: string, value: string): Promise<VariantOptionValue>;
  async updateOptionValue(id: string, value: string): Promise<void>;
  async deleteOptionValue(id: string): Promise<void>;
}
```

**UI Flow:**

1. Navigate to Settings → Option Groups
2. See list: Color (5 values), Size (4 values), Material (3 values)
3. Click "Add Option Group" → Dialog: Name = "Color", Display Order = 1 → Save
4. Click "Color" row → Expand to show values
5. Click "Add Value" → Input: "Red" → Save
6. Repeat for: Blue, Green, Yellow, Black

**Acceptance Criteria:**

- [ ] Can create option group "Color" with values: Red, Blue, Green, Yellow, Black
- [ ] Can create option group "Size" with values: S, M, L, XL
- [ ] Can edit option group names
- [ ] Can reorder option groups
- [ ] Can delete option groups (soft delete, warn if used by products)
- [ ] Can add/edit/delete values within a group

---

### **Day 3-4: Item Group Creation Flow**

#### Tasks:

1. **Modify `CreateProductDialog` to Support Item Groups**
   - Add third card in product type selector:
     ```tsx
     <Card className={field.value === "item_group" ? "border-primary" : ""}>
       <CardContent className="p-4">
         <RadioGroupItem value="item_group" id="item_group" className="sr-only" />
         <label htmlFor="item_group" className="flex cursor-pointer flex-col gap-2">
           <span className="font-semibold">Item Group (with variants)</span>
           <span className="text-sm text-muted-foreground">
             Product with multiple variants (e.g., T-shirt with colors and sizes)
           </span>
         </label>
       </CardContent>
     </Card>
     ```

2. **Conditional UI Based on Product Type**
   - When `product_type === "item_group"`:
     - Hide SKU field (SKU is per variant, not parent)
     - Hide Opening Stock (stock is per variant)
     - Add "Variant Configuration" tab
   - When `product_type !== "item_group"`:
     - Show normal tabs (current behavior)

3. **Create Variant Configuration Tab**
   - Tab name: "Variants"
   - Content:
     - **Step 1: Select Option Groups**
       - Checkboxes for available option groups
       - Example: ☑ Color, ☑ Size, ☐ Material
       - Minimum 1, maximum 3 option groups (Shopify limit)
     - **Step 2: Select Values** (for each selected group)
       - Multi-select checkboxes
       - Color: ☑ Red, ☑ Blue, ☑ Green
       - Size: ☑ S, ☑ M, ☑ L, ☑ XL
     - **Step 3: Preview Combinations**
       - Show count: "12 variants will be created (3 colors × 4 sizes)"
       - Option to proceed to next step or go back

**Files to Modify:**

```
src/modules/warehouse/products/components/
└── create-product-dialog.tsx               (add item_group support)

src/modules/warehouse/products/components/
└── variant-configuration-tab.tsx           (NEW - variant setup)
```

**Acceptance Criteria:**

- [ ] Product type selector shows 3 options: Goods, Service, Item Group
- [ ] Selecting "Item Group" hides SKU and Opening Stock fields
- [ ] "Variants" tab appears when Item Group selected
- [ ] Can select option groups (Color, Size)
- [ ] Can select values within each group
- [ ] Preview shows correct combination count (e.g., 3 × 4 = 12)

---

### **Day 5-6: Variant Generator Wizard**

#### Tasks:

1. **Create Variant Generator Component**
   - Multi-step wizard (4 steps total)
   - Step 1-3: Already in Variant Configuration Tab (above)
   - **Step 4: Bulk Edit Variants** (NEW)

2. **Step 4: Bulk Edit Variants Table**
   - Editable table with columns:
     - Variant Name (auto-generated, e.g., "Red - Small")
     - SKU (manual input or auto-generate)
     - Selling Price (inherit from parent or override)
     - Cost Price (inherit from parent or override)
     - Reorder Point (inherit from parent or override)
     - Initial Stock (quantity)
     - Active (checkbox)
   - Features:
     - Inline editing (edit cells directly)
     - "Apply to All" buttons for price/cost/reorder point
     - SKU auto-generation button (pattern: `{product_sku}-{color}-{size}`)

3. **Variant Creation Logic**
   - On "Save" button:
     1. Create parent product (type = `item_group`, no SKU)
     2. Create entries in `product_group_attributes` (link to option groups)
     3. For each variant combination:
        - Create `product_variants` row (with SKU, prices, etc.)
        - Create `variant_attribute_values` rows (link to option values)
        - If initial stock > 0: create `stock_movements` entry

**Files to Create:**

```
src/modules/warehouse/products/components/
├── variant-generator-wizard.tsx            (orchestrator component)
├── variant-option-selector.tsx             (step 1-2)
├── variant-preview.tsx                     (step 3)
└── variant-bulk-editor.tsx                 (step 4 - editable table)

src/modules/warehouse/api/
└── variant-generation-service.ts           (business logic)
```

**API Functions Needed:**

```typescript
class VariantGenerationService {
  // Generate all combinations from selected options
  generateCombinations(
    optionGroups: Array<{ groupId: string; valueIds: string[] }>
  ): Promise<GeneratedVariantRow[]>;

  // Auto-generate SKU from pattern
  generateSKU(
    productSKU: string,
    optionValues: Array<{ groupName: string; value: string }>
  ): string;

  // Create product with all variants in one transaction
  createItemGroupWithVariants(
    productData: CreateProductFormData,
    variants: GeneratedVariantRow[]
  ): Promise<ProductWithDetails>;
}
```

**SKU Auto-Generation Logic:**

```typescript
// Example pattern: {product_sku}-{color_code}-{size_code}
// Input: Product SKU = "TSHIRT", Color = "Red", Size = "Medium"
// Output: "TSHIRT-RED-M"

// Code mapping (configurable):
const colorCodes = { Red: "RED", Blue: "BLU", Green: "GRN", Yellow: "YEL", Black: "BLK" };
const sizeCodes = { Small: "S", Medium: "M", Large: "L", "X-Large": "XL" };
```

**Example Flow:**

1. User selects Color (Red, Blue) and Size (S, M, L)
2. System generates 6 combinations:
   - Red - Small
   - Red - Medium
   - Red - Large
   - Blue - Small
   - Blue - Medium
   - Blue - Large
3. User clicks "Auto-generate SKUs" → pattern: `TSHIRT-{COLOR}-{SIZE}`
4. Results: TSHIRT-RED-S, TSHIRT-RED-M, TSHIRT-RED-L, TSHIRT-BLU-S, TSHIRT-BLU-M, TSHIRT-BLU-L
5. User edits prices, sets initial stock
6. Click "Create" → Database transaction creates product + 6 variants + stock entries

**Acceptance Criteria:**

- [ ] Variant generator creates all combinations correctly
- [ ] Variant names auto-generated (e.g., "Red - Small")
- [ ] SKUs auto-generated from pattern
- [ ] Can manually edit any field in bulk editor
- [ ] "Apply to All" updates all variants
- [ ] Creating product with variants succeeds
- [ ] Stock movements created for variants with initial stock > 0

---

### **Day 7-8: Product Detail & Variant Management**

#### Tasks:

1. **Create Product Detail Page**
   - Route: `/dashboard/warehouse/products/[id]`
   - Tabs:
     - Overview (basic info, prices, stock summary)
     - Variants (list of variants - only for item groups)
     - Stock (movements, snapshots)
     - Images (placeholder for now)
     - History (audit log)

2. **Variants Tab Implementation**
   - Table showing all variants:
     - Columns: Name, SKU, Price, Cost, Stock (on-hand), Status, Actions
   - Actions per variant:
     - Edit (dialog)
     - Adjust Stock (quick dialog)
     - Activate/Deactivate toggle
     - Delete (soft delete)
   - Bulk actions:
     - Select multiple variants (checkboxes)
     - Bulk activate/deactivate
     - Bulk price update (+10%, -5%, set to $X)

3. **Edit Variant Dialog**
   - Similar to product edit, but variant-specific:
     - Name (read-only, auto-generated)
     - SKU (editable, unique validation)
     - Selling Price (override or inherit)
     - Cost Price (override or inherit)
     - Reorder Point
     - Identifiers: UPC, EAN, ISBN
     - Status: Active/Inactive

4. **Quick Stock Adjustment Dialog**
   - Simple dialog for fast stock changes:
     - Current stock: 25
     - Adjustment: +10 or -5
     - Reason: Dropdown (adjustment_positive, adjustment_negative, damaged, etc.)
     - Notes: Text area
   - Creates `stock_movements` entry

**Files to Create:**

```
src/modules/warehouse/products/[id]/
├── page.tsx                                (product detail page)
├── components/
│   ├── ProductOverviewTab.tsx
│   ├── ProductVariantsTab.tsx              (variants table)
│   ├── ProductStockTab.tsx
│   ├── ProductImagesTab.tsx
│   └── ProductHistoryTab.tsx

src/modules/warehouse/products/components/
├── EditVariantDialog.tsx
└── QuickStockAdjustmentDialog.tsx
```

**API Functions Needed:**

```typescript
class VariantService {
  async getVariants(productId: string): Promise<ProductVariantWithDetails[]>;
  async getVariant(variantId: string): Promise<ProductVariantWithDetails>;
  async updateVariant(variantId: string, data: UpdateVariant): Promise<void>;
  async deleteVariant(variantId: string): Promise<void>;
  async bulkUpdateVariants(variantIds: string[], updates: Partial<ProductVariant>): Promise<void>;

  async adjustStock(variantId: string, data: StockAdjustment): Promise<void>;
  async getStockHistory(variantId: string): Promise<StockMovement[]>;
}
```

**Acceptance Criteria:**

- [ ] Product detail page loads with correct data
- [ ] Variants tab shows all variants of item group
- [ ] Can edit variant (SKU, prices, identifiers)
- [ ] Can adjust stock quickly (+/- with reason)
- [ ] Stock adjustment creates movement and updates snapshot
- [ ] Bulk actions work (activate/deactivate, price update)
- [ ] Deleting variant soft-deletes and updates UI

---

### **Day 9: Product List Enhancements**

#### Tasks:

1. **Show Variant Count in Product List**
   - For item groups, show badge: "12 variants"
   - Quick indicator of how many variants exist

2. **Filter by Product Type**
   - Add filter dropdown: All / Goods / Service / Item Group
   - Filter updates product list

3. **Variant-Aware Stock Display**
   - For goods/service: Show total stock
   - For item groups: Show "View Variants" link or summary (e.g., "150 units across 12 variants")

4. **Quick Actions**
   - Add "Edit" button (opens edit dialog)
   - Add "Duplicate" button (clone product with variants)
   - Add "Delete" button (soft delete with confirmation)

**Files to Modify:**

```
src/modules/warehouse/products/components/
├── simple-product-card.tsx                 (add variant info)
├── simple-product-list.tsx                 (add variant info)
├── simple-product-table.tsx                (add variant info)
└── product-filters.tsx                     (add product type filter)
```

**Acceptance Criteria:**

- [ ] Item groups show variant count badge
- [ ] Can filter by product type
- [ ] Stock display shows appropriate info per type
- [ ] Quick actions work from list view

---

### **Day 10: Testing & Bug Fixes**

#### Test Scenarios:

1. **Option Groups**
   - [ ] Create "Color" with 5 values
   - [ ] Create "Size" with 4 values
   - [ ] Edit option group name
   - [ ] Delete unused option group (success)
   - [ ] Try to delete used option group (warning)

2. **Item Group Creation**
   - [ ] Create item group "T-Shirt Basic"
   - [ ] Select Color (Red, Blue, Green) and Size (S, M, L, XL)
   - [ ] Preview shows 12 variants (3 × 4)
   - [ ] Auto-generate SKUs: TSHIRT-RED-S, etc.
   - [ ] Set price: $19.99 for all
   - [ ] Set initial stock: 10 for each
   - [ ] Create → Success
   - [ ] Verify in database: 1 product + 12 variants + 12 stock movements

3. **Variant Management**
   - [ ] Open "T-Shirt Basic" detail page
   - [ ] Variants tab shows 12 variants
   - [ ] Edit "Red - Small": change price to $17.99 → Save
   - [ ] Adjust stock for "Blue - Large": +20 → Current stock = 30
   - [ ] Deactivate "Green - XL" → Status = Inactive
   - [ ] Bulk select 3 variants → Increase price by 10% → All updated

4. **Stock Movements**
   - [ ] View stock history for "Red - Medium"
   - [ ] See initial stock entry (movement_type: initial)
   - [ ] See adjustment entry (movement_type: adjustment_positive)
   - [ ] Stock snapshot shows correct quantity_on_hand

5. **Product List**
   - [ ] "T-Shirt Basic" shows "12 variants" badge
   - [ ] Filter by "Item Group" → Only shows item groups
   - [ ] Stock display shows "120 units across 12 variants" (10 × 12)

**Bug Fixes:**

- [ ] Fix any UI glitches
- [ ] Fix any validation errors
- [ ] Fix any database constraint violations
- [ ] Fix any stock calculation issues

---

## 🚀 Quick Reference: What You Can Do After Week 1-2

### ✅ Fully Functional:

1. **Manage Option Groups**
   - Create reusable options: Color, Size, Material, Style, etc.
   - Add values: Red/Blue/Green, S/M/L/XL, Cotton/Polyester

2. **Create Simple Products**
   - Type: Goods (physical items without variants)
   - Type: Service (non-physical items)
   - Set SKU, prices, stock, identifiers
   - Track inventory per location

3. **Create Item Groups (Products with Variants)**
   - Select 1-3 option groups
   - Auto-generate all combinations
   - Bulk edit variant properties
   - Set individual SKUs and prices per variant

4. **Manage Variants**
   - View all variants of a product
   - Edit variant details (SKU, prices, identifiers)
   - Quick stock adjustments
   - Activate/deactivate variants
   - Bulk operations

5. **Track Stock**
   - View current stock per variant
   - Stock movement history
   - Adjust stock with reasons (damaged, found, adjustment, etc.)
   - Multi-location support

6. **Organize Products**
   - Categories (hierarchical)
   - Filters (type, category, brand, stock status)
   - Search by name, SKU, description
   - Multiple views (cards, list, table)

---

## 📦 Real-World Example: Creating a Product Line

### Scenario: Clothing Store Adding T-Shirts

#### Step 1: Set Up Option Groups (One-Time)

1. Go to Settings → Option Groups
2. Create "Color" group:
   - Values: Red, Blue, Green, Yellow, Black, White
3. Create "Size" group:
   - Values: XS, S, M, L, XL, XXL
4. Create "Fit" group:
   - Values: Regular, Slim, Relaxed

#### Step 2: Create First Product (Item Group)

1. Products → Create Product
2. Select "Item Group (with variants)"
3. Basic Info:
   - Name: "Premium Cotton T-Shirt"
   - Description: "Comfortable 100% cotton t-shirt"
   - Brand: "House Brand"
   - Category: Clothing → T-Shirts
   - Unit: pcs
4. Sales Info:
   - Selling Price: $24.99 (default for all variants)
5. Purchase Info:
   - Cost Price: $10.00 (default)
6. Inventory:
   - Track Inventory: Yes
   - Reorder Point: 20 (per variant)
7. Variants Tab:
   - Select Option Groups: ☑ Color, ☑ Size
   - Color: ☑ Red, ☑ Blue, ☑ Black
   - Size: ☑ S, ☑ M, ☑ L, ☑ XL
   - Preview: 12 variants (3 colors × 4 sizes)
8. Bulk Edit:
   - Click "Auto-generate SKUs" → Pattern: `TSHIRT-{COLOR}-{SIZE}`
   - Result: TSHIRT-RED-S, TSHIRT-RED-M, ..., TSHIRT-BLK-XL
   - Edit prices (optional): Red variants = $24.99, Black = $29.99 (premium color)
   - Set initial stock: 50 for each variant
9. Create → Done!

**Result:**

- 1 item group product
- 12 variants
- 12 stock entries (50 units each = 600 total units)
- All variants active and ready to sell

#### Step 3: Manage Stock (Daily Operations)

1. Customer buys "Red - Medium" (quantity: 2)
   - System creates stock_movement: -2 (movement_type: sale)
   - Stock snapshot updated: Red-M now has 48 units

2. Receive shipment from supplier (100 units of "Blue - Large")
   - Go to variant detail → Adjust Stock → +100
   - Select reason: Purchase
   - Add supplier reference number
   - Stock snapshot updated: Blue-L now has 150 units

3. Damaged items (5 units of "Black - Small")
   - Go to variant detail → Adjust Stock → -5
   - Select reason: Damaged
   - Add notes: "Water damage in storage"
   - Stock snapshot updated: Black-S now has 45 units

---

## 🔄 What's NOT in This Quick Start (Coming Later)

These will be added progressively based on the main plan:

### Phase 2 Features (After Quick Start)

- ⏳ Polish/EU compliance (VAT, Omnibus, CE marking)
- ⏳ Marketplace integration (Shopify, WooCommerce, Allegro)
- ⏳ Price history tracking
- ⏳ Multi-currency support

### Phase 3 Features

- ⏳ Lot/batch tracking (expiry dates, recalls)
- ⏳ Serial number tracking (warranties, RMA)
- ⏳ FIFO/Average cost accounting
- ⏳ UoM conversions (buy in boxes, sell in pieces)
- ⏳ Warehouse hierarchy (bins, zones, aisles)
- ⏳ Automated reorder suggestions

### Phase 4 Features

- ⏳ Advanced variant generation (conditional logic, SKU templates)
- ⏳ Variant-specific images
- ⏳ CSV import/export for variants
- ⏳ Variant cloning

### Phase 5 Features

- ⏳ Image upload and management
- ⏳ Image optimization (resize, compress, WebP)
- ⏳ Image galleries per variant

### Phase 6 Features

- ⏳ Inventory valuation reports
- ⏳ Stock aging reports
- ⏳ Sales analytics
- ⏳ Forecasting and demand planning

**These are all documented in the main plan and will be implemented based on priority!**

---

## 📊 Success Metrics for Quick Start

After completing this quick start plan, you should be able to:

### Week 1-2 Goals:

- [ ] Create at least 3 option groups (Color, Size, Material)
- [ ] Create at least 10 products (mix of goods and item groups)
- [ ] Generate at least 50 variants across all item groups
- [ ] Perform daily stock operations (sales, receipts, adjustments)
- [ ] View accurate stock levels per variant and location

### Operational Readiness:

- [ ] Can add new products in under 5 minutes (simple products)
- [ ] Can add new products with variants in under 10 minutes
- [ ] Stock adjustments take under 30 seconds
- [ ] Can find any product in under 10 seconds (search/filter)
- [ ] Zero data entry errors (validation catches mistakes)

### User Satisfaction:

- [ ] System is intuitive (no training manual needed)
- [ ] Faster than previous method (spreadsheet/paper/other app)
- [ ] Confident in stock accuracy
- [ ] Ready to expand usage to team members

---

## 🛠️ Technical Implementation Notes

### Database Transactions

When creating item groups with variants, use transactions to ensure atomicity:

```typescript
async function createItemGroupWithVariants(productData, variants) {
  const { data, error } = await supabase.rpc("create_item_group_transaction", {
    product_data: productData,
    variants_data: variants,
  });

  if (error) {
    // Rollback happens automatically
    throw error;
  }

  return data;
}
```

Or use Supabase transactions via multiple statements:

```typescript
const supabase = createClient();

// Start transaction
const { data: product, error: productError } = await supabase
  .from("products")
  .insert({ ...productData, product_type: "item_group" })
  .select()
  .single();

if (productError) throw productError;

// Create variants (batch insert)
const variantInserts = variants.map((v) => ({
  product_id: product.id,
  name: v.name,
  sku: v.sku,
  selling_price: v.selling_price,
  cost_price: v.cost_price,
  // ...
}));

const { data: createdVariants, error: variantsError } = await supabase
  .from("product_variants")
  .insert(variantInserts)
  .select();

if (variantsError) {
  // Manual rollback: delete product
  await supabase.from("products").delete().eq("id", product.id);
  throw variantsError;
}

// Create variant attribute values (link to option values)
// Create initial stock movements if needed
// ...
```

### Performance Considerations

- Use batch inserts for variants (don't loop with individual inserts)
- Index variant_id in stock_movements and stock_snapshots
- Lazy load variants (pagination if > 100 variants)
- Cache option groups (they rarely change)

### Validation Rules

- Product SKU: Unique per organization (for goods/service)
- Variant SKU: Globally unique
- Option group name: Unique per organization
- Option value: Unique within group
- Stock adjustment: Reason required for manual adjustments

---

## 🎬 Next Steps After Quick Start

Once you have the basic product/variant system working:

1. **Use it daily** in your workplace
2. **Gather feedback** from yourself and team
3. **Identify pain points** (what's slow, what's confusing)
4. **Prioritize Phase 2+ features** based on actual needs:
   - Need to sell online? → Implement marketplace integration first
   - Need compliance? → Implement Polish/EU regulations
   - Need better cost tracking? → Implement FIFO/average cost
   - Need to track expiry? → Implement lot tracking

5. **Iterate based on usage** (real-world usage trumps assumptions)

---

## 📞 Support & Troubleshooting

### Common Issues:

**Issue:** Can't create variant - "SKU already exists"
**Solution:** SKUs must be unique. Use auto-generation or check existing SKUs.

**Issue:** Stock snapshot not updating after movement
**Solution:** Ensure triggers are enabled. Run `SELECT refresh_stock_snapshot(org_id, branch_id, location_id, product_id, variant_id);`

**Issue:** Option group can't be deleted - "in use"
**Solution:** Check if any products reference this group in `product_group_attributes`. Deactivate those products first or change their option groups.

**Issue:** Variant count doesn't match expected (e.g., expected 12, got 10)
**Solution:** Check if some value combinations were skipped or failed validation. Review error logs.

---

## ✅ Completion Checklist

Before considering Quick Start "done":

### Functionality:

- [ ] Option groups management works (create, edit, delete)
- [ ] Can create item groups with variants
- [ ] Variant generator creates all combinations correctly
- [ ] Variants display in product detail page
- [ ] Can edit variants (SKU, prices, etc.)
- [ ] Stock adjustments work and update snapshots
- [ ] Product list shows variant info correctly

### Data Integrity:

- [ ] No orphaned variants (every variant has a parent product)
- [ ] Stock snapshots match actual movements
- [ ] SKUs are unique (no duplicates)
- [ ] Soft deletes work (deleted_at set correctly)

### User Experience:

- [ ] UI is responsive (no lag)
- [ ] Forms validate correctly (show helpful errors)
- [ ] Success messages appear after actions
- [ ] Dialogs close after successful submission
- [ ] Loading states show during API calls

### Documentation:

- [ ] Team knows how to create option groups
- [ ] Team knows how to create item groups
- [ ] Team knows how to adjust stock
- [ ] Team knows how to find products (search/filter)

---

**Ready to implement? Start with Day 1-2 (Option Groups Management) and work through sequentially. Each day builds on the previous, so order matters!**

**Questions? Check the main plan (PRODUCT_SYSTEM_ENHANCEMENT_PLAN.md) for detailed context on any feature.**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Dependencies:** Main Enhancement Plan (docs/PRODUCT_SYSTEM_ENHANCEMENT_PLAN.md)
**Status:** Ready for Implementation
