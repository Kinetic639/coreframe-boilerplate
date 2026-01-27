# CoreFrame WMS/VMI Application - Detailed Description

## Application Overview

CoreFrame is a comprehensive enterprise-grade Warehouse Management System (WMS) and Vendor Managed Inventory (VMI) platform designed for multi-tenant B2B operations. The application serves manufacturing companies, distributors, and suppliers who need to manage complex warehouse operations, inventory tracking, supplier relationships, and B2B commerce in a unified platform.

## Core Business Model

### Multi-Tenancy Architecture

- **Organizations**: Top-level entities representing companies or business units
- **Branches**: Sub-entities within organizations representing physical locations, warehouses, or departments
- **User Context**: Users can belong to multiple organizations and switch between different branches within their active organization
- **Data Isolation**: All data is isolated by organization and branch context, ensuring complete separation between tenants

### Role-Based Access Control (RBAC)

- Granular permission system with scope-based access (organization-level or branch-level)
- Roles define what users can see and do within the system
- Examples: branch_admin, warehouse_manager, inventory_clerk, viewer

### Authentication Flow

- Users authenticate once and receive organization/branch context
- Active organization and active branch are maintained throughout the session
- Users can switch between available branches without re-authenticating

## Application Structure

### Module System

The application is built on a modular architecture where features are organized into independent, self-contained modules. Each module:

- Defines its own routes, navigation items, and widgets
- Can be dynamically loaded based on organization configuration
- Has its own color theme for visual distinction
- Contains complete CRUD operations for its domain

### Available Modules

#### 1. Home Module

**Route**: `/dashboard/start`
**Purpose**: Central dashboard and news hub
**Key Features**:

- News feed displaying announcements and updates
- Quick action cards for common tasks
- Widget aggregation from other modules
- Role-based content filtering

#### 2. Warehouse Module

