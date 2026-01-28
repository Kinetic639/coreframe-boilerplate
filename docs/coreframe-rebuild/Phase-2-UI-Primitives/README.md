# Phase 2: UI Primitives & Component Library

**Status:** 🔵 IN PROGRESS - Starting Implementation
**Duration:** ~10 hours estimated (revised scope)
**Priority:** 🔴 CRITICAL - Blocks Phases 3-5
**Overall Progress:** 6/31 components (19% - layout components from Phase 0)
**Updated:** 2026-01-28

---

## 📊 Current State Analysis

### What's Already Built ✅

**V2 Layout Components (6 components from Phase 0):**

- ✅ `dashboard-header.tsx` - Header with sidebar toggle, search, notifications, user menu
- ✅ `sidebar.tsx` - Navigation sidebar with branch switcher, module navigation
- ✅ `page-header.tsx` - Page header with breadcrumbs, title, description, actions
- ✅ `branch-switcher.tsx` - Branch switching with popover/command UI
- ✅ `header-search.tsx` - Global search with Cmd+K command palette
- ✅ `header-notifications.tsx` - Notifications placeholder

**Debug Components (1 component):**

- ✅ `permission-debug-panel.tsx` - Comprehensive permission debugging UI

**Infrastructure:**

- ✅ 40+ shadcn/ui components installed
- ✅ react-toastify for toast notifications
- ✅ V2 stores, loaders, providers working
- ✅ Dashboard V2 layout complete with SSR

**Admin Dashboard:**

- ⚠️ Basic skeleton structure exists
- ❌ Not using v2 components (needs refactor)
- ❌ No primitives preview page

### What's Missing ❌

**Form Primitives (10 components):**

- ❌ FormWrapper with RHF + Zod
- ❌ 6 field components (TextInput, Textarea, Select, MultiSelect, DatePicker, FileUpload)
- ❌ 3 form patterns (CreateEditDialog, FilterForm, SearchForm)

**Layout & Navigation (4 components):**

- ❌ StatusBar
- ❌ Breadcrumbs
- ❌ MobileDrawer
- ❌ QuickSwitcher (Cmd+K)

**Feedback Components (5 components):**

- ❌ LoadingSkeleton patterns
- ❌ ErrorBoundary
- ❌ ToastPatterns (react-toastify wrappers)
- ❌ ConfirmationDialog
- ❌ ProgressIndicator

**Utility Components (5 components):**

- ❌ CopyToClipboard
- ❌ Tooltip (shadcn wrapper)
- ❌ Badge (enhanced)
- ❌ Avatar (enhanced)
- ❌ IconLibrary

**Admin Integration:**

- ❌ Admin layout not using v2 architecture
- ❌ Admin sidebar not using v2 components
- ❌ No primitives preview page

### Deferred to Later Phases 🔵

**Data Display Primitives (deferred per user request):**

- 🔵 DataTable with sorting, filtering, pagination
- 🔵 Card variants (StatsCard, InfoCard, ListCard, EmptyStateCard)
- 🔵 Charts (LineChart, BarChart, PieChart, StatsDisplay)

**Reason:** These will be built when needed during User/Org Management phases (Phases 3-4)

---

## 📋 Revised Progress Tracker

| Task                                | Components | Tests    | Duration | Status         |
| ----------------------------------- | ---------- | -------- | -------- | -------------- |
| **2.0** Layout (Pre-built)          | 6/6        | 1/1      | ✅       | Complete       |
| **2.2** Form Primitives             | 0/10       | 0/12     | 3h       | ⚪ Not Started |
| **2.3** Layout & Navigation         | 0/4        | 0/6      | 2h       | ⚪ Not Started |
| **2.4** Feedback & Utilities        | 0/10       | 0/10     | 2h       | ⚪ Not Started |
| **2.5** Admin Dashboard Integration | N/A        | 0/4      | 2h       | ⚪ Not Started |
| **2.6** Primitives Preview Page     | 0/1        | 0/2      | 1h       | ⚪ Not Started |
| **TOTAL**                           | **6/31**   | **1/35** | **10h**  | **19%**        |

---

## 🎯 Phase Goal

Build a complete, production-ready UI component library for the v2 dashboard using:

- **TDD approach** (write tests first)
- **shadcn/ui base** (never reinvent what exists)
- **react-hook-form + zod** (forms)
- **react-toastify** (toasts, NOT sonner)
- **Mobile-first** (responsive by default)
- **SSR-compatible** (server components where possible)

**Why This Matters:**

- Ensures UI consistency across all features
- Speeds up development in Phases 3-6
- Reduces code duplication
- Provides mobile-responsive patterns
- Establishes design system

---

## Task 2.2: Form Primitives (3 hours) 🔴 CRITICAL

### Goal

