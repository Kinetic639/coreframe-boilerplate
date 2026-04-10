# AI Design Tool Prompt for CoreFrame Demo Application

## Your Task

Create a fully functional, interactive demo application for CoreFrame WMS/VMI system. This is a **working prototype** with realistic mock data - not just wireframes. The demo should showcase the design system and user experience without requiring any database, authentication, or backend services.

**Critical Instructions**:

- Create a working, clickable demo application
- Use realistic mock/dummy data throughout
- NO database connection required
- NO authentication/login required
- All interactions should work client-side with mock data
- Focus on demonstrating the UI/UX, not actual business logic
- Make it feel like a real application with smooth interactions

## Application Context

This is the same CoreFrame WMS/VMI application described in detail in `application-description.md`. Read that document carefully to understand:

- What the application does
- The business domain (warehouse management, inventory, suppliers)
- User workflows and interactions
- Data structures and relationships

---

[INCLUDE COMPLETE CONTENT FROM application-description.md HERE]

---

## Demo Scope

Create a working demo that includes:

### 1. Dashboard Shell (Global Layout)

The complete application shell that wraps all pages:

**Sidebar Navigation** (fully interactive):

- **Top Section**:
  - Application logo/brand: "CoreFrame WMS"
  - Organization selector showing: "Acme Manufacturing Inc." (static, no dropdown needed)
  - Branch selector showing: "Main Warehouse - Chicago" (static, no dropdown needed)

- **Navigation Menu** (clickable, routes to different demo pages):
  - **Home** → Dashboard page
  - **Warehouse** (green accent, expandable group):
    - Products → Products list page
    - Locations (non-functional, show as disabled)
    - Stock Movements (non-functional, show as disabled)
    - Audits (non-functional, show as disabled)
    - Suppliers (non-functional, show as disabled)
  - **Teams** (purple accent, collapsed state)
  - **Organization** (indigo accent, collapsed state)
  - **Support** (collapsed state)

- **Bottom Section**:
  - User avatar with name "John Smith"
  - Role label "Warehouse Manager"
  - Logout button (non-functional, just UI)

- **Interactive Features**:
  - Sidebar toggle button (collapse to icon-only mode)
  - Expandable/collapsible module groups
  - Active state highlighting for current page
  - Smooth transitions between states

**Header Bar** (functional):

- **Left side**: Breadcrumb trail showing current location (e.g., "Home / Dashboard" or "Warehouse / Products")
- **Center**: Global search bar
  - Placeholder: "Search products, locations, suppliers..."
  - On click/focus: Expand search and show mock suggestions dropdown
  - Mock suggestions: Show 5-6 example products when user types
  - Can close/clear search
- **Right side**:
  - Notification bell icon with badge showing "3"
  - Click to open notifications dropdown with 3 mock notifications
  - Language selector showing "EN" (static, no dropdown needed)
  - User avatar with dropdown menu:
    - Profile (non-functional)
    - Settings (non-functional)
    - Logout (non-functional)

**Status Bar** (bottom of viewport):

- **Left**: Connection status indicator (green dot + "Connected")
- **Center**: Active context display: "Acme Manufacturing Inc. / Main Warehouse - Chicago"
- **Right**: Last sync time "Synced 2 minutes ago"
- **Minimized state**: Can collapse to just a thin line with connection indicator

**Responsive Behavior**:

- Desktop: Full layout as described
- Tablet: Collapsible sidebar
- Mobile: Sidebar becomes overlay drawer, header adapts

### 2. Home Dashboard Page

Path: `/` or `/dashboard` or `/home`

**Page Content**:

**Page Header**:

- Welcome message: "Welcome back, John Smith"
- Current date and time (can be static or dynamic)
- Subtitle: "Here's what's happening in your warehouse today"

**Widget Grid** (responsive, 4 columns on desktop → 2 on tablet → 1 on mobile):

**4 Metric Cards** (top row):

1. **Stock Value Card**:
   - Icon: Dollar sign or inventory icon
   - Main number: "$247,850"
   - Label: "Total Stock Value"
   - Trend: "+5.2% from last month" (with green up arrow)
   - Clickable (shows mock detail or just highlight)

2. **Low Stock Items Card**:
   - Icon: Warning icon
   - Main number: "12"
   - Label: "Low Stock Items"
   - Trend: "Requires attention" (with orange indicator)
   - Clickable

3. **Pending Movements Card**:
   - Icon: Transfer/movement icon
   - Main number: "8"
   - Label: "Pending Movements"
   - Trend: "Awaiting approval"
   - Clickable

4. **Active Audits Card**:
   - Icon: Checklist icon
   - Main number: "2"
   - Label: "Active Audits"
   - Trend: "In progress"
   - Clickable

**Recent Activity Feed** (takes 2 columns):

- Card title: "Recent Activity"
- Timeline showing 5-6 recent events:
  - "Receipt from PO-2024-0143 completed - 150 units received" (2 hours ago, by Sarah Johnson)
  - "Transfer from A-12 to B-05 approved" (3 hours ago, by Mike Davis)
  - "Product 'Industrial Bearing 608Z' stock adjusted" (5 hours ago, by John Smith)
  - "New supplier 'Tech Components Ltd' added" (yesterday, by John Smith)
  - "Audit 'Monthly Count - Zone A' started" (yesterday, by Lisa Anderson)
- Each with icon, timestamp, user avatar
- "View All Activity" link at bottom

**Quick Actions Grid** (takes 2 columns):