**Route**: `/dashboard/warehouse/*`
**Color Theme**: Green (#10b981)
**Purpose**: Complete warehouse management system

**Sub-Systems**:

**Products Management** (`/dashboard/warehouse/products`)

- Normalized product structure with base products, variants, and organization-specific data
- Multiple view modes: cards, list, detailed table
- Real-time stock display with location tracking
- Advanced filtering by tags, suppliers, categories, price ranges, and availability
- Full CRUD operations with inline editing
- Support for product barcodes (multiple per product, one primary)
- Custom fields system for product-specific attributes
- Product images for e-commerce integration
- Purchase information: cost price, preferred suppliers, lead times
- Sales information: selling price, profit margins
- Inventory tracking: reorder points, min/max levels, opening stock
- Replenishment calculations: fixed quantity, min/max, and auto-calculation methods
- Supplier relationships through junction table (product_suppliers)

**Product-Supplier Relationships**

- Many-to-many relationship between products and suppliers
- Each relationship includes: unit price, currency, lead time, minimum order quantity, order multiples
- Packaging constraints: package quantities, partial package allowance
- Supplier-specific product information: supplier SKU, supplier product name
- Preferred supplier designation (one per product)
- Price history tracking with change reasons
- Active/inactive status per relationship

**Locations Management** (`/dashboard/warehouse/locations`)

- Hierarchical location tree (3 levels deep)
- Each location has icon, color, and QR code
- Mobile-friendly tree navigation
- Soft delete with deleted_at tracking
- Per-location stock tracking

**Audits System** (`/dashboard/warehouse/audits`)

- Audit scheduler for recurring inventory counts
- Historical audit logs with discrepancy metrics
- Interactive audit flow with step-by-step modal
- Stock correction during audit process
- Trigger points in location tree and product detail views

**Stock Movements & Transfers** (`/dashboard/warehouse/movements`)

- SAP-style movement type system with numeric codes (101-613)
- 31 pre-configured movement types across 6 categories:
  - Receipts (101-105): Purchase orders, returns from customers, production output
  - Issues (201-206): Sales orders, returns to supplier, waste/damage
  - Transfers (301-312): Intra-location and inter-branch transfers
  - Adjustments (401-411): Inventory corrections, quality reclassification
  - Reservations (501-502): Stock reservation and allocation management
  - E-commerce (601-613): Shopify, WooCommerce, Allegro integration
- Polish warehouse compliance with document types (PZ, WZ, MM, RW, KP, KN, INW)
- Bilingual support (Polish/English)
- Movement approval workflow: pending → approved → completed (or cancelled/reversed)
- Real-time inventory calculations via database views
- Stock reservations for sales orders
- Comprehensive validation service for business rules
- Movement history and audit trail
- Soft delete for complete traceability

**Suppliers Management** (`/dashboard/warehouse/suppliers`)

- Business accounts system unified for vendors and customers (partner_type: 'vendor' or 'client')
- Complete supplier information: company registration, tax numbers, payment terms, delivery terms
- Multiple contacts per supplier with primary contact designation
- Supplier product catalog with pricing and lead times
- Incoming deliveries management
- Supplier performance tracking

**B2B Catalog System**

- Supplier-side: Admin panel to manage product catalogs and client access
- Client-side: Access to supplier-specific catalogs with negotiated pricing
- Invite-only access model
- Public and private catalog options
- Client-specific pricing and discount rates
- Order placement based on client's warehouse stock levels
- Replaces traditional B2B spreadsheet and paper workflows

#### 3. Teams Module

**Route**: `/dashboard/teams/*`
**Color Theme**: Purple (#8b5cf6)
**Purpose**: Team collaboration and communication
**Key Features**:

- Member management with role assignments
- Internal chat and announcements
- Kanban board for task management
- Shared calendar for team coordination

#### 4. Organization Management Module

**Route**: `/dashboard/organization/*`
**Color Theme**: Indigo (#6366f1)
**Purpose**: Administrative control for organization and branches
**Key Features**:

- Organization profile management (logo, description, slug)
- Branch list and CRUD operations
- User roles and permissions configuration
- Organization-wide settings

#### 5. Support Module

**Route**: `/dashboard/support/*`
**Purpose**: Help and user support
**Key Features**:

- Help Center with FAQs
- Contact Support ticketing system
- Announcements and changelog
- Product roadmap visibility
- System status monitoring

## Dashboard Layout Structure

### Overall Layout Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Dashboard Container - Full Screen]                │
│                                                     │
│  ┌────────────┬────────────────────────────────┐   │
│  │            │                                │   │
│  │  Sidebar   │  Main Content Area             │   │
│  │            │                                │   │
│  │  (Collaps  │  ┌──────────────────────────┐ │   │
│  │   -ible)   │  │  Header Bar              │ │   │
│  │            │  └──────────────────────────┘ │   │
│  │            │                                │   │
│  │            │  ┌──────────────────────────┐ │   │
│  │            │  │                          │ │   │
│  │            │  │  Page Content            │ │   │
│  │            │  │                          │ │   │
│  │            │  │  (Scrollable)            │ │   │
│  │            │  │                          │ │   │
│  │            │  └──────────────────────────┘ │   │
│  │            │                                │   │
│  │            │  ┌──────────────────────────┐ │   │
│  │            │  │  Status Bar              │ │   │
│  │            │  └──────────────────────────┘ │   │
│  │            │                                │   │
│  └────────────┴────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Sidebar Component

**Purpose**: Primary navigation and context switching

**Structure**:

- **Top Section**:
  - Application logo/brand
  - Organization selector dropdown (if user has multiple organizations)
  - Branch selector dropdown (switches active branch context)

- **Middle Section (Scrollable)**:
  - Navigation items grouped by module
  - Each module group has:
    - Module name header with color accent indicator
    - Collapsible/expandable section
    - List of page links within that module
  - Visual hierarchy showing current active page
  - Icon + label for each navigation item

- **Bottom Section**:
  - User profile area with avatar
  - User name and role display
  - Quick access to profile settings
  - Logout action

**Interaction**:

- Collapsible to icon-only mode (sidebar toggle button)
- Active state highlighting for current page
- Module groups can expand/collapse independently
- Responsive: converts to overlay/drawer on mobile

**Example Navigation Structure**:

```
Home
  └─ Dashboard

Warehouse (Green accent)
  ├─ Products
  ├─ Locations
  ├─ Stock Movements
  ├─ Audits
  ├─ Suppliers
  └─ Labels & Templates

Teams (Purple accent)
  ├─ Members
  ├─ Chat
  ├─ Kanban
  └─ Calendar

Organization (Indigo accent)
  ├─ Profile
  ├─ Branches
  └─ Users & Roles

Support
  ├─ Help Center
  ├─ Contact Support
  └─ System Status
```

### Header Bar Component

**Purpose**: Global search, notifications, and quick actions

**Layout** (left to right):

- **Breadcrumb Navigation**: Shows current location hierarchy (e.g., Warehouse > Products > Product Detail)
- **Global Search Bar**:
  - Full-text search across products, locations, suppliers
  - Shows recent searches
  - Quick filters dropdown
  - Keyboard shortcut indicator (e.g., Cmd+K)
- **Action Buttons Section**:
  - Notifications bell icon with badge counter
  - Quick action menu (common tasks based on current module)
  - Language selector (Polish/English toggle)
- **User Menu**: Avatar with dropdown for profile, settings, logout

**Behavior**:

- Fixed/sticky position at top of main content area
- Search expands on focus
- Notifications panel slides down from header
- Responsive: collapses less critical items on smaller screens

### Main Content Area

**Purpose**: Display page-specific content

**Structure**:

- **Page Header Section**:
  - Page title
  - Page description/subtitle
  - Primary action buttons (e.g., "Add Product", "Create Movement")
  - Tab navigation (if page has multiple views)

- **Filters/Toolbar Section** (if applicable):
  - Filter chips showing active filters
  - View mode toggles (list/grid/table)
  - Sort controls
  - Export/import actions

- **Content Section**:
  - Main data display (tables, cards, forms, etc.)
  - Scrollable when content exceeds viewport
  - Loading states and empty states
  - Pagination controls at bottom

**Layout Variants by Page Type**:

**List Pages** (e.g., Products List):

- Filter sidebar or collapsible filter panel
- Grid/list/table view options
- Bulk action controls when items selected
- Infinite scroll or pagination

**Detail Pages** (e.g., Product Detail):

- Split layout with summary sidebar and tabbed content
- Action buttons for edit/delete
- Related items sections
- Activity timeline

**Form Pages** (e.g., Create Product):

- Multi-step wizard or tabbed form
- Form validation feedback
- Save/cancel actions
- Progress indicator for multi-step

### Status Bar Component

**Purpose**: System status, background task monitoring, and contextual information

**Layout** (left to right):

- **Connection Status**: Indicator showing online/offline/syncing state
- **Active Context Display**:
  - Current organization name
  - Current branch name
  - Quick switch action
- **Background Tasks**:
  - Progress indicators for long-running operations (e.g., "Exporting products... 45%")
  - Expandable task list showing recent operations
- **System Information**:
  - Last sync time
  - Storage usage indicator (if applicable)
  - Version number
- **Help/Documentation Link**: Quick access to contextual help

**Behavior**:

- Fixed position at bottom of viewport
- Can be minimized to save space
- Shows temporary notifications (auto-dismiss)
- Updates in real-time without page refresh

## Data Flow and Business Logic

### Inventory Management Flow

1. **Product Creation**:
   - User creates base product with essential information
   - System generates unique product ID
   - Optional: Add product variants for size/color/form variations
   - Optional: Add custom fields for industry-specific attributes

2. **Supplier Relationship**:
   - Navigate to product's "Suppliers" tab
   - Add supplier from business_accounts (partner_type: 'vendor')
   - Define supplier-specific data: pricing, lead time, MOQ, packaging
   - Mark one supplier as preferred
   - System tracks price history automatically

3. **Stock Receiving** (Movement Type 101):
   - Create receipt movement from purchase order
   - Specify source supplier, destination location
   - Enter quantities and reference documents
   - Movement goes through approval workflow
   - Upon completion, stock increases in destination location

4. **Stock Transfer** (Movement Type 301):
   - Select source and destination locations
   - Specify products and quantities
   - Validate available stock in source
   - Create movement with approval status
   - Upon approval, stock decrements from source, increments to destination

5. **Stock Audit**:
   - Schedule audit for specific location or entire warehouse
   - System generates expected quantities based on current inventory
   - Auditor scans products and enters actual counts
   - System calculates discrepancies
   - Generate adjustment movements to correct inventory

6. **Reorder Management**:
   - System monitors stock levels against reorder points
   - When stock falls below reorder point, triggers alert
   - Based on replenishment method:
     - Fixed: Order predefined quantity
     - Min/Max: Calculate quantity to reach max level
     - Auto: Use historical demand data (future feature)
   - Consider supplier packaging constraints and MOQ
   - Generate purchase order suggestion

### B2B Workflow

1. **Supplier Setup**:
   - Supplier creates/maintains product catalog in their WMS
   - Defines pricing tiers and discount structures
   - Configures client access permissions (public/private catalogs)

2. **Client Invitation**:
   - Supplier sends invitation to client organization
   - Client accepts and gains access to supplier's catalog
   - Client sees supplier-negotiated pricing

3. **Order Placement**:
   - Client browses supplier catalog
   - System shows client's current stock levels alongside catalog
   - Client places order based on their reorder needs
   - Order transmits to supplier's WMS as incoming order

4. **Order Fulfillment**:
   - Supplier receives order in their system
   - Picks, packs, and ships products
   - Creates shipment movement (Type 201)
   - Client receives shipment notification
   - Client creates receipt movement (Type 101) to accept goods

### Contact Management

1. **Contact Structure**:
   - Contacts are stored in unified `contacts` table (individuals)
   - Business accounts in `business_accounts` table (companies/vendors/clients)
   - Junction table `business_account_contacts` links contacts to accounts

2. **Multiple Contacts**:
   - Each business account can have multiple linked contacts
   - Each link includes metadata: position, department, notes
   - One contact can be marked as primary per business account
   - Unique constraint ensures only one primary contact

3. **Contact Operations**:
   - Add contact: Create in contacts table, create link in junction table
   - Update contact: Update both contact record and link metadata
   - Set primary: Update is_primary flag, automatically unset others
   - Remove contact: Soft delete the link (preserves contact record)

## Technical Architecture Notes

### Database Schema Highlights

**Key Tables**:

- `products`: Base product information
- `product_variants`: Size/color/form variations
- `product_suppliers`: Junction table for product-supplier relationships with pricing
- `product_barcodes`: Multiple barcodes per product
- `product_images`: E-commerce and catalog images
- `product_location_stock`: Real-time stock by location
- `locations`: Hierarchical warehouse locations
- `business_accounts`: Unified vendors and customers (partner_type field)
- `contacts`: Individual contact persons
- `business_account_contacts`: Links contacts to business accounts
- `stock_movements`: All inventory transactions with approval workflow
- `movement_types`: Predefined movement type catalog
- `audits`: Inventory audit records
- `audit_items`: Individual product counts in audit

**Key Views**:

- `current_inventory`: Real-time calculated stock levels across all locations
- `stock_movement_summary`: Aggregated movement statistics

### Real-Time Features

- Inventory levels update immediately upon movement completion
- Multi-user collaboration with optimistic UI updates
- Background sync for offline-capable operations
- WebSocket connections for real-time notifications

### Internationalization

- Full support for Polish and English languages
- Number formatting respects locale (e.g., 1.234,56 vs 1,234.56)
- Date/time formatting localized
- Currency display with proper symbols (PLN, EUR, USD)
- RTL support architecture in place for future expansion

### Security Model

- Row-Level Security (RLS) policies on all tables
- Organization and branch isolation enforced at database level
- Permission-based access control with authorize() function
- Storage bucket policies for file uploads
- No direct client-side database modifications
- All mutations through server actions with validation

## User Workflows

### Daily Warehouse Operator Tasks

1. **Morning Routine**:
   - Log in and review notifications
   - Check stock movement approvals pending
   - Review low stock alerts on dashboard
   - Check audit schedule for today

2. **Receiving Shipment**:
   - Navigate to Stock Movements > Create Movement
   - Select movement type "101 - Receipt from Purchase Order"
   - Scan/enter products and quantities
   - Assign to receiving location
   - Submit for approval
   - Manager approves, stock increases

3. **Picking for Sales Order**:
   - Navigate to Stock Movements > Create Movement
   - Select movement type "201 - Issue for Sales Order"
   - Enter sales order reference
   - System suggests optimal picking locations
   - Scan products, confirm quantities
   - Submit movement, stock decreases

4. **Location Transfer**:
   - Navigate to Locations tree
   - Find product that needs moving
   - Initiate transfer movement
   - Select destination location
   - Complete transfer, stock updates

### Inventory Manager Tasks

1. **Planning Audit**:
   - Navigate to Audits > Schedule New Audit
   - Select location scope (single location or full warehouse)
   - Set audit date and assign auditor
   - System generates expected inventory list

2. **Analyzing Discrepancies**:
   - Review completed audit results
   - Investigate products with large discrepancies
   - Create adjustment movements to correct inventory
   - Document reasons for adjustments

3. **Supplier Performance Review**:
   - Navigate to Suppliers list
   - Review on-time delivery metrics
   - Compare pricing across suppliers for same products
   - Update preferred supplier if needed

4. **Reorder Management**:
   - Review products below reorder point
   - Check supplier lead times and MOQ
   - Generate purchase order recommendations
   - Send orders to suppliers (via B2B system or external)

### Procurement Specialist Tasks

1. **Managing Supplier Relationships**:
   - Navigate to Suppliers
   - Add new supplier with company details
   - Add supplier contacts
   - Configure payment and delivery terms

2. **Product-Supplier Setup**:
   - Navigate to product detail page
   - Go to "Suppliers" tab
   - Add supplier with pricing
   - Set minimum order quantities
   - Configure packaging constraints
   - Mark preferred supplier

3. **Price Management**:
   - Review supplier price changes
   - Update product-supplier pricing
   - System logs price history automatically
   - Analyze cost trends

## Page-Specific Descriptions

### Home Dashboard Page (`/dashboard/start`)

**Purpose**: Central hub showing overview of system status and recent activity

**Layout**:

- Welcome message with user name and current date/time
- Widget grid (responsive columns):
  - **Key Metrics Cards**: Stock value, low stock items, pending movements, active audits
  - **Recent Activity Feed**: Latest stock movements, approvals, audits
  - **News & Announcements**: Company-wide announcements from admins
  - **Quick Actions**: Most common tasks with one-click access
  - **Alerts Panel**: Critical issues requiring attention (stock outs, expired audits)
  - **Module Widgets**: Each module can contribute dashboard widgets

**Interactions**:

- Click metric cards to navigate to relevant filtered view
- Dismiss/acknowledge alerts
- Widget order can be customized per user
- Refresh data without page reload

### Products List Page (`/dashboard/warehouse/products`)

**Purpose**: Browse, search, and manage product catalog

**Layout**:

**Left Section - Filters Panel** (collapsible):

- **Search box**: Filter by name, SKU, description
- **Category filter**: Tree-style category selector with checkboxes
- **Supplier filter**: Multi-select dropdown of suppliers
- **Tags filter**: Chip-style tag selector
- **Price range filter**: Min/max price slider
- **Stock status filter**: Checkboxes for In Stock, Low Stock, Out of Stock
- **Active filters display**: Chips showing applied filters with remove action
- **Clear all filters** button

**Main Section**:

- **Toolbar**:
  - View mode toggles: Grid, List, Table
  - Sort dropdown: Name, SKU, Price, Stock Level, Created Date
  - Bulk actions dropdown (when items selected): Export, Delete, Update Status
  - **Primary action button**: "Create Product" (prominent, right-aligned)

- **Content Area** (based on selected view mode):

  **Grid View**:
  - Product cards in responsive grid (4 columns on desktop, 2 on tablet, 1 on mobile)
  - Each card shows:
    - Product image placeholder or actual image
    - Product name
    - SKU
    - Current stock level with color indicator
    - Price
    - Quick action menu (edit, view, delete)

  **List View**:
  - Compact rows with essential information
  - Each row shows: image thumbnail, name, SKU, category, stock, price
  - Hover reveals quick actions

  **Table View**:
  - Full data table with sortable columns
  - Columns: Checkbox, Image, Name, SKU, Category, Supplier, Stock, Reorder Point, Price, Status, Actions
  - Row selection for bulk operations
  - Expandable rows to show additional details inline

- **Pagination Controls**:
  - Page numbers
  - Items per page selector (25, 50, 100)
  - Total count display
  - Previous/Next buttons

**Empty State**:

- When no products exist: Illustration with "No products yet" message and "Create First Product" button
- When filters return no results: "No products match your filters" with "Clear Filters" button

**Loading State**:

- Skeleton screens matching selected view mode
- Shimmer effect while loading

### Product Detail Page (`/dashboard/warehouse/products/[id]`)

**Purpose**: View and edit complete product information, manage stock, suppliers, and related data

**Layout**:

**Top Section - Product Header**:

- **Left side**:
  - Product name (editable inline)
  - SKU and barcode display
  - Category breadcrumb
  - Status badge (Active, Inactive, Discontinued)
- **Right side**:
  - Primary action buttons: Edit, Duplicate, Delete
  - More actions dropdown: Export, Print Label, View History

**Main Content - Two Column Layout**:

**Left Column (Narrower - Sidebar)**:

- **Product Image Gallery**:
  - Main image display
  - Thumbnail strip below
  - Upload new image button

- **Quick Stats Card**:
  - Total stock quantity with color indicator
  - Stock value (quantity × cost)
  - Reorder point with progress bar
  - Stock status label

- **Stock by Location Widget**:
  - List of locations with quantity
  - Visual bar chart
  - Link to view all locations

- **Tags Section**:
  - Tag chips
  - Add/remove tags

**Right Column (Main Content)**:

**Tab Navigation**:

1. Overview
2. Purchase & Sales
3. Inventory
4. Suppliers
5. Stock Movements
6. Audit History
7. Custom Fields

**Tab Content Areas**:

**Overview Tab**:

- **Basic Information Section**:
  - Name, SKU, Description
  - Category, Brand, Manufacturer
  - Unit of measure
  - Returnable item checkbox
  - Edit button for section

- **Identifiers Section**:
  - UPC, EAN, ISBN, MPN fields
  - Barcode list with primary indicator
  - Add barcode button

- **Measurements Section**:
  - Dimensions (L × W × H with unit)
  - Weight (value with unit)
  - Edit button for section

**Purchase & Sales Tab**:

- **Purchase Information Card**:
  - Cost price
  - Purchase account
  - Purchase description
  - Edit mode toggle

- **Sales Information Card**:
  - Selling price
  - Sales account
  - Sales description
  - Profit margin calculation (auto-calculated)
  - Edit mode toggle

**Inventory Tab**:

- **Inventory Settings Card**:
  - Track inventory toggle
  - Inventory account
  - Opening stock and rate
  - Edit mode toggle

- **Replenishment Settings Card**:
  - Reorder point
  - Calculation method (Fixed, Min/Max, Auto)
  - Reorder quantity (for Fixed method)
  - Maximum stock level (for Min/Max method)
  - Lead time days
  - Low stock alerts toggle
  - Visual preview of reorder logic

- **Current Stock Summary Table**:
  - Columns: Location, Available, Reserved, In Transit, Total
  - Grand total row
  - Action: View Stock Movements

**Suppliers Tab**:

- **Toolbar**:
  - "Add Supplier" button
  - Filter by active/inactive

- **Suppliers Table**:
  - Columns: Supplier Name (with preferred star icon), Supplier SKU, Unit Price, Lead Time, Packaging, Status, Actions
  - Each row shows:
    - Supplier name with star if preferred
    - Supplier-specific SKU
    - Price with currency
    - Lead time in days
    - Package quantity and constraints
    - Active/Inactive badge
    - Actions menu: Edit, Set as Preferred, Remove

- **Empty State**: "No suppliers configured" with "Add First Supplier" button

**Stock Movements Tab**:

- **Filter Bar**:
  - Date range picker
  - Movement type filter
  - Status filter

- **Movements Timeline**:
  - Chronological list of all movements affecting this product
  - Each entry shows:
    - Movement type with icon
    - Date and time
    - Source and destination
    - Quantity with +/- indicator
    - Document reference
    - Status badge
    - Created by user
  - Click to view movement detail

- **Summary Stats**:
  - Total received (sum of receipt movements)
  - Total issued (sum of issue movements)
  - Net change

**Audit History Tab**:

- **List of Audits**:
  - Each audit card shows:
    - Audit date
    - Location audited
    - Expected quantity vs. Actual quantity
    - Discrepancy with color indicator (red for shortage, green for overage)
    - Auditor name
    - Notes
  - Click to view full audit detail

- **Empty State**: "No audits performed yet"

**Custom Fields Tab**:

- **Add Custom Field Dropdown**: Select from organization-defined custom fields
- **Custom Fields List**:
  - Each field shows: Field name, Field type (text, number, date, boolean), Value with inline edit
  - Remove field action

- **Empty State**: "No custom fields added" with "Add Field" prompt

**Interactions**:

- Click "Edit" in any section to enable inline editing
- Save/Cancel buttons appear when editing
- Changes save automatically with visual confirmation
- Validation errors display inline
- Related items link to their respective pages

## Design System Requirements

### Core Principles

**Professional Enterprise Aesthetic**:

- Clean, uncluttered interface focusing on information density and efficiency
- Consistent use of whitespace for visual breathing room
- Clear visual hierarchy guiding user attention to primary actions and critical information
- Data-dense displays that remain scannable and not overwhelming

**Trust and Reliability**:

- Stable, predictable interactions with clear feedback
- No surprises - users should always know what will happen when they interact
- Obvious undo capabilities for destructive actions
- Clear confirmation dialogs for critical operations

**Efficiency for Daily Use**:

- Optimize for keyboard navigation and shortcuts
- Minimize clicks to complete common tasks
- Smart defaults based on user behavior
- Bulk operations for repetitive tasks
- Inline editing where appropriate to reduce context switching

### Functional Requirements

**Accessibility**:

- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all interactive elements
- Screen reader support with proper ARIA labels
- Sufficient color contrast ratios
- Focus indicators clearly visible

**Responsiveness**:

- Fully functional on desktop (primary use case)
- Tablet support with adapted layouts
- Mobile support for essential functions (viewing, quick edits, approvals)
- Touch-friendly tap targets on mobile
- Responsive tables that reformat or scroll on narrow screens

**Performance Indicators**:

- Loading states for all async operations
- Optimistic UI updates where safe
- Skeleton screens during initial data load
- Progress indicators for long-running operations
- Error states with clear recovery actions

**Data Visualization**:

- Stock level indicators (color-coded progress bars, badges)
- Charts for trends (stock levels over time, price history)
- Sparklines for inline metrics
- Location maps for warehouse layout
- Movement flow diagrams

### Component Categories Needed

**Navigation Components**:

- Sidebar navigation with collapsible groups
- Breadcrumb trails
- Tabs for page sections
- Pagination controls
- Back/forward buttons with context

**Data Display Components**:

- Data tables with sorting, filtering, column reordering
- Product cards (multiple sizes)
- List items (compact and expanded states)
- Detail panels with label/value pairs
- Timeline/activity feed
- Tree views for hierarchical data (categories, locations)

**Input Components**:

- Text inputs (single line, multi-line)
- Number inputs with steppers
- Date/time pickers
- Dropdowns (single select, multi-select)
- Autocomplete/typeahead search
- Tag inputs
- Toggle switches
- Checkboxes and radio buttons
- File upload with drag-and-drop
- Barcode scanner input

**Feedback Components**:

- Toast notifications (success, error, warning, info)
- Modal dialogs (confirmation, forms, detail views)
- Alert banners (system-wide messages)
- Loading spinners and progress bars
- Skeleton screens
- Empty states with illustrations
- Error states with recovery actions
- Badge indicators (counts, status)

**Action Components**:

- Primary buttons (one per screen section)
- Secondary buttons
- Tertiary/ghost buttons
- Button groups
- Split buttons with dropdown
- Icon buttons
- Floating action buttons
- Bulk action toolbars
- Context menus (right-click or kebab menu)

**Layout Components**:

- Page containers with consistent padding
- Section cards with headers
- Dividers and separators
- Collapsible sections/accordions
- Split panels with resizable dividers
- Drawers and side sheets
- Sticky headers and footers

**Specialized Components**:

- Stock level indicators with color coding
- Location selector (tree picker)
- Product selector with search
- Supplier selector with details preview
- Movement type selector with icons
- Audit item scanner interface
- Price history graph
- Reorder calculation preview

### Data Patterns

**Stock Level Indicators**:

- Above reorder point: Normal state
- Below reorder point: Warning state
- At zero: Critical/out-of-stock state
- Reserved stock: Distinguished from available
- In-transit stock: Pending state

**Status Badges**:

- Active/Inactive
- Approved/Pending/Rejected
- Completed/In Progress/Cancelled
- In Stock/Low Stock/Out of Stock
- Public/Private (for catalogs)

**User Feedback Patterns**:

- Inline validation on form fields
- Toast notifications for background operations
- Modal confirmations for destructive actions
- Success messages with undo option (where applicable)
- Error messages with specific resolution steps

**Empty States**:

- Illustrative graphic or icon
- Clear explanation of why empty
- Primary call-to-action to populate
- Secondary help link if needed

**Loading States**:

- Skeleton screens matching content layout
- Indeterminate spinners for unknown duration
- Progress bars with percentage for known duration
- Partial content display (show what's loaded, indicate what's loading)

### Interactive Patterns

**Drag and Drop**:

- Reordering lists (priority, sequence)
- Moving items between locations (in visual interfaces)
- File uploads
- Dashboard widget arrangement

**Inline Editing**:

- Click to edit field values in tables and detail views
- Show edit affordance on hover
- Save automatically on blur or require explicit save
- Cancel/revert option
- Validation feedback inline

**Bulk Operations**:

- Checkbox selection in tables
- Select all/none controls
- Persistent selection state during pagination
- Action toolbar appears when items selected
- Confirmation dialog showing count and list of affected items

**Search and Filter**:

- Instant search with debouncing
- Recent searches
- Saved filter sets
- Active filters displayed as removable chips
- Filter count badge on filter toggle
- Clear all filters action

**Contextual Actions**:

- Quick action menus on hover/focus (edit, delete, more)
- Right-click context menus on data rows
- Swipe actions on mobile
- Keyboard shortcuts displayed in tooltips

**Approval Workflows**:

- Clear visual distinction of pending vs. approved items
- Approval/rejection buttons prominent
- Reason/comment field for rejection
- Audit trail of who approved/rejected and when
- Notification to submitter of approval status

This comprehensive description provides complete business context and structural information for an AI design tool to create a professional, enterprise-grade design system without prescribing specific visual styling choices.
