# Main Content Page V2 - Component Verification & Progress Tracker

**Component**: Main Content Page (Page Templates & Layouts)
**Files**: `src/app/[locale]/dashboard/*/page.tsx` and shared layouts
**Created**: TBD
**Updated**: 2026-01-19
**Status**: ⬜ Not Started

---

## Progress Overview

| Category              | Progress      | Status             |
| --------------------- | ------------- | ------------------ |
| Page Layout Structure | 0% (0/8)      | ⬜ Not Started     |
| Page Templates        | 0% (0/6)      | ⬜ Not Started     |
| Content Patterns      | 0% (0/10)     | ⬜ Not Started     |
| Loading States        | 0% (0/6)      | ⬜ Not Started     |
| Error States          | 0% (0/5)      | ⬜ Not Started     |
| Empty States          | 0% (0/4)      | ⬜ Not Started     |
| Responsiveness        | 0% (0/6)      | ⬜ Not Started     |
| Accessibility         | 0% (0/5)      | ⬜ Not Started     |
| **TOTAL**             | **0% (0/50)** | **⬜ Not Started** |

---

## Page Layout Structure Checklist

### Container & Spacing

- [ ] Page wrapper with proper padding
- [ ] Max-width container for large screens (optional)
- [ ] Consistent spacing between sections
- [ ] Proper margin from header and status bar
- [ ] No horizontal scroll on any screen size

### Page Header

- [ ] Page title (H1)
- [ ] Optional subtitle/description
- [ ] Action buttons (Create, Export, etc.) aligned right
- [ ] Breadcrumbs (if not in dashboard header)
- [ ] Responsive layout (stack on mobile)

### Content Area

- [ ] Main content section with proper padding
- [ ] Sidebar/aside sections (if applicable)
- [ ] Card-based layouts where appropriate
- [ ] Table layouts for data
- [ ] Grid layouts for dashboards

---

## Page Templates Checklist

### List/Table Page

- [ ] Data table with sorting, filtering, pagination
- [ ] Search/filter controls
- [ ] Bulk actions (select all, delete, etc.)
- [ ] Empty state when no data
- [ ] Loading skeleton for table rows

### Detail/View Page

- [ ] Header with entity name and actions (Edit, Delete)
- [ ] Tabbed interface for different sections
- [ ] Read-only data display
- [ ] Related items/associations
- [ ] Audit log (optional)

### Form/Create Page

- [ ] Form layout with proper spacing
- [ ] Input validation and error messages
- [ ] Submit and Cancel buttons
- [ ] Unsaved changes warning
- [ ] Loading state during submission

### Dashboard/Overview Page

- [ ] Widget/card grid layout
- [ ] Stats/metrics cards
- [ ] Charts and visualizations
- [ ] Recent activity feed
- [ ] Quick actions

---

## Content Patterns Checklist

### Cards

- [ ] Consistent card design (shadcn/ui Card component)
- [ ] Card header with title and actions
- [ ] Card content with proper padding
- [ ] Card footer (optional)
- [ ] Hover states (if interactive)

### Data Tables

- [ ] Uses shadcn/ui Table or TanStack Table
- [ ] Column sorting
- [ ] Row selection
- [ ] Pagination controls
- [ ] Column visibility toggle
- [ ] Responsive (horizontal scroll or stacked)

### Forms

- [ ] Uses react-hook-form with zod validation
- [ ] Consistent input styling (shadcn/ui components)
- [ ] Inline validation errors
- [ ] Field-level help text
- [ ] Submit button disabled during loading

### Stats/Metrics

- [ ] Stat cards with icon, label, value
- [ ] Trend indicators (up/down arrows)
- [ ] Percentage changes
- [ ] Time period selector
- [ ] Responsive grid layout

---

## Loading States Checklist

### Page-Level Loading

- [ ] Full page loading skeleton
- [ ] Shimmer/pulse animation
- [ ] Proper layout structure maintained
- [ ] No layout shift when data loads

### Component-Level Loading

- [ ] Spinner for async actions (buttons, etc.)
- [ ] Loading cards for dashboard widgets
- [ ] Table skeleton rows
- [ ] Optimistic UI updates (where appropriate)

### Suspense Boundaries

- [ ] Strategic Suspense boundaries for code splitting
- [ ] Loading fallbacks for lazy-loaded components
- [ ] No full page spinner unless necessary

---

## Error States Checklist

### Error Boundaries

- [ ] Page-level error boundary
- [ ] Component-level error boundaries (optional)
- [ ] User-friendly error messages
- [ ] Retry button or recovery action
- [ ] Error logged for debugging

### Inline Errors

- [ ] Form validation errors inline
- [ ] Failed data fetch shows error message
- [ ] Network error handling
- [ ] Permission denied messages

---

## Empty States Checklist

### No Data

- [ ] Illustration or icon
- [ ] Clear message explaining why empty
- [ ] Call-to-action button (e.g., "Create First Item")
- [ ] Help text or documentation link