- Card title: "Quick Actions"
- 8 action buttons with icons in 2x4 grid:
  - "Receive Shipment"
  - "Create Transfer"
  - "Start Audit"
  - "Add Product"
  - "Adjust Stock"
  - "Print Labels"
  - "View Reports"
  - "Manage Suppliers"
- Click each button to show a toast notification "Feature demo - [Action Name]"

**News & Announcements** (takes 2 columns):

- Card title: "News & Announcements"
- 3 announcement items:
  - "System Maintenance Scheduled" (2 days ago) - "System will be unavailable on Sunday..." (Read More)
  - "New Feature: Batch Processing" (5 days ago) - "You can now process multiple movements..." (Read More)
  - "Q4 Inventory Planning" (1 week ago) - "Please review your reorder points before..." (Read More)
- "View All News" link at bottom

**Alerts Panel** (takes 2 columns):

- Card title: "Alerts" with count badge
- 4 critical alerts:
  - Critical (red): "12 products are out of stock" + "View Products" button
  - Warning (orange): "5 movements pending approval for >24 hours" + "Review Now" button
  - Info (blue): "Audit 'Zone B' due tomorrow" + "View Details" button
  - Warning (orange): "Low stock alert: 8 products below reorder point" + "Generate Orders" button
- Each alert has dismiss (X) button

**Interactions**:

- All cards are clickable (show hover state)
- Clicking metric cards, activity items, or alerts shows a toast "Demo: Would navigate to [relevant page]"
- Quick action buttons show toast with action name
- Dismissing alerts removes them with smooth animation

### 3. Products List Page

Path: `/warehouse/products` or `/products`

**Page Content**:

**Page Header**:

- Title: "Products"
- Subtitle: "Manage your product catalog"
- Primary action button: "Create Product" (opens mock create dialog)

**Layout**:

**Left Sidebar - Filters Panel** (collapsible, ~240px wide when expanded):

- **Search box**: "Search products..." (filters mock data in real-time)
- **Categories filter**:
  - Checkbox tree showing mock categories:
    - Bearings (12)
    - Electronics (8)
    - Hand Tools (15)
    - Safety Equipment (6)
    - Fasteners (23)
- **Suppliers filter**:
  - Checkboxes:
    - Industrial Supplies Co. (18)
    - Tech Components Ltd (12)
    - Premier Manufacturing (9)
    - Global Parts Inc (15)
- **Tags filter** (chip selector):
  - Available tags: "High Value", "Fragile", "Bulk", "Fast Moving", "Seasonal"
- **Price Range slider**: $0 - $500 (with two handles)
- **Stock Status checkboxes**:
  - In Stock (45)
  - Low Stock (12)
  - Out of Stock (3)
- **Active Filters** section at top (appears when filters applied):
  - Shows filter chips with X to remove
  - "Clear All Filters" button
- **Collapse button**: Collapses panel to thin strip with filter icon + count badge

**Main Content Area**:

**Toolbar** (above content):

- **Left side**:
  - View mode toggles: Grid (icon), List (icon), Table (icon) - all three functional with active state
  - Sort dropdown: "Sort by: Name" (options: Name, SKU, Price, Stock Level, Created Date)
- **Right side**:
  - Bulk actions dropdown (enabled only when items selected): "Actions" → Export, Delete, Update Status
  - "Create Product" button (primary, green)

**Content Area** - Show all three view modes:

**Grid View** (default):

- 4 columns on desktop, 2 on tablet, 1 on mobile
- **Mock 60 product cards** (generate realistic data):
  - Product image (can use placeholder images with product initial or generic icons)
  - Product name: e.g., "Industrial Bearing 608Z", "Cordless Drill Kit 18V", "Safety Goggles - Clear"
  - SKU: e.g., "BRG-608Z-001", "DRL-18V-KIT", "SGG-CLR-100"
  - Stock level indicator: Visual bar (green/yellow/red) + number (e.g., "145 units")
  - Price: e.g., "$24.99", "$189.50", "$12.75"
  - Quick action menu (three dots) → View Details, Edit, Duplicate, Delete
- Hover effect: Slight elevation, shows edit/view buttons
- Click card: Navigate to product detail page
- Checkbox on hover for bulk selection

**List View**:

- Compact rows with alternating background
- Each row shows: Checkbox, Thumbnail (small), Name, SKU, Category, Stock indicator (bar), Price, Action menu
- Hover highlights entire row
- Click row: Navigate to product detail

**Table View**:

- Full data table with columns:
  - Checkbox (narrow)
  - Image (thumbnail)
  - Name (sortable) ↓
  - SKU (sortable)
  - Category
  - Supplier
  - Stock (sortable, with visual bar)
  - Reorder Point
  - Price (sortable)
  - Status badge (Active/Inactive)
  - Actions (menu icon)
- Column headers clickable for sorting (show arrow indicators)
- Row hover: Highlight background
- Row selection: Check checkbox, apply selected style
- Expandable rows: Click expand icon to show additional details inline (description, barcode, tags)
- Sticky header: Header stays visible when scrolling

**Pagination** (bottom):

- "Showing 1-25 of 60 products"
- Page buttons: [< Previous] [1] [2] [3] [Next >]
- Page 1 is highlighted/active
- Items per page dropdown: "25 per page" (options: 25, 50, 100)

**Mock Data** - Create 60 realistic products across categories:

