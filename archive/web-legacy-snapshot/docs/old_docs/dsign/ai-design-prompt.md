# AI Design Tool Prompt for CoreFrame WMS/VMI Application

## Your Task

You are tasked with creating a complete, professional, enterprise-grade design system and UI wireframes for CoreFrame, a Warehouse Management System (WMS) and Vendor Managed Inventory (VMI) platform. This is a serious B2B enterprise application used daily by warehouse operators, inventory managers, and procurement specialists.

**Critical Instructions**:

- DO NOT use the existing UI as reference - you are creating everything from scratch
- Focus on creating a modern, professional, enterprise-grade design system
- Prioritize information density, efficiency, and clarity
- Design for users who spend 8+ hours daily in the application
- Think SAP, Oracle, Microsoft Dynamics - enterprise software done right
- Use best practices from leading enterprise applications

## Application Context

Read the complete application description below carefully. This application includes:

---

[INCLUDE COMPLETE CONTENT FROM application-description.md HERE]

---

## Phase 1: Design System Creation

Create a comprehensive design system that includes:

### Visual Foundation

**Color System**:

- Primary brand colors for key actions and navigation
- Module-specific accent colors (Green for Warehouse, Purple for Teams, Indigo for Organization Management)
- Semantic colors for status indicators (success, warning, error, info)
- Neutral grays for backgrounds, borders, and text hierarchy
- Data visualization palette (for charts and stock indicators)
- Color system should work in both light and dark modes (if creating dark mode)

**Typography Scale**:

- Font selection appropriate for data-dense enterprise application (excellent readability at various sizes)
- Type scale for headings (H1-H6)
- Body text sizes (regular, small, large)
- Font weights for hierarchy (regular, medium, semibold, bold)
- Line heights optimized for readability and density
- Letter spacing adjustments where needed

**Spacing System**:

- Consistent spacing scale (e.g., 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
- Padding and margin conventions
- Component-specific spacing rules
- Responsive spacing adjustments

**Elevation/Depth**:

- Shadow system for cards, modals, dropdowns
- Border conventions
- Layering and z-index structure

**Iconography**:

- Icon style (outline, filled, or mixed approach)
- Icon sizes (16px, 20px, 24px, 32px)
- Movement type icons for warehouse operations
- Status indicator icons
- Navigation icons

### Component Library

Design all components mentioned in the "Component Categories Needed" section of the application description, including but not limited to:

**Navigation**: Sidebar, breadcrumbs, tabs, pagination
**Data Display**: Tables, cards, lists, timelines, trees
**Inputs**: Text fields, selects, date pickers, toggles, checkboxes, file uploads
**Feedback**: Toasts, modals, alerts, loading states, empty states, error states
**Actions**: Buttons (primary, secondary, tertiary), button groups, context menus
**Layout**: Containers, cards, dividers, collapsible sections

For each component, define:

- Visual appearance in all states (default, hover, focus, active, disabled, error)
- Spacing and sizing variations
- Accessibility considerations (focus indicators, ARIA patterns)
- Responsive behavior
- Usage guidelines

### Patterns and Interactions

Define interaction patterns for:

- **Stock level indicators**: How to visually represent stock status (normal, low, critical, out of stock)
- **Status badges**: Visual treatment for different status types
- **Inline editing**: How edit mode is triggered and confirmed
- **Bulk operations**: Selection UI and bulk action toolbar
- **Approval workflows**: Visual distinction between pending/approved/rejected states
- **Search and filters**: Active filters display, filter panels, search suggestions
- **Loading and empty states**: Skeleton screens, empty state illustrations
- **Data tables**: Column sorting, row selection, expandable rows, responsive behavior

## Phase 2: Core Wireframes

Create high-fidelity wireframes (applying your design system) for the following:

### 1. Dashboard Shell (Global Layout)

Design the complete dashboard layout structure showing:

**Sidebar Navigation**:

- Collapsed and expanded states
- Organization and branch selector at top
- Module groups with navigation items (showing hierarchy from application description)
- Active state highlighting
- User profile section at bottom
- Mobile/tablet responsive behavior (overlay drawer)

**Header Bar**:

- Breadcrumb navigation
- Global search bar (with expanded and collapsed states)
- Search suggestions dropdown
- Notification bell with badge counter
- Language selector
- User avatar with dropdown menu
- Responsive behavior (which elements hide/reorder on smaller screens)

**Main Content Area**:

- Page container structure
- Typical page header layout (title, description, primary actions)
- Content area with scrolling behavior
- How filters/toolbars integrate with content

**Status Bar**:

- Connection status indicator
- Active context display (org + branch)
- Background task progress indicators
- System information
- Help link
- Collapsed state

Show this layout in:

- Desktop (expanded sidebar)
- Desktop (collapsed sidebar)
- Tablet view
- Mobile view

### 2. Home Dashboard Page

Design the home dashboard (`/dashboard/start`) showing:

**Page Structure**:

- Page header with welcome message and date/time
- Widget grid layout (responsive)

**Widgets to Design**:

- **Key Metrics Cards** (4 cards):
  - Stock value
  - Low stock items count
  - Pending movements count
  - Active audits count
  - Each card should show: metric value, label, icon, trend indicator, click target

- **Recent Activity Feed**:
  - Timeline of recent stock movements
  - Each entry: icon, action description, timestamp, user
  - "View All" link at bottom

- **News & Announcements**:
  - Card showing 2-3 recent announcements
  - Each: title, date, preview text, "Read More" link
  - "View All News" link

- **Quick Actions Grid**:
  - 6-8 most common action buttons with icons
  - Examples: "Receive Shipment", "Create Transfer", "Start Audit", "Add Product"

- **Alerts Panel**:
  - Critical alerts requiring attention
  - Each alert: severity indicator, message, dismiss action, primary action button
  - Examples: "12 products out of stock", "5 movements pending approval"

Show responsive breakpoints:

- 4-column layout (desktop large)
- 3-column layout (desktop standard)
- 2-column layout (tablet)
- 1-column layout (mobile)

### 3. Products List Page

Design the products list page (`/dashboard/warehouse/products`) showing:

**Left Sidebar - Filters Panel** (collapsible):

- Filter section headers: Search, Category, Supplier, Tags, Price Range, Stock Status
- Active filters display at top (chips with remove action)
- Clear all filters button
- Collapsed state (just icon + active filter count badge)

**Main Content - Toolbar**:

- View mode toggles: Grid, List, Table (with icons, active state)
- Sort dropdown with current selection visible
- Bulk actions dropdown (enabled when items selected)
- "Create Product" primary button (prominent, right-aligned)

**Content Area - Design all three view modes**:

**Grid View**:

- 4-column responsive grid of product cards
- Each card shows:
  - Product image (with placeholder for no image)
  - Product name (truncated with tooltip on hover)
  - SKU in smaller text
  - Stock level indicator (visual bar + number)
  - Price prominently displayed
  - Quick action menu (three dots icon)
- Hover state showing more details or quick actions
- Selected state (for bulk operations)

**List View**:

- Compact rows with horizontal layout
- Each row: checkbox, thumbnail, name, SKU, category, stock indicator, price, action menu
- Alternating row background for easier scanning
- Hover state
- Selected state

**Table View**:

- Full data table with columns:
  - Checkbox column (narrow)
  - Image (small thumbnail)
  - Name (sortable)
  - SKU (sortable)
  - Category
  - Supplier
  - Stock (sortable, with visual indicator)
  - Reorder Point
  - Price (sortable)
  - Status badge
  - Actions (menu)
- Column headers with sort indicators
- Row hover state
- Row selection state
- Expandable row detail (collapsed and expanded states)
- Sticky header on scroll

**Pagination**:

- Page numbers (current page highlighted, max 7 page buttons)
- Previous/Next buttons
- Items per page selector
- Total count display ("Showing 1-25 of 347 products")

**States to Show**:

- Empty state (no products exist): Illustration + message + CTA button
- No results state (filters return nothing): Message + "Clear Filters" button
- Loading state: Skeleton screens for selected view mode
- Bulk selection active: Toolbar appears showing "X items selected", bulk actions, deselect all

### 4. Product Detail Page

Design the product detail page (`/dashboard/warehouse/products/[id]`) showing:

**Product Header**:

- Left side: Product name (with inline edit affordance), SKU, barcode, category breadcrumb, status badge
- Right side: Edit button, Duplicate button, Delete button, More actions dropdown

**Layout Structure**:

**Left Sidebar (Narrow)**:

- **Image Gallery Section**:
  - Large main image
  - Thumbnail strip below (4-5 thumbnails)
  - Upload button
  - Image placeholder if no images

- **Quick Stats Card**:
  - Total stock quantity (large number with unit)
  - Stock value (calculated)
  - Reorder point with progress bar visualization
  - Stock status label (color-coded)

- **Stock by Location Widget**:
  - Mini bar chart showing top 5 locations
  - Each bar: location name, quantity, visual bar
  - "View All Locations" link

- **Tags Section**:
  - Tag chips (removable)
  - "+ Add Tag" button

**Main Content Area (Right)**:

**Tab Navigation**:

- Tabs: Overview, Purchase & Sales, Inventory, Suppliers, Stock Movements, Audit History, Custom Fields
- Active tab indicator
- Tab scroll behavior if too many tabs for viewport

**Overview Tab Content**:

- **Basic Information Card**:
  - Section header with "Edit" button
  - Label/value pairs in 2-column grid:
    - Name, SKU, Description (multi-line)
    - Category, Brand, Manufacturer
    - Unit of measure
    - Returnable item (yes/no badge)
  - View mode and edit mode (show both states)

- **Identifiers Card**:
  - Section header
  - Grid of identifier fields: UPC, EAN, ISBN, MPN
  - Barcodes list showing barcode number and primary indicator
  - "Add Barcode" button

- **Measurements Card**:
  - Dimensions display (L × W × H with unit)
  - Weight display (value with unit)
  - Edit mode showing input fields

**Purchase & Sales Tab Content**:

- Two side-by-side cards:
  - **Purchase Information Card**: Cost price, purchase account, description
  - **Sales Information Card**: Selling price, sales account, description, calculated profit margin
- Each card has edit mode toggle

**Inventory Tab Content**:

- **Inventory Settings Card**: Track inventory toggle, inventory account, opening stock fields

- **Replenishment Settings Card**:
  - Reorder point field
  - Calculation method selector (radio buttons or segmented control): Fixed, Min/Max, Auto
  - Conditional fields based on method:
    - Fixed: Reorder quantity field
    - Min/Max: Maximum stock level field
  - Lead time days
  - Low stock alerts toggle
  - **Visual preview panel** showing calculation logic with sample numbers

- **Current Stock Summary Table**:
  - Columns: Location, Available, Reserved, In Transit, Total
  - Data rows with quantities
  - Grand total row (visually distinct)
  - "View Stock Movements" link

**Suppliers Tab Content**:

- Toolbar with "Add Supplier" button and active/inactive filter

- **Suppliers Table**:
  - Columns: Supplier Name, Supplier SKU, Unit Price, Lead Time, Packaging, Status, Actions
  - Rows showing:
    - Supplier name with star icon if preferred
    - Supplier SKU
    - Price with currency
    - Lead time (number + "days")
    - Packaging info (quantity/unit with "Full only" badge if no partials)
    - Active/Inactive badge
    - Actions dropdown: Edit, Set as Preferred, Remove
  - Hover state on rows

- Empty state: "No suppliers configured" message with "Add First Supplier" button

**Stock Movements Tab Content**:

- **Filter bar**: Date range picker, movement type dropdown, status filter

- **Movements Timeline**:
  - Vertical timeline with entries
  - Each entry card shows:
    - Movement type icon and label
    - Date and time
    - Source → Destination (with arrow)
    - Quantity with +/- indicator and color
    - Document reference number
    - Status badge
    - Created by user avatar + name
  - Click target for full detail

- **Summary Stats Box**:
  - Three metrics: Total Received, Total Issued, Net Change
  - Each with icon and number

**Audit History Tab Content**:

- List of audit cards
- Each card shows:
  - Audit date prominently
  - Location audited
  - Expected vs. Actual quantities (side by side comparison)
  - Discrepancy with color indicator (red/green based on direction)
  - Auditor name
  - Notes text
  - "View Full Audit" link
- Empty state: "No audits performed yet"

**Custom Fields Tab Content**:

- "Add Custom Field" dropdown selector at top
- List of added custom fields:
  - Each row: Field name, field type badge, value with inline edit, remove button
- Empty state: "No custom fields added" with explanation and "Add Field" prompt

**Page States to Show**:

- Normal state with all data populated
- Loading state (skeleton screen)
- Edit mode for a section (inline editing active)
- Empty states for tabs with no data (Suppliers, Audits, Custom Fields)

## Deliverables

For each deliverable, apply your design system consistently:

1. **Design System Documentation**:
   - Color palette with hex codes and usage guidelines
   - Typography scale with specifications
   - Spacing system
   - Component library with all states
   - Interaction patterns
   - Icon set

2. **Wireframes/Mockups**:
   - Dashboard shell (4 responsive breakpoints)
   - Home dashboard page (3 breakpoints)
   - Products list page with all 3 view modes
   - Product detail page with multiple tab contents shown
   - All key component states demonstrated
   - Annotations explaining interactions

3. **Design Specifications**:
   - Measurements and spacing
   - Responsive breakpoint rules
   - Animation/transition guidelines
   - Accessibility notes

## Design Philosophy to Follow

**Information Density**:

- Pack information efficiently without feeling cramped
- Use whitespace strategically to create breathing room
- Employ visual hierarchy (size, weight, color) to guide attention
- Tables and lists should be scannable at a glance

**Efficiency**:

- Minimize clicks to complete tasks
- Inline editing where appropriate
- Quick actions accessible on hover/focus
- Keyboard shortcuts supported (show hint on tooltip)
- Smart defaults and auto-save where safe

**Clarity**:

- Clear labels and descriptions
- Obvious interactive elements (buttons, links, clickable areas)
- Feedback for all actions (loading, success, error)
- Consistent terminology throughout

**Professional Polish**:

- Subtle animations and transitions (not distracting)
- Consistent component spacing and alignment
- Attention to detail in hover/focus states
- Polished icons and illustrations
- High contrast for readability

**Trustworthiness**:

- Confirmation dialogs for destructive actions
- Clear undo options where possible
- Validation feedback inline and helpful
- Error messages with specific resolution steps
- System status always visible

## Reference Quality Standards

Your design should feel comparable to the quality and professionalism of:

- SAP Fiori design system
- Microsoft Fluent UI
- Atlassian Design System
- Salesforce Lightning Design System
- Google Material Design (enterprise implementations)
- Oracle Redwood Design System

These are examples of enterprise design done right - professional, efficient, information-dense, accessible, and polished.

## Important Notes

- Do NOT carry over any visual styling from the current application
- Start completely fresh with modern enterprise design thinking
- Focus on creating a system that scales across all modules
- Design should work for users spending entire workdays in the application
- Prioritize efficiency and information density over decorative elements
- Every design decision should serve the business users and their daily workflows

---

Begin by creating the design system foundation (colors, typography, spacing, key components), then apply it to the wireframes for the dashboard shell and three specified pages. Ensure consistency across all deliverables.