Build comprehensive form system with React Hook Form + Zod validation, shadcn/ui base components, full error handling, and mobile-responsive design.

### shadcn/ui Components Needed

**Already Installed:**

- ✅ button, input, label, textarea, select, form, dialog, checkbox, switch

**Need to Install:**

```bash
npx shadcn@latest add calendar
npx shadcn@latest add popover
```

### Component 2.2.1: FormWrapper (30 min)

**File:** `src/components/v2/forms/form-wrapper.tsx`

**Features:**

- Integrate `useForm` from react-hook-form with `zodResolver`
- Accept Zod schema as prop
- Display field-level errors using shadcn/ui FieldError
- Display form-level errors in alert banner
- Loading state disables all fields + shows spinner
- Submit button management (disabled during loading)
- Success/error callbacks
- Toast notifications (react-toastify)

**Props Interface:**

```typescript
interface FormWrapperProps<T extends z.ZodType> {
  schema: T;
  onSubmit: (data: z.infer<T>) => Promise<void> | void;
  defaultValues?: Partial<z.infer<T>>;
  loading?: boolean;
  children: React.ReactNode;
  submitLabel?: string;
  resetLabel?: string;
  onSuccess?: (data: z.infer<T>) => void;
  onError?: (error: Error) => void;
  className?: string;
}
```

**Usage Example:**

```typescript
<FormWrapper
  schema={createProductSchema}
  onSubmit={handleSubmit}
  loading={isSubmitting}
  submitLabel="Create Product"
>
  <TextInput name="name" label="Product Name" />
  <Textarea name="description" label="Description" />
  <Select name="category" label="Category" options={categories} />
</FormWrapper>
```

**Test File:** `src/components/v2/forms/__tests__/form-wrapper.test.tsx`

**Test Cases (5 tests):**

1. Renders children and form elements
2. Validates with Zod schema on submit
3. Displays field-level errors correctly
4. Disables fields during loading state
5. Calls onSuccess with validated data

**Checklist:**

- [ ] Component created with TypeScript generics
- [ ] RHF + Zod integrated
- [ ] Error display working (field + form level)
- [ ] Loading state implemented
- [ ] Toast notifications on success/error
- [ ] 5 tests passing
- [ ] Mobile responsive

---

### Component 2.2.2-2.2.7: Field Components (1.5 hours)

All field components integrate with FormWrapper via React Hook Form's Controller.

#### 2.2.2: TextInput (15 min)

**File:** `src/components/v2/forms/text-input.tsx`

**Features:**

- Uses shadcn/ui Input
- Label, description, error from RHF Controller
- Prefix/suffix icon support
- Character count (optional)
- Disabled state
- Required indicator

**Props:**

```typescript
interface TextInputProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "url" | "tel";
  disabled?: boolean;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  maxLength?: number;
}
```

**Usage:**

```typescript
<TextInput
  name="email"
  label="Email Address"
  type="email"
  description="We'll never share your email"
  required
/>
```

**Test:** Renders label, displays error, integrates with RHF

---

#### 2.2.3: Textarea (15 min)

**File:** `src/components/v2/forms/textarea.tsx`

**Features:**

- Uses shadcn/ui Textarea
- Character count with limit
- Rows prop for height
- Auto-resize option

**Props:**

```typescript
interface TextareaProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoResize?: boolean;
  disabled?: boolean;
  required?: boolean;
}
```

**Usage:**

```typescript
<Textarea
  name="description"
  label="Product Description"
  rows={4}
  maxLength={500}
  description="Provide a detailed description"
/>
```

**Test:** Character count updates, max length enforced

---

#### 2.2.4: Select (15 min)

**File:** `src/components/v2/forms/select.tsx`

**Features:**

- Uses shadcn/ui Select
- Options array with label/value
- Searchable option (with Command)
- Empty state
- Custom trigger

**Props:**

```typescript
interface SelectOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps {
  name: string;
  label: string;
  description?: string;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
}
```

**Usage:**

```typescript
<Select
  name="category"
  label="Category"
  options={[
    { label: "Electronics", value: "electronics" },
    { label: "Clothing", value: "clothing" },
    { label: "Food", value: "food" },
  ]}
  searchable
  required
/>
```

**Test:** Displays options, selection works, search filters

---

#### 2.2.5: MultiSelect (20 min)

**File:** `src/components/v2/forms/multi-select.tsx`

**Features:**

- Multiple selection with checkboxes
- Selected items as chips/badges
- Clear all button
- Max selections limit

**Props:**

```typescript
interface MultiSelectProps {
  name: string;
  label: string;
  description?: string;
  options: SelectOption[];
  placeholder?: string;
  maxSelections?: number;
  disabled?: boolean;
  required?: boolean;
}
```

**Usage:**