### No Search Results

- [ ] Message indicating no results found
- [ ] Suggestions to broaden search
- [ ] Clear filters button

---

## Responsiveness Checklist

### Desktop (>1024px)

- [ ] Multi-column layouts work well
- [ ] Tables display full width
- [ ] Sidebar content visible
- [ ] Proper spacing and margins

### Tablet (768px - 1024px)

- [ ] Layouts adapt (reduce columns)
- [ ] Tables may scroll horizontally
- [ ] Forms remain usable
- [ ] Actions remain accessible

### Mobile (<768px)

- [ ] Single column layout
- [ ] Tables stack or scroll
- [ ] Forms stack vertically
- [ ] Touch-friendly buttons (min 44px height)
- [ ] No text truncation for critical info

---

## Accessibility Checklist

### Semantic HTML

- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] Semantic elements (`<main>`, `<section>`, `<article>`)
- [ ] ARIA landmarks where appropriate
- [ ] Form labels associated with inputs

### Keyboard Navigation

- [ ] All interactive elements focusable
- [ ] Logical tab order
- [ ] Skip links for long pages
- [ ] Focus visible on all elements

---

## Integration Points

### Data Fetching

- Server Components for initial data (SSR)
- React Query for client-side data
- Suspense boundaries for streaming
- Error boundaries for failures

### Permission Gating

```tsx
// Hide features based on permissions
const { can } = usePermissions();

return (
  <div>
    {can("warehouse.products.read") && <ProductList />}
    {can("warehouse.products.create") && <Button>Create Product</Button>}
  </div>
);
```

### Module-Specific Pages

- Pages live in module directories
- Module config defines routes
- Dynamic imports for code splitting
- Shared layouts from `_components`

---

## Manual Testing Checklist

### Visual Testing

- [ ] Page layouts look correct on all screen sizes
- [ ] No layout shift during loading
- [ ] Consistent spacing and alignment
- [ ] Cards/tables render properly
- [ ] Forms are usable and clear

### Functional Testing

- [ ] Data loads correctly
- [ ] Forms submit successfully
- [ ] Validation works
- [ ] Error states display properly
- [ ] Empty states display correctly
- [ ] Loading states show and hide correctly

### Cross-Browser Testing

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

---

## Page Template Examples

### List Page Template

```tsx
// src/app/[locale]/dashboard/warehouse/products/page.tsx
export default async function ProductsPage() {
  const context = await loadDashboardContextV2();
  if (!context) redirect("/sign-in");

  // SSR initial data load
  const initialProducts = await getProducts();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your warehouse inventory</p>
        </div>
        <HasAnyRoleServer roles={["branch_admin"]}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Product
          </Button>
        </HasAnyRoleServer>
      </div>

      {/* Filters */}
      <ProductFilters />

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          <ProductTable initialData={initialProducts} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Dashboard Page Template

```tsx
// src/app/[locale]/dashboard/start/page.tsx
export default async function DashboardHomePage() {
  const context = await loadDashboardContextV2();
  if (!context) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {context.user.user?.first_name}</h1>
        <p className="text-muted-foreground">Here's what's happening today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatCardSkeleton />}>
          <StatsCards />
        </Suspense>
      </div>

      {/* Widgets Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton />}>
          <RecentActivity />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <QuickActions />
        </Suspense>
      </div>
    </div>
  );
}
```

### Detail Page Template

```tsx
// src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx
export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const context = await loadDashboardContextV2();
  if (!context) redirect("/sign-in");

  const product = await getProduct(params.id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">SKU: {product.sku}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductDetails product={product} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <ProductInventory productId={product.id} />
        </TabsContent>

        <TabsContent value="history">
          <ProductHistory productId={product.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Shared Layout Components

### PageHeader Component

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

### EmptyState Component

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

---

## Performance Benchmarks

- [ ] Initial page load < 2 seconds (LCP)
- [ ] Time to interactive < 3 seconds
- [ ] No layout shift (CLS = 0)
- [ ] Smooth scrolling (60fps)
- [ ] Data tables paginated (max 100 rows at a time)

---

## Accessibility Audit

- [ ] Lighthouse Accessibility score > 95
- [ ] axe DevTools: 0 violations
- [ ] Keyboard navigation works on all pages
- [ ] Screen reader tested
- [ ] Proper heading hierarchy

---

## Sign-Off Checklist

- [ ] All checkboxes above completed
- [ ] Code reviewed
- [ ] Visual design approved
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Works on all target browsers/devices
- [ ] No console errors or warnings

**Ready for Production**: ⬜ NO

---

## Notes

- Main content pages are module-specific - each module defines its own pages
- Shared layouts and components live in `src/components/v2/layout/`
- Always use SSR for initial data load when possible
- Use Suspense boundaries strategically for progressive loading
- Permission checks must happen both server-side (RLS) and client-side (UI)
- Consistent page structure improves user experience and maintainability
