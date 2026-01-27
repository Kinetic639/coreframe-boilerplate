# Phase 2: UI Primitives & Component Library

**Status:** ⚪ NOT STARTED
**Duration:** ~12 hours estimated
**Priority:** 🔴 CRITICAL - Blocks Phases 3-5
**Overall Progress:** 0%

---

## 📊 Progress Tracker

| Task                        | Status         | Duration | Components | Tests | Completion |
| --------------------------- | -------------- | -------- | ---------- | ----- | ---------- |
| 2.1 Data Display Primitives | ⚪ Not Started | 4h       | 0/9        | 0/15  | 0%         |
| 2.2 Form Primitives         | ⚪ Not Started | 3h       | 0/10       | 0/12  | 0%         |
| 2.3 Layout & Navigation     | ⚪ Not Started | 3h       | 0/7        | 0/8   | 0%         |
| 2.4 Feedback & Utilities    | ⚪ Not Started | 2h       | 0/10       | 0/10  | 0%         |

**Total:** 0/36 components | 0/45 tests | 0/12 hours | 0% complete

---

## 🎯 Phase Goal

Build a complete, reusable UI component library using shadcn/ui as the foundation. These primitives will be used across all features in Phases 3-6.

**Why This Matters:**

- Ensures UI consistency across the app
- Speeds up feature development
- Reduces code duplication
- Provides mobile-responsive patterns
- Establishes design system

---

## Task 2.1: Data Display Primitives (4 hours) ⚪

### Components to Build

#### 1. DataTable Component (2 hours)

**File:** `src/components/v2/data/data-table.tsx`

**Features:**

- [ ] Column configuration with types
- [ ] Sorting (client-side and server-side)
- [ ] Filtering per column
- [ ] Pagination (controlled)
- [ ] Row selection (single/multi)
- [ ] Loading skeleton
- [ ] Empty state
- [ ] Mobile responsive (card view)
- [ ] Custom cell renderers

**Usage Example:**

```typescript
<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', filterable: true },
    { key: 'role', label: 'Role' },
  ]}
  data={users}
  loading={isLoading}
  pagination={{ page: 1, pageSize: 10, total: 100 }}
  onSort={handleSort}
  onFilter={handleFilter}
  onPageChange={handlePageChange}
/>
```

**Test File:** `src/components/v2/data/__tests__/data-table.test.tsx`

**Checklist:**

- [ ] Component created
- [ ] All features implemented
- [ ] Mobile responsive
- [ ] Tests written (8 tests)
- [ ] Storybook stories added
- [ ] Documentation written

#### 2. Card Components (1 hour)

**Files:**

- `src/components/v2/cards/stats-card.tsx`
- `src/components/v2/cards/info-card.tsx`
- `src/components/v2/cards/list-card.tsx`
- `src/components/v2/cards/empty-state-card.tsx`

**Stats Card:**

```typescript
<StatsCard
  title="Total Users"
  value="1,234"
  trend={+12.5}
  icon={UsersIcon}
  color="blue"
/>
```

**Info Card:**

```typescript
<InfoCard
  title="Welcome"
  description="Get started with your dashboard"
  action={{ label: "Learn More", onClick: handleClick }}
/>
```

**List Card:**

```typescript
<ListCard
  title="Recent Activity"
  items={activities}
  renderItem={(item) => <ActivityItem {...item} />}
/>
```

**Empty State Card:**

```typescript
<EmptyStateCard
  icon={InboxIcon}
  title="No products yet"
  description="Create your first product to get started"
  action={{ label: "Create Product", onClick: handleCreate }}
/>
```

**Checklist:**

- [ ] 4 card components created
- [ ] All use shadcn/ui Card as base
- [ ] Tests written (4 tests)
- [ ] Documentation complete

#### 3. Chart Components (1 hour)

**Installation:**

```bash
npm install recharts
```

**Files:**

- `src/components/v2/charts/line-chart.tsx`
- `src/components/v2/charts/bar-chart.tsx`
- `src/components/v2/charts/pie-chart.tsx`
- `src/components/v2/charts/stats-display.tsx`

**Usage Example:**

```typescript
<LineChart
  data={salesData}
  xKey="date"
  yKey="revenue"
  title="Revenue Trend"
  loading={isLoading}
/>
```

**Checklist:**

- [ ] Recharts installed
- [ ] 4 chart components created
- [ ] Loading skeletons added
- [ ] Tests written (3 tests)
- [ ] Responsive design

### Definition of Done ✅