```typescript
<MultiSelect
  name="tags"
  label="Product Tags"
  options={tagOptions}
  maxSelections={5}
  description="Select up to 5 tags"
/>
```

**Test:** Multiple selection, chip display, max limit enforced

---

#### 2.2.6: DatePicker (20 min)

**File:** `src/components/v2/forms/date-picker.tsx`

**Features:**

- Uses shadcn/ui Calendar + Popover
- Date range option
- Min/max date validation
- Format customization

**Install:**

```bash
npx shadcn@latest add calendar
npx shadcn@latest add popover
```

**Props:**

```typescript
interface DatePickerProps {
  name: string;
  label: string;
  description?: string;
  mode?: "single" | "range";
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  required?: boolean;
}
```

**Usage:**

```typescript
<DatePicker
  name="startDate"
  label="Start Date"
  minDate={new Date()}
  required
/>
```

**Test:** Calendar opens, date selection works, validation

---

#### 2.2.7: FileUpload (25 min)

**File:** `src/components/v2/forms/file-upload.tsx`

**Features:**

- Drag-and-drop zone
- File type validation (accept prop)
- File size validation
- Preview thumbnails (images)
- Multiple files option
- Upload progress (if async)

**Props:**

```typescript
interface FileUploadProps {
  name: string;
  label: string;
  description?: string;
  accept?: string; // e.g., "image/*", ".pdf,.doc"
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  required?: boolean;
  onUpload?: (files: File[]) => Promise<string[]>; // returns URLs
}
```

**Usage:**

```typescript
<FileUpload
  name="images"
  label="Product Images"
  accept="image/*"
  maxSize={5 * 1024 * 1024} // 5MB
  maxFiles={5}
  description="Upload up to 5 images, max 5MB each"
/>
```

**Test:** File selection, drag-drop, validation, preview

---

### Component 2.2.8-2.2.10: Form Patterns (1 hour)

#### 2.2.8: CreateEditDialog (20 min)

**File:** `src/components/v2/forms/patterns/create-edit-dialog.tsx`

**Features:**

- Reusable CRUD dialog
- Integrates FormWrapper
- Create vs Edit mode
- Trigger customization

**Props:**

```typescript
interface CreateEditDialogProps<T extends z.ZodType> {
  mode: "create" | "edit";
  title: string;
  description?: string;
  schema: T;
  defaultValues?: Partial<z.infer<T>>;
  onSubmit: (data: z.infer<T>) => Promise<void>;
  trigger: React.ReactNode;
  children: React.ReactNode; // Form fields
}
```

**Usage:**

```typescript
<CreateEditDialog
  mode="create"
  title="Create Product"
  description="Add a new product to your catalog"
  schema={productSchema}
  onSubmit={createProduct}
  trigger={<Button>Create Product</Button>}
>
  <TextInput name="name" label="Name" />
  <Textarea name="description" label="Description" />
  <Select name="category" label="Category" options={categories} />
</CreateEditDialog>
```

**Test:** Opens dialog, submits form, closes on success

---

#### 2.2.9: FilterForm (20 min)

**File:** `src/components/v2/forms/patterns/filter-form.tsx`

**Features:**

- Sidebar or dropdown filter UI
- Clear filters button
- Apply/Reset actions
- Mobile responsive (drawer on mobile)

**Props:**

```typescript
interface FilterFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues?: Partial<z.infer<T>>;
  onApply: (filters: z.infer<T>) => void;
  onReset: () => void;
  children: React.ReactNode;
  variant?: "sidebar" | "dropdown";
}
```

**Usage:**

```typescript
<FilterForm
  schema={productFiltersSchema}
  onApply={handleFilterApply}
  onReset={handleFilterReset}
  variant="sidebar"
>
  <Select name="category" label="Category" options={categories} />
  <Select name="status" label="Status" options={statusOptions} />
  <DatePicker name="dateRange" label="Date Range" mode="range" />
</FilterForm>
```

**Test:** Apply filters, reset filters, mobile drawer

---

#### 2.2.10: SearchForm (20 min)

**File:** `src/components/v2/forms/patterns/search-form.tsx`

**Features:**

- Search input with debounce
- Clear button
- Loading state
- Recent searches (optional)
- Keyboard shortcuts (Cmd+K)

**Props:**

```typescript
interface SearchFormProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  debounceMs?: number;
  recentSearches?: string[];
  loading?: boolean;
}
```

**Usage:**

```typescript
<SearchForm
  onSearch={handleSearch}
  onClear={handleClear}
  placeholder="Search products..."
  debounceMs={300}
  loading={isSearching}
/>
```

**Test:** Debounce works, clear button, loading state

---

### Form Primitives Definition of Done ✅