- Product names like: "Ball Bearing 6203", "Hex Bolt M8x40", "LED Floodlight 50W", "Safety Helmet - Yellow", "Digital Multimeter", "Wire Stripper Tool", etc.
- SKUs following pattern: CATEGORY-IDENTIFIER-NUMBER
- Stock levels varying: some high (500+), some medium (50-200), some low (<20), some zero
- Prices ranging from $5 to $300
- Mix of categories and suppliers
- Some with tags

**Interactions**:

- **Filtering**: Apply filters in real-time, update product count, show only matching products
- **Searching**: Filter products by name/SKU as user types (debounced)
- **Sorting**: Re-order products when sort option changes (with smooth animation)
- **View mode toggle**: Switch between grid/list/table with smooth transition
- **Bulk selection**: Select multiple products (show count in toolbar), enable bulk actions
- **Pagination**: Click page numbers or next/prev to load different page (simulate with showing different subset of mock data)

**States**:

- **Empty state**: When no products exist (can show by clicking "Clear All" when on empty filter)
  - Illustration or large icon
  - "No products yet"
  - "Create your first product to get started"
  - "Create Product" button
- **No results state**: When filters return nothing
  - "No products match your filters"
  - "Try adjusting your filters"
  - "Clear Filters" button
- **Loading state**: Show briefly when changing view mode or applying filters
  - Skeleton screens matching current view mode (show shimmer effect)
- **Bulk selection active**: Toolbar changes to show: "[X] items selected | [Bulk Actions ▼] | [Deselect All]"

**Create Product Dialog** (opens when clicking "Create Product"):