- [ ] DataTable fully functional
- [ ] 4 card variants complete
- [ ] 4 chart components complete
- [ ] 15 tests passing
- [ ] Mobile responsive
- [ ] Used in 2+ pages
- [ ] Documentation complete

---

## Task 2.2: Form Primitives (3 hours) ⚪

### Components to Build

#### 1. Form Wrapper (1 hour)

**File:** `src/components/v2/forms/form-wrapper.tsx`

**Features:**

- [ ] React Hook Form integration
- [ ] Zod schema validation
- [ ] Error display (field + form level)
- [ ] Loading state
- [ ] Success/error callbacks
- [ ] Submit button management
- [ ] Dirty state tracking

**Usage Example:**

```typescript
<FormWrapper
  schema={createProductSchema}
  onSubmit={handleSubmit}
  loading={isSubmitting}
>
  <FormField name="name" label="Product Name" />
  <FormField name="price" label="Price" type="number" />
</FormWrapper>
```

**Test File:** `src/components/v2/forms/__tests__/form-wrapper.test.tsx`

**Checklist:**

- [ ] Component created
- [ ] RHF + Zod integrated
- [ ] All features working
- [ ] Tests written (5 tests)

#### 2. Form Field Components (1 hour)

**Files:**

- `src/components/v2/forms/text-input.tsx`
- `src/components/v2/forms/textarea.tsx`
- `src/components/v2/forms/select.tsx`
- `src/components/v2/forms/multi-select.tsx`
- `src/components/v2/forms/date-picker.tsx`
- `src/components/v2/forms/file-upload.tsx`

**Features per Field:**

- [ ] Validation display
- [ ] Error messages
- [ ] Helper text
- [ ] Disabled state
- [ ] Required indicator
- [ ] shadcn/ui base components

**Checklist:**

- [ ] 6 field components created
- [ ] All use FormWrapper context
- [ ] Tests written (6 tests)

#### 3. Form Patterns (1 hour)

**Files:**

- `src/components/v2/forms/patterns/create-edit-dialog.tsx`
- `src/components/v2/forms/patterns/multi-step-form.tsx`
- `src/components/v2/forms/patterns/filter-form.tsx`
- `src/components/v2/forms/patterns/search-form.tsx`

**Create/Edit Dialog Pattern:**

```typescript
<CreateEditDialog
  title="Create Product"
  schema={productSchema}
  onSubmit={handleSubmit}
  trigger={<Button>Create Product</Button>}
/>
```

**Checklist:**

- [ ] 4 form patterns created
- [ ] Reusable across features
- [ ] Documentation with examples
- [ ] Tests written (1 test per pattern)

### Definition of Done ✅

- [ ] Form wrapper complete
- [ ] 6 field components complete
- [ ] 4 form patterns documented
- [ ] 12 tests passing
- [ ] Used in 2+ features

---

## Task 2.3: Layout & Navigation Primitives (3 hours) ⚪

### Components to Build

#### 1. Page Layout Components (1 hour)

**Files:**

- `src/components/v2/layout/page-header.tsx` (enhanced)
- `src/components/v2/layout/page-container.tsx`
- `src/components/v2/layout/section-header.tsx`
- `src/components/v2/layout/empty-state.tsx`

**Page Header:**

```typescript
<PageHeader
  title="Products"
  description="Manage your product catalog"
  breadcrumbs={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Warehouse", href: "/dashboard/warehouse" },
    { label: "Products" },
  ]}
  actions={[
    { label: "Create Product", onClick: handleCreate, icon: PlusIcon }
  ]}
/>
```

**Checklist:**

- [ ] 4 layout components created
- [ ] Responsive design
- [ ] Tests written (4 tests)

#### 2. Status Bar Component (1 hour)

**File:** `src/components/v2/layout/status-bar.tsx`

**Features:**

- [ ] Show current org
- [ ] Show current branch
- [ ] Show user info
- [ ] Quick actions dropdown
- [ ] Notification indicator
- [ ] Mobile responsive

**Checklist:**

- [ ] Component created
- [ ] All info displayed
- [ ] Mobile version works
- [ ] Tests written (2 tests)

#### 3. Navigation Enhancements (1 hour)

**Files:**

- `src/components/v2/navigation/breadcrumbs.tsx`
- `src/components/v2/navigation/mobile-drawer.tsx`
- `src/components/v2/navigation/quick-switcher.tsx`
- `src/components/v2/navigation/recent-pages.tsx`

**Quick Switcher (Cmd+K):**