- [ ] FormWrapper complete with RHF + Zod integration
- [ ] 6 field components complete (TextInput, Textarea, Select, MultiSelect, DatePicker, FileUpload)
- [ ] 3 form patterns complete (CreateEditDialog, FilterForm, SearchForm)
- [ ] All 12 tests passing (5 + 6 + 1 + 1 + 1)
- [ ] Mobile responsive on all components
- [ ] Used in 2+ pages (admin preview + real feature)
- [ ] Documentation with usage examples

---

## Task 2.3: Layout & Navigation (2 hours) 🔴 CRITICAL

### Goal

Complete the layout system with status bar, breadcrumbs, mobile navigation, and quick switcher.

### Component 2.3.1: StatusBar (1 hour)

**File:** `src/components/v2/layout/status-bar.tsx`

**Features:**

- Show current org name + logo
- Show current branch name
- Show user avatar + name
- Quick actions dropdown (org settings, create new, etc.)
- Notification indicator with count
- Mobile: fixed bottom bar with compact layout
- Desktop: optional top or bottom bar

**Props:**

```typescript
interface StatusBarProps {
  position?: "top" | "bottom";
  variant?: "full" | "compact";
  className?: string;
}
```

**Usage:**

```typescript
// In dashboard layout
<StatusBar position="bottom" variant="full" />

// Mobile automatically switches to compact
```

**Components:**

- Current org/branch display (from useAppStoreV2)
- User menu (from useUserStoreV2)
- Quick actions popover
- Notifications bell with badge

**Test File:** `src/components/v2/layout/__tests__/status-bar.test.tsx`

**Test Cases (2 tests):**

1. Displays org, branch, user from stores
2. Quick actions menu opens and works
3. Mobile layout renders correctly

**Checklist:**

- [ ] Component created
- [ ] Reads from Zustand stores
- [ ] Quick actions dropdown functional
- [ ] Mobile responsive (fixed bottom bar)
- [ ] 2 tests passing

---

### Component 2.3.2: Breadcrumbs (20 min)

**File:** `src/components/v2/navigation/breadcrumbs.tsx`

**Features:**

- Auto-generate from pathname OR accept array
- Home icon for first item
- Separator between items
- Last item not clickable (current page)
- Mobile: show only last 2 items with ellipsis

**Props:**

```typescript
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  autoGenerate?: boolean;
  className?: string;
}
```

**Usage:**

```typescript
// Manual
<Breadcrumbs
  items={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Warehouse", href: "/dashboard/warehouse" },
    { label: "Products" }, // Current page, no href
  ]}
/>

// Auto-generate from pathname
<Breadcrumbs autoGenerate />
```

**Test File:** `src/components/v2/navigation/__tests__/breadcrumbs.test.tsx`

**Test Cases (2 tests):**

1. Renders breadcrumb items with links
2. Mobile truncation works (shows ... for middle items)

**Checklist:**

- [ ] Component created
- [ ] Auto-generation from pathname works
- [ ] Mobile truncation implemented
- [ ] 2 tests passing

---

### Component 2.3.3: MobileDrawer (20 min)

**File:** `src/components/v2/navigation/mobile-drawer.tsx`

**Features:**

- Sheet drawer from left or right
- Contains sidebar navigation
- Swipe to close (shadcn/ui Sheet)
- Overlay backdrop
- Keyboard Esc to close

**Install:**

```bash
npx shadcn@latest add sheet
```

**Props:**

```typescript
interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  children: React.ReactNode;
}
```

**Usage:**

```typescript
<MobileDrawer
  open={isMobileMenuOpen}
  onOpenChange={setIsMobileMenuOpen}
  side="left"
>
  <SidebarV2 />
</MobileDrawer>
```

**Test File:** `src/components/v2/navigation/__tests__/mobile-drawer.test.tsx`

**Test Cases (1 test):**

1. Opens and closes correctly
2. Renders children content

**Checklist:**

- [ ] Component created using shadcn/ui Sheet
- [ ] Open/close state managed
- [ ] Swipe and Esc work
- [ ] 1 test passing

---

### Component 2.3.4: QuickSwitcher (20 min)

**File:** `src/components/v2/navigation/quick-switcher.tsx`

**Features:**

- Cmd+K (or Ctrl+K) to open
- Search pages, actions, recent items
- Keyboard navigation (arrows + Enter)
- Fuzzy search
- Categories (Pages, Actions, Recent)

**Install:**

```bash
npx shadcn@latest add command
npx shadcn@latest add dialog
```

**Props:**

```typescript
interface QuickSwitcherItem {
  id: string;
  label: string;
  description?: string;
  category: "pages" | "actions" | "recent";
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface QuickSwitcherProps {
  items: QuickSwitcherItem[];
  recentItems?: QuickSwitcherItem[];
}
```

**Usage:**