- Modal dialog with form (doesn't need to be fully functional)
- Show tabs: Basic Info, Purchase & Sales, Inventory
- Basic Info tab shows: Name, SKU, Description, Category, Brand fields
- Save button: Shows toast "Demo: Product would be created", closes dialog
- Cancel button: Closes dialog

---

## ALTERNATIVE IMPLEMENTATION: Advanced Table with Inline Detail View

**IMPORTANT**: Instead of (or in addition to) the three separate view modes above, you can implement an advanced table pattern where the product detail opens INLINE within the table. This is the preferred pattern for the production application.

### 3B. Products Advanced Table Page (Alternative to 3)

Path: `/warehouse/products` or `/products`

This is a **single-view implementation** that combines the products list and product detail into one seamless experience. The URL changes to `/products/[id]` when a product is selected, but the detail view appears inline within the table instead of navigating to a separate page.

**Page Structure**:

**Page Header** (always visible):

- Title: "Products"
- Subtitle: "Manage your product catalog"
- Primary action button: "Create Product" (opens dialog)

**Filters Section** (always visible, ABOVE the table):

- Horizontal filter bar with inline filter controls
- **Layout**: Single row with multiple filter inputs side-by-side
- **Filters included**:
  1. **Search input**: Text input with search icon, "Search products..." placeholder
  2. **Category dropdown**: Multi-select dropdown showing categories with counts
  3. **Supplier dropdown**: Multi-select dropdown showing suppliers
  4. **Stock Status dropdown**: Multi-select with options: All, In Stock, Low Stock, Out of Stock
  5. **Price Range**: Two inputs (Min/Max) or slider
  6. **Tags**: Multi-select chip selector
  7. **More Filters** button: Opens additional filters in dropdown/popover
- **Active Filters Display**: Below the filter bar, show selected filters as dismissible chips
- **Clear All** button: Removes all active filters
- **Filter behavior**: Filters apply in real-time as user interacts (with debouncing on text input)

**Products Table** (main content):

**Table Toolbar** (above table):

- **Left side**:
  - Results count: "Showing 25 of 60 products"
  - Sort dropdown: "Sort by: Name" (options: Name, SKU, Stock, Price, Date Added)
- **Right side**:
  - Bulk actions button (only enabled when rows selected)
  - Column visibility toggle (show/hide columns)
  - Export button
  - View settings menu

**Table Structure**:

- Full-width data table with these columns:
  1. **Checkbox** (narrow, ~40px) - For row selection
  2. **Image** (~60px) - Small product thumbnail
  3. **Product Name** (~250px, flexible) - Product name, clickable
  4. **SKU** (~150px) - Product SKU code
  5. **Category** (~150px) - Category name
  6. **Stock** (~120px) - Stock level with visual indicator bar
  7. **Price** (~100px) - Selling price
  8. **Status** (~100px) - Active/Inactive badge
  9. **Actions** (~60px) - Menu icon (three dots)

**Table Row Behavior**:

- **Normal state**: Row shows product summary data
- **Hover state**: Row highlights with subtle background change, shows clickable cursor
- **Click behavior**: Clicking ANYWHERE on the row (except checkbox or action menu) opens the detail panel
- **Selected state**: When row is selected (via checkbox), apply selected styling (usually light blue background)

**Inline Detail Panel** (appears when product is clicked):

**How it works**:

1. User clicks on any product row in the table
2. The URL updates to `/products/[product-id]` (e.g., `/products/BRG-6203ZZ-001`)
3. The clicked row **expands** with smooth animation to reveal detail panel BELOW that row
4. The detail panel spans the full width of the table
5. The table header remains visible and fixed at top
6. The filters remain visible above the table
7. Other product rows remain visible above and below the expanded detail
8. User can scroll the table; the expanded detail scrolls with its parent row

**Detail Panel Layout** (inside expanded row):

**Panel Header** (sticky within panel):

- **Left side**: Product name, SKU, category breadcrumb, status badge
- **Right side**:
  - "Edit" button
  - "Duplicate" button
  - "Delete" button
  - "Close" button (X icon) - Closes the detail panel, navigates back to `/products`
- **Border**: Top border with accent color to separate from table

**Panel Content** (scrollable if tall):

**Two-column layout within the detail panel**:

**Left Column (~40% width)**:

- Product image gallery (main image + thumbnails)
- Quick stats card (stock, value, reorder status)
- Stock by location mini chart
- Tags section

**Right Column (~60% width)**:

- **Tab Navigation**: Overview, Purchase & Sales, Inventory, Suppliers, Stock Movements, Audit History, Custom Fields
- **Tab Content**: Same detailed information as described in Section 4 "Product Detail Page" above
- All tabs function the same way, just rendered within the inline panel instead of separate page

**Closing the Detail Panel**:

- Click the "X" close button in panel header → closes panel, URL returns to `/products`
- Click on a different product row → closes current panel, opens new one, URL updates to new product ID
- Press ESC key → closes panel, URL returns to `/products`
- Click browser back button → closes panel (if URL changed)

**Visual Example Flow**:

```
┌─────────────────────────────────────────────────────────────┐
│ Products                                    [+ Create Product]│
├─────────────────────────────────────────────────────────────┤
│ Filters: [Search...] [Category ▼] [Supplier ▼] [Stock ▼]   │
│ Active: [Category: Bearings ×] [Clear All]                  │
├─────────────────────────────────────────────────────────────┤
│ Showing 25 of 60 products        [Sort: Name ▼] [Export]   │
├──┬──────┬─────────────────┬─────────┬──────────┬───────┬───┤
│☐ │Img  │ Product Name    │ SKU     │ Stock    │ Price │⋮  │
├──┼──────┼─────────────────┼─────────┼──────────┼───────┼───┤
│☐ │ [🔩] │ Ball Bearing... │ BRG-... │ █▓░ 245  │ $18.50│⋮  │ ← Normal row
├──┼──────┼─────────────────┼─────────┼──────────┼───────┼───┤
│☐ │ [🔧] │ Hex Bolt M8x40  │ HEX-... │ █▓░ 1250 │ $2.30 │⋮  │ ← User clicks this row
├──┴──────┴─────────────────┴─────────┴──────────┴───────┴───┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Hex Bolt M8x40 | HEX-M8X40-001 | Fasteners  [X]     │    │ ← Detail panel header
│  ├─────────────────────────────────────────────────────┤    │
│  │ ┌────────────┐  ┌───────────────────────────────┐  │    │
│  │ │  [Image]   │  │  Tabs: Overview | Purchase |  │  │    │
│  │ │            │  │         Inventory | ...       │  │    │
│  │ │ [Thumb] [] │  │  ─────────────────────────    │  │    │
│  │ │            │  │                               │  │    │
│  │ │ Quick Stats│  │  Basic Information            │  │    │
│  │ │ 1250 units │  │  Name: Hex Bolt M8x40        │  │    │
│  │ │ $2,875     │  │  Category: Fasteners          │  │    │
│  │ │            │  │  Description: M8 hex bolt...  │  │    │
│  │ │ Locations  │  │  ...                          │  │    │
│  │ │ Zone A: 800│  │                               │  │    │
│  │ │ Zone B: 450│  │                               │  │    │
│  │ └────────────┘  └───────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
├──┬──────┬─────────────────┬─────────┬──────────┬───────┬───┤
│☐ │ [⚙️] │ Wire Stripper   │ WIR-... │ █░░ 45   │ $15.99│⋮  │ ← Row below continues
├──┼──────┼─────────────────┼─────────┼──────────┼───────┼───┤
```

**Key UX Behaviors**:

1. **Smooth Animation**: When row is clicked, it smoothly expands over ~300ms to reveal the detail panel
2. **Height Management**:
   - Detail panel has max-height (e.g., 600px or 70vh)
   - If content is taller, the panel content becomes scrollable
   - Table header remains sticky at top
   - Expanded row can be scrolled into view if user clicked a row that's off-screen
3. **URL Sync**:
   - Opening detail updates URL to `/products/{id}`
   - Closing detail returns URL to `/products`
   - Direct link to `/products/{id}` automatically opens that product's detail panel
   - Browser back/forward buttons work correctly
4. **Keyboard Navigation**:
   - Arrow keys navigate between table rows
   - Enter key on row opens detail panel
   - ESC key closes detail panel
   - Tab key navigates within detail panel when open
5. **Filter Persistence**:
   - Filters remain active when detail panel is open
   - User can close detail, adjust filters, open different product
   - Filters are preserved in URL query params (e.g., `/products?category=bearings&stock=low`)

**Why This Pattern?**

This inline detail approach provides several benefits:

- **Context preservation**: User doesn't lose sight of the product list
- **Quick comparison**: Easy to close one product and open another
- **Filter context**: Filters remain visible, user understands which products are currently filtered
- **Efficiency**: Faster than full page navigation for browsing multiple products
- **Familiar pattern**: Common in modern data-intensive applications (Gmail, Slack, Linear, etc.)

**Implementation Notes**:

For Next.js implementation:

```typescript
// app/products/page.tsx (or layout)
'use client'

export default function ProductsPage({ params, searchParams }) {
  const [selectedProductId, setSelectedProductId] = useState(params?.id)

  // When URL changes, update selected product
  useEffect(() => {
    if (searchParams?.id) {
      setSelectedProductId(searchParams.id)
    }
  }, [searchParams])

  return (
    <div>
      <FilterBar />
      <ProductsTable
        products={filteredProducts}
        selectedProductId={selectedProductId}
        onRowClick={(product) => {
          setSelectedProductId(product.id)
          router.push(`/products?id=${product.id}`)
        }}
      />
    </div>
  )
}

// components/products/products-table.tsx
function ProductsTable({ products, selectedProductId, onRowClick }) {
  return (
    <table>
      {products.map(product => (
        <>
          <tr
            key={product.id}
            onClick={() => onRowClick(product)}
            className={selectedProductId === product.id ? 'border-l-4 border-primary' : ''}
          >
            {/* Normal row cells */}
          </tr>
          {selectedProductId === product.id && (
            <tr>
              <td colSpan="9" className="p-0">
                <ProductDetailPanel
                  product={product}
                  onClose={() => {
                    setSelectedProductId(null)
                    router.push('/products')
                  }}
                />
              </td>
            </tr>
          )}
        </>
      ))}
    </table>
  )
}
```

This pattern can REPLACE sections 3 and 4 above, or be provided as an alternative advanced view mode.

---

### 4. Product Detail Page (Standalone - Optional)

Path: `/warehouse/products/[id]` or `/products/[id]`

Use a specific mock product for the detail view, for example:

- **Product Name**: "Industrial Ball Bearing 6203ZZ"
- **SKU**: "BRG-6203ZZ-001"
- **Category**: Bearings > Ball Bearings
- **Current Stock**: 245 units across 3 locations
- **Price**: $18.50
- **Cost**: $12.30
- **Reorder Point**: 100 units

**Page Content**:

**Product Header**:

- **Left side**:
  - Product name "Industrial Ball Bearing 6203ZZ" (with inline edit pencil icon on hover)
  - SKU "BRG-6203ZZ-001"
  - Barcode display "EAN: 5901234567890"
  - Category breadcrumb: "Bearings > Ball Bearings"
  - Status badge: "Active" (green)
- **Right side**:
  - "Edit" button (shows toast "Demo: Edit mode")
  - "Duplicate" button (shows toast)
  - "Delete" button (shows confirmation dialog)
  - "More" dropdown (Print Label, Export, View History)

**Two-Column Layout**:

**Left Sidebar (~300px)**:

1. **Image Gallery**:
   - Large main image (bearing product image or placeholder)
   - 4 thumbnail images below in strip
   - "Upload Image" button
   - Click thumbnails to change main image

2. **Quick Stats Card**:
   - Large number: "245" with unit label "units"
   - Stock value: "$4,522.50" (calculated: 245 × $18.50)
   - Reorder point with progress bar: Bar showing 245/100 (full, green)
   - Stock status badge: "In Stock" (green)

3. **Stock by Location Widget**:
   - Horizontal bar chart showing:
     - Zone A - Row 12: 120 units (longest bar)
     - Zone B - Row 05: 85 units
     - Zone C - Row 03: 40 units
   - "View All Locations" link

4. **Tags Section**:
   - Tag chips: "High Demand", "Auto-Reorder", "Industrial"
   - "+ Add Tag" button (opens input on click)

**Main Content Area (Right side)**:

**Tab Navigation**:

- Tabs: Overview | Purchase & Sales | Inventory | Suppliers | Stock Movements | Audit History | Custom Fields
- Active tab (Overview by default) with underline indicator
- Tabs scroll if too many for width

**Overview Tab Content** (default active):

1. **Basic Information Card**:
   - Section header "Basic Information" with "Edit" button
   - Two-column grid of label/value pairs:
     - Name: "Industrial Ball Bearing 6203ZZ"
     - SKU: "BRG-6203ZZ-001"
     - Description: "Deep groove ball bearing, double sealed, metric series, 17mm inner diameter, 40mm outer diameter, 12mm width. Suitable for high-speed applications."
     - Category: "Bearings > Ball Bearings"
     - Brand: "SKF"
     - Manufacturer: "SKF Manufacturing AB"
     - Unit: "Pieces"
     - Returnable: "Yes" badge

2. **Identifiers Card**:
   - Section header "Identifiers"
   - Grid showing:
     - UPC: "123456789012"
     - EAN: "5901234567890"
     - MPN: "6203-2Z"
   - Barcodes list:
     - "5901234567890" with "Primary" badge
     - "123456789012"
   - "+ Add Barcode" button

3. **Measurements Card**:
   - Section header "Measurements"
   - Dimensions: "40 × 40 × 12 mm" (L × W × H)
   - Weight: "0.085 kg"

**Purchase & Sales Tab**:

- Two cards side by side:
  - **Purchase Information**:
    - Cost Price: "$12.30"
    - Purchase Account: "5100 - Inventory Purchases"
    - Description: "Standard industrial bearing for machinery"

  - **Sales Information**:
    - Selling Price: "$18.50"
    - Profit Margin: "$6.20 (50.4%)" (calculated, highlighted in green)
    - Sales Account: "4100 - Product Sales"
    - Description: "Premium quality ball bearing for industrial applications"

**Inventory Tab**:

1. **Inventory Settings Card**:
   - Track Inventory: Toggle ON (green)
   - Inventory Account: "1200 - Finished Goods"
   - Opening Stock: "200 units"
   - Opening Stock Rate: "$12.00"

2. **Replenishment Settings Card**:
   - Reorder Point: "100 units"
   - Calculation Method: Radio buttons with "Min/Max" selected (other options: Fixed, Auto [disabled])
   - Maximum Stock Level: "500 units" (shown because Min/Max selected)
   - Lead Time: "14 days"
   - Low Stock Alerts: Toggle ON
   - **Visual Preview Panel** (light blue background):
     - "When stock falls below **100 units**, system will suggest ordering up to **500 units**"
     - "Current stock: **245 units** (145 units above reorder point)"
     - Icon showing calculation flow

3. **Current Stock Summary Table**:
   - Columns: Location | Available | Reserved | In Transit | Total
   - Rows:
     - Zone A - Row 12: 115 | 5 | 0 | 120
     - Zone B - Row 05: 80 | 5 | 0 | 85
     - Zone C - Row 03: 40 | 0 | 0 | 40
     - **TOTAL (bold)**: 235 | 10 | 0 | 245
   - "View Stock Movements" link below

**Suppliers Tab**:

- Toolbar with "+ Add Supplier" button and "Active/Inactive" filter toggle

- **Suppliers Table** (3 suppliers):

  **Row 1** (with gold star icon for preferred):
  - Supplier: "⭐ Industrial Supplies Co."
  - Supplier SKU: "ISC-BRG-6203"
  - Unit Price: "$12.30 PLN"
  - Lead Time: "14 days" with clock icon
  - Packaging: "Box of 50" with package icon + "Full only" badge
  - Status: "Active" badge (green)
  - Actions: Menu (Edit, Remove)

  **Row 2**:
  - Supplier: "Global Parts Inc."
  - Supplier SKU: "GP-6203ZZ"
  - Unit Price: "$12.80 PLN"
  - Lead Time: "21 days"
  - Packaging: "Box of 100"
  - Status: "Active" badge
  - Actions: Menu (Edit, Set as Preferred, Remove)

  **Row 3**:
  - Supplier: "Premier Manufacturing"
  - Supplier SKU: "PM-BB-6203"
  - Unit Price: "$11.95 PLN"
  - Lead Time: "30 days"
  - Packaging: "Bulk (any quantity)"
  - Status: "Inactive" badge (gray)
  - Actions: Menu (Edit, Set as Preferred, Activate, Remove)

- Hover on rows shows highlight
- Click "Set as Preferred" shows toast "Demo: Supplier set as preferred" and updates UI

**Stock Movements Tab**:

- Filter bar: Date range picker (last 30 days), Movement type dropdown (All), Status filter (All)

- **Movements Timeline** (vertical timeline, 6 entries):

  **Entry 1** (2 hours ago):
  - Icon: Green circle with arrow up
  - "Receipt from Purchase Order"
  - Date: "Today, 2:15 PM"
  - Details: "Zone A - Row 12 ← Supplier: Industrial Supplies Co."
  - Quantity: "+50 units" (green)
  - Reference: "PO-2024-0143"
  - Status: "Completed" badge (green)
  - Created by: Avatar + "Sarah Johnson"

  **Entry 2** (1 day ago):
  - Icon: Blue circle with transfer arrows
  - "Internal Transfer"
  - Date: "Yesterday, 3:45 PM"
  - Details: "Zone A - Row 12 → Zone C - Row 03"
  - Quantity: "20 units transferred"
  - Reference: "TRF-2024-0089"
  - Status: "Completed" badge
  - Created by: "John Smith"

  **Entry 3** (2 days ago):
  - Icon: Red circle with arrow down
  - "Issue for Sales Order"
  - Date: "Dec 19, 10:20 AM"
  - Details: "Zone B - Row 05 → Customer: ABC Manufacturing"
  - Quantity: "-15 units" (red)
  - Reference: "SO-2024-1205"
  - Status: "Completed" badge
  - Created by: "Mike Davis"

  **Entry 4** (3 days ago):
  - Icon: Orange circle with adjustment icon
  - "Inventory Adjustment"
  - Date: "Dec 18, 4:30 PM"
  - Details: "Zone B - Row 05 (Stock count correction)"
  - Quantity: "+5 units" (green)
  - Reference: "ADJ-2024-0034"
  - Status: "Completed" badge
  - Created by: "Lisa Anderson"

  **Entry 5** (5 days ago):
  - Icon: Green circle with arrow up
  - "Receipt from Purchase Order"
  - Date: "Dec 16, 11:00 AM"
  - Details: "Zone B - Row 05 ← Supplier: Global Parts Inc."
  - Quantity: "+100 units" (green)
  - Reference: "PO-2024-0138"
  - Status: "Completed" badge
  - Created by: "Sarah Johnson"

  **Entry 6** (1 week ago):
  - Icon: Red circle with arrow down
  - "Issue for Production Order"
  - Date: "Dec 14, 9:15 AM"
  - Details: "Zone A - Row 12 → Production Line 3"
  - Quantity: "-25 units" (red)
  - Reference: "PROD-2024-0456"
  - Status: "Completed" badge
  - Created by: "Tom Wilson"

- Click any entry to show detail dialog (mock)

- **Summary Stats Box** (at top or side):
  - "Total Received: 150 units" with up arrow icon
  - "Total Issued: 40 units" with down arrow icon
  - "Net Change: +110 units" with trend icon

**Audit History Tab**:

- **3 Audit Cards**:

  **Card 1** (most recent):
  - Date (large): "December 15, 2024"
  - Location: "Zone A - Row 12"
  - Expected: "120 units"
  - Actual: "118 units"
  - Discrepancy: "-2 units" (red indicator)
  - Auditor: Avatar + "Lisa Anderson"
  - Notes: "Minor discrepancy found, likely due to unreported damage. Adjustment movement created."
  - "View Full Audit" link

  **Card 2**:
  - Date: "November 30, 2024"
  - Location: "Zone B - Row 05"
  - Expected: "85 units"
  - Actual: "86 units"
  - Discrepancy: "+1 unit" (green indicator)
  - Auditor: "John Smith"
  - Notes: "One additional unit found during count. Verified and adjusted."
  - "View Full Audit" link

  **Card 3**:
  - Date: "November 15, 2024"
  - Location: "Zone C - Row 03"
  - Expected: "40 units"
  - Actual: "40 units"
  - Discrepancy: "No variance" (green checkmark)
  - Auditor: "Lisa Anderson"
  - Notes: "Count accurate."
  - "View Full Audit" link

**Custom Fields Tab**:

- "+ Add Custom Field" dropdown at top (shows list: Warranty Period, Certification Number, Storage Temperature)

- **2 Custom Fields shown**:

  **Row 1**:
  - Field name: "Warranty Period"
  - Type badge: "Text"
  - Value: "24 months" (inline editable on click)
  - Remove button (X icon)

  **Row 2**:
  - Field name: "Certification Number"
  - Type badge: "Text"
  - Value: "ISO-9001-2024-BRG" (inline editable)
  - Remove button

**Interactions**:

- **Tab switching**: Smooth transition between tabs, update URL (if using routing)
- **Inline editing**: Click pencil icon or value to edit, show save/cancel buttons
- **Card actions**: Click "Edit" button to enter edit mode for section (show input fields)
- **Supplier actions**: Click menu items to perform actions (show toasts)
- **Timeline filtering**: Apply filters to show subset of movements
- **Image gallery**: Click thumbnails to swap main image
- **Tags**: Click "+ Add Tag" to show input, enter to add, click X on tag to remove

**States**:

- **Loading**: Show skeleton screen when initially loading (brief)
- **Empty states for tabs**:
  - Suppliers tab with no suppliers: "No suppliers configured" + "Add First Supplier" button
  - Audits with no history: "No audits performed yet" + explanation
  - Custom fields with none: "No custom fields added. Add fields to track additional product information." + "Add Field" button

## Technical Implementation Notes

### Required Tech Stack (Match Production Application)

**IMPORTANT**: This demo should use the same technology stack as the production CoreFrame application to maintain consistency and allow for easy integration of components later.

**Framework & Core**:

- **Next.js 15** (App Router) - React framework with file-based routing
- **React 18+** - UI library with hooks and modern patterns
- **TypeScript** - Type-safe development (strictly typed)

**Styling & UI Components**:

- **Tailwind CSS** - Utility-first CSS framework (required)
- **shadcn/ui** - Component library built on Radix UI primitives
  - Use shadcn/ui components as base: Button, Input, Select, Dialog, Tabs, Card, Badge, etc.
  - Components should be in `components/ui/` directory
  - Follow shadcn/ui installation pattern: `npx shadcn@latest add [component-name]`
- **Radix UI** - Headless UI primitives (via shadcn/ui)
- **Lucide React** - Icon library (preferred over Heroicons)
- **CSS Variables** - For theming (defined in globals.css)

**State Management**:

- **Zustand** (optional for demo) - Lightweight state management
- **React Context** - For global state if Zustand not used
- **localStorage** - Persist user preferences (sidebar state, view mode, etc.)

**Forms & Validation** (if needed for demo):

- **React Hook Form** - Form state management
- **Zod** - Schema validation

**Data Visualization** (if charts needed):

- **Recharts** - React chart library
- Alternatively: **Tremor** for dashboard-style charts

**Utilities**:

- **clsx** or **cn** utility - Conditional className merging
- **date-fns** - Date formatting and manipulation
- **@faker-js/faker** (optional) - Generate realistic mock data

### Next.js Specific Implementation

**Project Structure**:

```
demo-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with dashboard shell
│   ├── page.tsx                 # Home dashboard (/)
│   ├── products/
│   │   ├── page.tsx            # Products list (/products)
│   │   └── [id]/
│   │       └── page.tsx        # Product detail (/products/[id])
│   └── globals.css             # Tailwind + CSS variables
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx         # Sidebar navigation
│   │   ├── header.tsx          # Header bar
│   │   └── status-bar.tsx      # Status bar
│   ├── dashboard/
│   │   ├── metric-card.tsx
│   │   ├── activity-feed.tsx
│   │   ├── quick-actions.tsx
│   │   └── alerts-panel.tsx
│   └── products/
│       ├── product-grid.tsx
│       ├── product-list.tsx
│       ├── product-table.tsx
│       └── product-filters.tsx
├── lib/
│   ├── mock-data.ts            # All mock data
│   └── utils.ts                # Utility functions (cn, etc.)
├── hooks/
│   ├── use-sidebar.ts          # Sidebar state hook
│   └── use-filters.ts          # Filter state hook
└── types/
    └── index.ts                # TypeScript types
```

**Routing with App Router**:

- Use Next.js 15 App Router (not Pages Router)
- File-based routing: `app/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`
- Use `Link` from `next/link` for navigation
- Use `useRouter` and `usePathname` from `next/navigation` for programmatic navigation
- Update URL params with `router.push()` or `searchParams`

**Layout Pattern**:

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
            <StatusBar />
          </div>
        </div>
      </body>
    </html>
  )
}
```

**Client vs Server Components**:

- Use `'use client'` directive for interactive components:
  - Sidebar (has toggle state)
  - Filters panel (has form state)
  - Product cards (have hover/click interactions)
  - Dialogs, dropdowns, any component using hooks
- Keep static components as Server Components (default)
- Product detail pages can be Server Components with Client Component children

**Mock Data Strategy**:

```typescript
// lib/mock-data.ts
export const mockProducts = [
  {
    id: '1',
    name: 'Industrial Ball Bearing 6203ZZ',
    sku: 'BRG-6203ZZ-001',
    category: 'Bearings',
    stock: 245,
    price: 18.50,
    // ... full product data
  },
  // ... 59 more products
]