```typescript
<QuickSwitcher
  items={[
    { label: "Products", href: "/dashboard/warehouse/products" },
    { label: "Users", href: "/dashboard/organization/users" },
  ]}
  onSelect={handleSelect}
/>
```

**Checklist:**

- [ ] 4 navigation components created
- [ ] Keyboard shortcuts work
- [ ] Tests written (2 tests)

### Definition of Done ✅

- [ ] Layout components reusable
- [ ] Status bar complete
- [ ] Navigation works on mobile
- [ ] Quick switcher functional
- [ ] 8 tests passing
- [ ] Used across dashboard

---

## Task 2.4: Feedback & Utility Primitives (2 hours) ⚪

### Components to Build

#### 1. Feedback Components (1 hour)

**Files:**

- `src/components/v2/feedback/loading-skeleton.tsx`
- `src/components/v2/feedback/error-boundary.tsx`
- `src/components/v2/feedback/toast-patterns.tsx`
- `src/components/v2/feedback/confirmation-dialog.tsx`
- `src/components/v2/feedback/progress-indicator.tsx`

**Loading Skeleton Patterns:**

```typescript
<TableSkeleton rows={5} />
<FormSkeleton fields={3} />
<CardSkeleton />
```

**Confirmation Dialog:**

```typescript
<ConfirmationDialog
  title="Delete Product"
  description="Are you sure? This cannot be undone."
  confirmLabel="Delete"
  confirmVariant="destructive"
  onConfirm={handleDelete}
/>
```

**Checklist:**

- [ ] 5 feedback components created
- [ ] Toast uses react-toastify
- [ ] Tests written (5 tests)

#### 2. Utility Components (1 hour)

**Files:**

- `src/components/v2/utils/copy-to-clipboard.tsx`
- `src/components/v2/utils/tooltip.tsx`
- `src/components/v2/utils/badge.tsx`
- `src/components/v2/utils/avatar.tsx`
- `src/components/v2/utils/icon-library.tsx`

**Copy to Clipboard:**

```typescript
<CopyToClipboard text={apiKey}>
  <Button>Copy API Key</Button>
</CopyToClipboard>
```

**Badge:**

```typescript
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Inactive</Badge>
```

**Checklist:**

- [ ] 5 utility components created
- [ ] All use shadcn/ui base
- [ ] Tests written (5 tests)

### Definition of Done ✅

- [ ] All feedback components work
- [ ] All utility components work
- [ ] Toast notifications consistent
- [ ] Error boundaries catch errors
- [ ] 10 tests passing
- [ ] Documentation complete

---

## 📈 Success Metrics

- [ ] **36 components created** - Complete UI library
- [ ] **All primitives documented** - Usage examples
- [ ] **Used in 5+ pages** - Validated in real use
- [ ] **Mobile responsive** - Works on all devices
- [ ] **45+ tests passing** - Well tested (60%+ coverage)
- [ ] **Storybook stories** - Visual documentation
- [ ] **Performance** - No rendering issues

---

## 📚 Documentation to Create

### Component Documentation

**File:** `docs/coreframe-rebuild/Phase-2-UI-Primitives/COMPONENT_LIBRARY.md`

**Contents:**

- Component catalog with screenshots
- Usage examples for each component
- Props documentation
- Best practices
- Common patterns
- Accessibility notes

### Style Guide

**File:** `docs/coreframe-rebuild/Phase-2-UI-Primitives/STYLE_GUIDE.md`

**Contents:**

- Color palette
- Typography scale
- Spacing system
- Component variants
- Mobile patterns

---

## 🚨 Important Notes

### shadcn/ui First

**ALWAYS check shadcn/ui before building:**

```bash
# Check available components
npx shadcn@latest add --help

# Add a component
npx shadcn@latest add button
npx shadcn@latest add form
npx shadcn@latest add dialog
```

### react-toastify Only

**NEVER use sonner or other toast libraries:**

```typescript
// ✅ CORRECT
import { toast } from "react-toastify";
toast.success("Product created");

// ❌ WRONG
import { toast } from "sonner";
```

### Mobile First

**Design for mobile, enhance for desktop:**

- Use responsive breakpoints
- Touch-friendly targets (44px min)
- Mobile navigation patterns
- Test on real devices

---

## 🔄 Next Steps

After Phase 2 completion:

- Move to Phase 3: User Management
- Use new primitives to build features
- Iterate on components based on usage

---

**Last Updated:** 2026-01-27
**Status:** ⚪ Not Started
**Blocks:** Phases 3, 4, 5
**Next Task:** 2.1 Data Display Primitives