```typescript
<QuickSwitcher
  items={[
    {
      id: "products",
      label: "Products",
      category: "pages",
      onSelect: () => router.push("/dashboard/warehouse/products")
    },
    {
      id: "create-product",
      label: "Create Product",
      category: "actions",
      onSelect: () => openCreateDialog()
    },
  ]}
  recentItems={recentPages}
/>
```

**Keyboard Shortcuts:**

- Cmd+K / Ctrl+K: Open
- Esc: Close
- Arrow Up/Down: Navigate
- Enter: Select

**Test File:** `src/components/v2/navigation/__tests__/quick-switcher.test.tsx`

**Test Cases (1 test):**

1. Opens on Cmd+K
2. Filters items on search
3. Keyboard navigation works

**Checklist:**

- [ ] Component created with Command
- [ ] Cmd+K shortcut registered
- [ ] Search filtering works
- [ ] Keyboard navigation functional
- [ ] 1 test passing

---

### Layout & Navigation Definition of Done ✅

- [ ] StatusBar component complete
- [ ] Breadcrumbs component complete
- [ ] MobileDrawer component complete
- [ ] QuickSwitcher component complete
- [ ] 6 tests passing (2 + 2 + 1 + 1)
- [ ] Mobile responsive patterns working
- [ ] Used in dashboard layout

---

## Task 2.4: Feedback & Utility Primitives (2 hours) 🔴 CRITICAL

### Feedback Components (1 hour)

#### 2.4.1: LoadingSkeleton (15 min)

**File:** `src/components/v2/feedback/loading-skeleton.tsx`

**Features:**

- Pattern-based skeletons (Table, Form, Card, List)
- Customizable dimensions
- Uses shadcn/ui Skeleton

**Exports:**

```typescript
export function TableSkeleton({ rows = 5, columns = 4 });
export function FormSkeleton({ fields = 3 });
export function CardSkeleton({ count = 3 });
export function ListSkeleton({ items = 5 });
```

**Usage:**

```typescript
{isLoading ? <TableSkeleton rows={10} columns={5} /> : <DataTable data={data} />}
```

**Test (1):** Renders correct number of skeleton elements

---

#### 2.4.2: ErrorBoundary (20 min)

**File:** `src/components/v2/feedback/error-boundary.tsx`

**Features:**

- React class component with error catching
- Fallback UI with error message
- Retry button
- Log errors to console (or error service)
- Reset error state on route change