export const mockSuppliers = [...]
export const mockMovements = [...]
```

**State Management with Zustand** (optional):

```typescript
// hooks/use-sidebar.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSidebar = create(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    { name: "sidebar-storage" }
  )
);
```

**Styling with Tailwind**:

- Use Tailwind utility classes exclusively
- Define custom colors in `tailwind.config.ts`:

```typescript
colors: {
  border: "hsl(var(--border))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  warehouse: {
    DEFAULT: '#10b981', // Green for warehouse module
  },
  // ... other colors
}
```

**Component Example Pattern**:

```typescript
// components/products/product-card.tsx
'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoreVertical } from 'lucide-react'
import Link from 'next/link'

interface ProductCardProps {
  product: {
    id: string
    name: string
    sku: string
    stock: number
    price: number
  }
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`}>
      <Card className="hover:shadow-lg transition-shadow">
        {/* Card content */}
      </Card>
    </Link>
  )
}
```

**Responsive Design with Tailwind**:

- Mobile first: Base styles = mobile
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Example: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Sidebar: `hidden lg:block` for desktop, drawer overlay on mobile

**Animations with Tailwind**:

```typescript
// Smooth transitions
className = "transition-all duration-200 ease-in-out";

// Hover effects
className = "hover:scale-105 hover:shadow-lg";

// Loading skeleton with animation
className = "animate-pulse bg-gray-200 rounded";
```

**Type Safety**:

```typescript
// types/index.ts
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  supplier?: string;
  stock: number;
  reorderPoint: number;
  price: number;
  cost: number;
  status: "active" | "inactive";
  tags?: string[];
  // ... all fields
}

export interface Supplier {
  id: string;
  name: string;
  // ...
}

export interface StockMovement {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  // ...
}
```

**Responsive Design**:

- Mobile first approach
- Breakpoints:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
- Sidebar becomes overlay drawer on mobile
- Tables become scrollable or card-based on mobile
- Hide less critical columns on smaller screens

**Animations/Transitions**:

- Smooth page transitions (fade or slide)
- Sidebar expand/collapse animation
- Filter panel slide in/out
- Card hover effects (slight scale or shadow increase)
- Loading skeletons with shimmer effect
- Toast notifications slide in from top or corner

**Accessibility**:

- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- Focus indicators visible
- ARIA labels on interactive elements
- Semantic HTML
- Color contrast ratios meet WCAG AA

## Deliverables

Create a working demo application that includes:

1. **Complete Dashboard Shell**: Sidebar, header, status bar, main content area
2. **Home Dashboard Page**: With all widgets showing mock data
3. **Products List Page**: All 3 view modes functional with 60 mock products
4. **Product Detail Page**: All tabs functional with realistic mock data
5. **Smooth Interactions**: Page navigation, filtering, sorting, view switching all work
6. **Responsive Design**: Works well on desktop, tablet, and mobile
7. **Loading & Empty States**: Properly implemented throughout

**The demo should feel like a real application** - users should be able to click around, interact with components, apply filters, switch views, navigate pages, and get a sense of how the actual product would work.

## Example User Flows to Demonstrate

1. **Browse Products Flow**:
   - User lands on dashboard
   - Clicks "Products" in sidebar
   - Sees products in grid view
   - Applies category filter → products update
   - Switches to table view → smooth transition
   - Sorts by price → table reorders
   - Clicks product → navigates to detail page

2. **Product Detail Exploration**:
   - User on product detail page
   - Views overview tab (default)
   - Clicks "Suppliers" tab → sees supplier table
   - Clicks menu on non-preferred supplier → "Set as Preferred"
   - Star icon moves to that supplier, toast appears
   - Clicks "Stock Movements" tab → sees timeline
   - Applies date filter → timeline updates

3. **Dashboard to Action Flow**:
   - User on home dashboard
   - Sees "12 Low Stock Items" metric
   - Clicks card → navigates to products page with "Low Stock" filter pre-applied
   - Shows only low stock products
   - User can review and take action

## Important Notes

- **No Backend Required**: All data is mock/static, stored client-side
- **No Database**: Use JSON objects or TypeScript constants for data
- **No Authentication**: Skip login, go straight to dashboard
- **Focus on UX**: Smooth, polished interactions matter more than perfect data accuracy
- **Realistic Feel**: Use proper terminology, realistic values, authentic-looking data
- **Professional Quality**: This should look and feel like a production application

The goal is to create a **clickable, explorable prototype** that demonstrates the design system, layout, navigation, and key user experiences without any backend infrastructure.

---

Begin by setting up the dashboard shell with sidebar and navigation, then implement the three pages with their mock data and interactions. Ensure all components use the design system you created in the previous phase.