**Props:**

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
```

**Usage:**

```typescript
<ErrorBoundary
  onError={(error) => console.error(error)}
  fallback={(error, reset) => (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

**Test (2):** Catches errors, displays fallback, retry works

---

#### 2.4.3: ToastPatterns (10 min)

**File:** `src/components/v2/feedback/toast-patterns.ts`

**Features:**

- Wrapper functions for react-toastify
- Consistent styling and positioning
- Types: success, error, warning, info, loading

**Exports:**

```typescript
export function showSuccess(message: string, description?: string);
export function showError(message: string, description?: string);
export function showWarning(message: string, description?: string);
export function showInfo(message: string, description?: string);
export function showLoading(message: string);
export function dismissToast(id: string);
```

**Usage:**

```typescript
import { showSuccess, showError } from "@/components/v2/feedback/toast-patterns";

showSuccess("Product created", "Your product has been added to the catalog");
showError("Failed to save", "Please try again later");
```

**Test (2):** Each pattern displays correctly, can be dismissed

---

#### 2.4.4: ConfirmationDialog (10 min)

**File:** `src/components/v2/feedback/confirmation-dialog.tsx`

**Features:**

- shadcn/ui AlertDialog
- Variants: default, destructive
- Async action support with loading state

**Props:**

```typescript
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void> | void;
}
```

**Usage:**

```typescript
<ConfirmationDialog
  open={isDeleteDialogOpen}
  onOpenChange={setIsDeleteDialogOpen}
  title="Delete Product"
  description="Are you sure? This action cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={async () => await deleteProduct(productId)}
/>
```

**Test (2):** Opens, confirms, cancels, loading state

---

#### 2.4.5: ProgressIndicator (5 min)

**File:** `src/components/v2/feedback/progress-indicator.tsx`

**Features:**

- Multi-step progress display
- Current step highlighted
- Step labels
- Optional step descriptions

**Props:**

```typescript
interface Step {
  label: string;
  description?: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}
```

**Usage:**

```typescript
<ProgressIndicator
  steps={[
    { label: "Details", description: "Basic information" },
    { label: "Pricing", description: "Set prices" },
    { label: "Images", description: "Upload photos" },
    { label: "Review", description: "Confirm and publish" },
  ]}
  currentStep={2}
/>
```

**Test (1):** Displays steps, highlights current step

---

### Utility Components (1 hour)

#### 2.4.6: CopyToClipboard (10 min)

**File:** `src/components/v2/utils/copy-to-clipboard.tsx`

**Features:**

- Copies text to clipboard on click
- Shows "Copied!" toast
- Optional icon button variant

**Props:**

```typescript
interface CopyToClipboardProps {
  text: string;
  children?: React.ReactNode;
  onCopy?: () => void;
  variant?: "button" | "icon";
}
```

**Usage:**

```typescript
<CopyToClipboard text={apiKey}>
  <Button variant="outline">Copy API Key</Button>
</CopyToClipboard>

<CopyToClipboard text={url} variant="icon" />
```

**Test (1):** Copies to clipboard, shows toast

---

#### 2.4.7: Tooltip (5 min)

**File:** `src/components/v2/utils/tooltip.tsx`

**Features:**

- Wrapper around shadcn/ui Tooltip
- Consistent styling
- Keyboard accessible

**Usage:**

```typescript
<Tooltip content="This is a helpful tooltip">
  <Button>Hover me</Button>
</Tooltip>
```

**Test (1):** Displays on hover

---

#### 2.4.8: Badge (10 min)

**File:** `src/components/v2/utils/badge.tsx`

**Features:**

- Extends shadcn/ui Badge
- Variants: success, warning, error, info, neutral
- Size variants: sm, md, lg
- Dot indicator option

**Usage:**

```typescript
<Badge variant="success">Active</Badge>
<Badge variant="warning" size="sm">Pending</Badge>
<Badge variant="error" dot>Offline</Badge>
```

**Test (1):** Each variant renders correctly

---

#### 2.4.9: Avatar (10 min)

**File:** `src/components/v2/utils/avatar.tsx`

**Features:**

- Extends shadcn/ui Avatar
- Fallback to initials
- Status indicator (online, offline, away, busy)
- Size variants
- Group avatar stack

**Usage:**

```typescript
<Avatar
  src={user.avatarUrl}
  name={user.name}
  status="online"
  size="md"
/>

<AvatarGroup users={teamMembers} max={3} />
```

**Test (1):** Shows image or initials, status indicator

---

#### 2.4.10: IconLibrary (5 min)

**File:** `src/components/v2/utils/icon-library.tsx`

**Features:**

- Centralized icon imports from lucide-react
- Icon name → Component mapping
- Type-safe icon names

**Exports:**

```typescript
export const icons = {
  home: Home,
  user: User,
  settings: Settings,
  // ... all commonly used icons
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: { name: IconName } & LucideProps);
```

**Usage:**

```typescript
<Icon name="home" className="h-4 w-4" />
```

**Test (1):** Returns correct icon component

---

### Feedback & Utilities Definition of Done ✅

- [ ] 5 feedback components complete
- [ ] 5 utility components complete
- [ ] 10 tests passing
- [ ] react-toastify used (NOT sonner)
- [ ] Mobile responsive
- [ ] Used in admin preview page

---

## Task 2.5: Admin Dashboard Integration (2 hours) 🔴 CRITICAL

### Goal

Refactor admin dashboard to use v2 components, proper SSR architecture, and serve as testing ground for primitives.

### 2.5.1: Admin Layout Refactor (30 min)

**File:** `src/app/[locale]/admin/layout.tsx`

**Changes:**

```typescript
// BEFORE: Client component with no context
export default function AdminLayout({ children }) {
  return (
    <div>
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}

// AFTER: Server component with SSR context
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Load context on server
  const context = await loadDashboardContextV2();

  // Redirect if no context
  if (!context) {
    redirect("/sign-in");
  }

  return (
    <DashboardV2Providers context={context}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          <AdminSidebarV2 />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </DashboardV2Providers>
  );
}
```

**Test (1):** Layout renders, context loads, no hydration errors

---

### 2.5.2: AdminSidebarV2 Component (30 min)

**File:** `src/components/v2/layout/admin-sidebar.tsx`

**Features:**

- Uses shadcn/ui Sidebar primitives
- Navigation items:
  - Overview (home icon)
  - Primitives Preview (eye icon) ← NEW
  - Testing Tools (flask icon)
  - App Management (cog icon)
  - System Logs (file-text icon)
  - Analytics (bar-chart icon)
- Active state detection
- Collapsible

**Usage:**

```typescript
<AdminSidebarV2 />
```

**Test (1):** Renders nav items, active state detection works

---

### 2.5.3: Admin Pages Refactor (1 hour)

**Pages to Update:**

1. **`page.tsx` (Overview)** - 15 min
   - Use v2 PageHeader
   - Use v2 Card components (when available)
   - Use v2 StatusBar (optional)

2. **`analytics/page.tsx`** - 15 min
   - Use v2 PageHeader
   - Use v2 loading skeletons
   - Use v2 error boundary

3. **`testing/page.tsx`** - 15 min
   - Use v2 PageHeader
   - Update links to use proper routing
   - Add test cards for each testing tool

**Common Pattern:**

```typescript
// All admin pages follow this pattern
export default async function AdminPage() {
  const context = await loadDashboardContextV2();

  return (
    <ClientAdminPageView initialContext={context} />
  );
}

// Client component
"use client";
function ClientAdminPageView({ initialContext }) {
  // Use v2 hooks, components
  return (
    <>
      <PageHeader
        title="Admin Overview"
        description="System administration and management"
      />
      {/* Page content */}
    </>
  );
}
```

**Test (1):** All pages render without errors

---

### Admin Integration Definition of Done ✅

- [ ] Admin layout uses DashboardV2Providers
- [ ] AdminSidebarV2 created with shadcn/ui
- [ ] All admin pages refactored to v2 patterns
- [ ] SSR context loading working
- [ ] 4 tests passing
- [ ] "Primitives Preview" nav item added

---

## Task 2.6: Primitives Preview Page (1 hour) 🔴 CRITICAL

### Goal

Create comprehensive showcase of all primitives in admin dashboard for visual testing and documentation.

**File:** `src/app/[locale]/admin/primitives/page.tsx`

### Page Structure

```typescript
export default async function PrimitivesPreviewPage() {
  const context = await loadDashboardContextV2();

  return <ClientPrimitivesView context={context} />;
}

"use client";
function ClientPrimitivesView() {
  return (
    <>
      <PageHeader
        title="UI Primitives Showcase"
        description="Preview and test all v2 UI components"
      />

      <Tabs defaultValue="forms">
        <TabsList>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="utilities">Utilities</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="forms">
          <FormsSection />
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackSection />
        </TabsContent>

        <TabsContent value="utilities">
          <UtilitiesSection />
        </TabsContent>

        <TabsContent value="layout">
          <LayoutSection />
        </TabsContent>
      </Tabs>
    </>
  );
}
```

### Section Components

#### FormsSection (15 min)

**Shows:**

- FormWrapper with all field types
- CreateEditDialog example
- FilterForm example
- SearchForm example

**Layout:**

- 2-column grid (desktop), 1-column (mobile)
- Each component in Card
- Live interactive demos

---

#### FeedbackSection (15 min)

**Shows:**

- All LoadingSkeleton patterns
- ErrorBoundary with "Throw Error" button
- Toast examples (all variants with demo buttons)
- ConfirmationDialog with trigger
- ProgressIndicator with step navigation

---

#### UtilitiesSection (15 min)

**Shows:**

- CopyToClipboard examples
- Tooltip examples on different elements
- Badge variants grid
- Avatar variants and AvatarGroup
- IconLibrary showcase (icon grid)

---

#### LayoutSection (15 min)

**Shows:**

- StatusBar preview (detached from layout)
- Breadcrumbs examples
- MobileDrawer demo
- QuickSwitcher demo (Cmd+K)

---

### Features

**Search/Filter:**

- Search box at top
- Filter by category
- Filter by status (implemented, in-progress, planned)

**Code Display:**

- Toggle to show/hide code snippets
- Copy code button
- Syntax highlighting (optional)

**Mobile Responsive:**

- 2-column → 1-column grid
- Tabs → Accordion on mobile
- Touch-friendly demos

**Test File:** `src/app/[locale]/admin/primitives/__tests__/page.test.tsx`

**Test Cases (2):**

1. Page renders all primitive categories
2. Interactive demos work (buttons, dialogs, etc.)

---

### Primitives Preview Definition of Done ✅

- [ ] Page created at `/admin/primitives`
- [ ] All 4 sections implemented
- [ ] Interactive demos functional
- [ ] Mobile responsive layout
- [ ] 2 tests passing
- [ ] Accessible via AdminSidebarV2

---

## 📅 Implementation Order

### Day 1-2: Form Primitives (3h)

1. ✅ Setup test infrastructure
2. Build FormWrapper (TDD)
3. Build 6 field components (TDD)
4. Build 3 form patterns (TDD)
5. ✅ All 12 tests pass

### Day 3: Layout & Feedback (2h + 1h)

1. Build StatusBar
2. Build Breadcrumbs, MobileDrawer, QuickSwitcher
3. ✅ 6 tests pass
4. Build 5 feedback components
5. ✅ 5 tests pass

### Day 4: Utilities & Admin (1h + 2h)

1. Build 5 utility components
2. ✅ 5 tests pass
3. Refactor admin layout
4. Build AdminSidebarV2
5. Update admin pages
6. ✅ 4 tests pass

### Day 5: Preview & QA (1h)

1. Build primitives preview page
2. ✅ 2 tests pass
3. Mobile testing
4. Fix issues
5. Update docs

**Total:** 10 hours, 35 tests

---

## 🏗️ Architecture Patterns

### SSR-First

**✅ CORRECT:**

```typescript
// Page is Server Component
export default async function ProductsPage() {
  const context = await loadDashboardContextV2();
  return <ClientProductsView initialData={context} />;
}

// Client component receives server data
"use client";
export function ClientProductsView({ initialData }) {
  // Use v2 hooks and components
  return <div>...</div>;
}
```

**❌ INCORRECT:**

```typescript
"use client"; // at page level
export default function ProductsPage() {
  // Client-side only
}
```

---

### TDD Pattern

**✅ CORRECT:**

```typescript
// 1. Write test first
describe('FormWrapper', () => {
  it('validates with Zod schema', () => {
    const schema = z.object({ name: z.string().min(3) });
    render(<FormWrapper schema={schema} onSubmit={jest.fn()}>...</FormWrapper>);
    // ... test validation
  });
});

// 2. Implement component
export function FormWrapper<T extends z.ZodType>({ schema, onSubmit, children }) {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
  });
  // ... implementation
}

// 3. Verify test passes
```

---

### Mobile-First CSS

**✅ CORRECT:**

```typescript
// Mobile first, enhance for desktop
className = "flex-col gap-2 md:flex-row md:gap-4 lg:gap-6";
```

**❌ INCORRECT:**

```typescript
// Desktop first
className = "flex-row gap-6 md:flex-col md:gap-2";
```

---

### react-toastify (NOT sonner)

**✅ CORRECT:**

```typescript
import { toast } from "react-toastify";

toast.success("Product created successfully");
toast.error("Failed to save product");
```

**❌ INCORRECT:**

```typescript
import { toast } from "sonner"; // WRONG LIBRARY
import { useToast } from "@/hooks/use-toast"; // Sonner-based
```

---

### shadcn/ui First

**✅ CORRECT:**

```bash
# Check if shadcn has component before building
npx shadcn@latest add dialog
npx shadcn@latest add form
```

**❌ INCORRECT:**

```typescript
// Building modal from scratch when Dialog exists
export function CustomModal() {
  // ... reinventing the wheel
}
```

---

## ✅ Definition of Done

### Code Complete

- [ ] All 25 components built (10 forms, 4 layout, 10 feedback/utils, 1 preview)
- [ ] All 35 tests passing
- [ ] `npm run type-check` - 0 TypeScript errors
- [ ] `npm run lint` - 0 ESLint errors
- [ ] `npm run build` - Build succeeds

### Functionality

- [ ] All forms validate with Zod
- [ ] All feedback components display correctly
- [ ] All utilities work as expected
- [ ] Admin dashboard uses v2 components
- [ ] Primitives preview page accessible
- [ ] Mobile responsive on ALL components

### Testing

- [ ] Unit tests for all components (35 total)
- [ ] Integration tests for form patterns (3)
- [ ] Admin pages render without errors (4)
- [ ] No console errors in browser
- [ ] No hydration mismatches

### Documentation

- [ ] JSDoc comments on all components
- [ ] Usage examples in primitives preview
- [ ] Props interfaces documented
- [ ] README updated with component list

### Mobile Responsiveness

- [ ] All components tested on mobile viewport
- [ ] Touch targets minimum 44px
- [ ] No horizontal scroll
- [ ] Drawer/sheet on mobile where appropriate
- [ ] Typography scales correctly

---

## 🎨 Design System Notes

### Color Palette

Using Tailwind CSS + shadcn/ui theme:

- Primary: blue (customizable via CSS vars)
- Success: green
- Warning: yellow/orange
- Error: red
- Neutral: gray

### Typography Scale

- Heading 1: `text-4xl font-bold`
- Heading 2: `text-3xl font-semibold`
- Heading 3: `text-2xl font-semibold`
- Heading 4: `text-xl font-medium`
- Body: `text-base`
- Small: `text-sm`
- Tiny: `text-xs`

### Spacing System

Using Tailwind spacing: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24

### Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

---

## 🚨 Important Reminders

### ALWAYS Check shadcn/ui First

Before building ANY component, check if shadcn has it:

```bash
npx shadcn@latest add --help
```

### NEVER Use sonner

**ONLY use react-toastify:**

```typescript
// ✅ CORRECT
import { toast } from "react-toastify";

// ❌ WRONG
import { toast } from "sonner";
```

### Mobile-First Design

- Touch targets ≥ 44px
- Design for 375px width first
- Test on real mobile device
- Use responsive utilities: `hidden md:block`

### Test Before Implementing

Write tests first (TDD):

1. Write failing test
2. Implement component
3. Make test pass
4. Refactor

---

**Last Updated:** 2026-01-28
**Status:** 🔵 Ready to Start Implementation
**Next Task:** 2.2.1 FormWrapper
**Blocks:** Phases 3-6 (User/Org Management, Products)
