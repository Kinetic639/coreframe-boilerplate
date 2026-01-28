# Phase 2 UI Primitives - Component Reference

**Quick reference guide for all v2 primitive components**

---

## Form Primitives

### FormWrapper

**Path:** `src/components/v2/forms/form-wrapper.tsx`

React Hook Form wrapper with Zod validation. Provides form context, error handling, loading states, and toast notifications.

```tsx
<FormWrapper schema={mySchema} onSubmit={handleSubmit} defaultValues={...}>
  {/* Form fields here */}
</FormWrapper>
```

**Key Props:** `schema`, `onSubmit`, `defaultValues`, `loading`, `onSuccess`, `onError`, `submitLabel`

---

### TextInput

**Path:** `src/components/v2/forms/text-input.tsx`

Text input field with validation, prefix/suffix support, and error display.

```tsx
<TextInput name="email" label="Email" type="email" required prefix={<Icon name="Mail" />} />
```

**Key Props:** `name`, `label`, `type`, `placeholder`, `prefix`, `suffix`, `maxLength`, `required`, `disabled`

---

### Textarea

**Path:** `src/components/v2/forms/textarea.tsx`

Multi-line text input with character counter and validation.

```tsx
<Textarea name="message" label="Message" rows={4} maxLength={500} />
```

**Key Props:** `name`, `label`, `rows`, `maxLength`, `required`, `disabled`

---

### Select

**Path:** `src/components/v2/forms/select.tsx`

Single-select dropdown with validation.

```tsx
<Select
  name="category"
  label="Category"
  options={[
    { value: "bug", label: "Bug Report" },
    { value: "feature", label: "Feature Request" },
  ]}
/>
```

**Key Props:** `name`, `label`, `options`, `placeholder`, `required`, `disabled`

---

### MultiSelect

**Path:** `src/components/v2/forms/multi-select.tsx`

Checkbox-based multi-select field.

```tsx
<MultiSelect
  name="tags"
  label="Tags"
  options={[
    { value: "urgent", label: "Urgent" },
    { value: "important", label: "Important" },
  ]}
/>
```

**Key Props:** `name`, `label`, `options`, `required`, `disabled`

---

### DatePicker

**Path:** `src/components/v2/forms/date-picker.tsx`

Calendar-based date picker with min/max date constraints.

```tsx
<DatePicker
  name="date"
  label="Select Date"
  minDate={new Date()}
  maxDate={...}
/>
```

**Key Props:** `name`, `label`, `placeholder`, `minDate`, `maxDate`, `required`, `disabled`

---

### FileUpload

**Path:** `src/components/v2/forms/file-upload.tsx`

Drag-and-drop file upload with preview, file type filtering, and size validation.

```tsx
<FileUpload
  name="files"
  label="Attachments"
  accept="image/*,.pdf"
  multiple
  maxSize={5 * 1024 * 1024}
/>
```

**Key Props:** `name`, `label`, `accept`, `multiple`, `maxSize`, `required`, `disabled`

---

### CreateEditDialog

**Path:** `src/components/v2/forms/create-edit-dialog.tsx`

Modal dialog pattern for create/edit forms with validation.

```tsx
<CreateEditDialog mode="create" title="Create Item" schema={itemSchema} onSubmit={handleCreate}>
  <TextInput name="title" label="Title" />
</CreateEditDialog>
```

**Key Props:** `mode`, `title`, `description`, `schema`, `onSubmit`, `defaultValues`, `trigger`

---

### FilterForm

**Path:** `src/components/v2/forms/filter-form.tsx`

Sidebar sheet pattern for filtering with active filter count badge.

```tsx
<FilterForm
  schema={filterSchema}
  onApply={handleFilters}
  onClear={handleClear}
  activeFiltersCount={2}
>
  <TextInput name="search" label="Search" />
</FilterForm>
```

**Key Props:** `schema`, `onApply`, `onClear`, `activeFiltersCount`, `defaultValues`, `trigger`

---

### SearchForm

**Path:** `src/components/v2/forms/search-form.tsx`

Debounced search input with clear button.

```tsx
<SearchForm placeholder="Search items..." onSearch={handleSearch} debounce={300} />
```

**Key Props:** `placeholder`, `value`, `onSearch`, `onClear`, `debounce`

---

## Layout & Navigation

### StatusBar

**Path:** `src/components/v2/layout/status-bar.tsx`

System status display showing online/offline state, org/branch info, and current time.

```tsx
<StatusBar variant="full" position="bottom" />
```

**Key Props:** `variant` ("full" | "compact"), `position` ("top" | "bottom")

**Note:** Reads from `useAppStoreV2()` and `useUserStoreV2()`

---

### Breadcrumbs

**Path:** `src/components/v2/layout/breadcrumbs.tsx`

Navigation breadcrumbs with auto-generation from pathname or manual items.

```tsx
<Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]} showHome={true} />
```

**Key Props:** `items`, `showHome`

**Auto-generation:** If `items` not provided, generates from current pathname

---

### MobileDrawer

**Path:** `src/components/v2/layout/mobile-drawer.tsx`

Sheet-based mobile navigation drawer.

```tsx
<MobileDrawer side="left">
  <nav>{/* Navigation content */}</nav>
</MobileDrawer>
```

**Key Props:** `trigger`, `side` ("left" | "right" | "top" | "bottom")

**Default trigger:** Hamburger menu icon (visible on mobile only)

---

### QuickSwitcher

**Path:** `src/components/v2/layout/quick-switcher.tsx`

Cmd+K / Ctrl+K command palette for quick navigation.

```tsx
<QuickSwitcher
  actions={[{ id: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Icon /> }]}
/>
```

**Key Props:** `actions`, `placeholder`

**Keyboard shortcut:** Automatically binds to Cmd+K (Mac) / Ctrl+K (Windows)

---

## Feedback Components

### LoadingSkeleton

**Path:** `src/components/v2/feedback/loading-skeleton.tsx`

Loading skeletons with multiple variants (text, card, table, form, list).

```tsx
<LoadingSkeleton variant="card" count={3} />
```

**Key Props:** `variant` ("text" | "card" | "table" | "form" | "list"), `count`

---

### ErrorBoundary

**Path:** `src/components/v2/feedback/error-boundary.tsx`

React error boundary with retry functionality and custom fallback support.

```tsx
<ErrorBoundary fallback={<CustomError />} onError={handleError}>
  {children}
</ErrorBoundary>
```

**Key Props:** `fallback`, `onError`

**Default fallback:** Shows error icon, message, and retry/reload buttons

---

### ToastPatterns

**Path:** `src/components/v2/feedback/toast-patterns.tsx`

Standardized toast notification patterns using react-toastify.

```tsx
import { toastPatterns } from "@/components/v2/feedback/toast-patterns";

toastPatterns.success("Saved!");
toastPatterns.error("Failed to save");
toastPatterns.warning("Warning");
toastPatterns.info("Info message");

// Common patterns
toastPatterns.saved("Item");
toastPatterns.deleted("User");
toastPatterns.copied();

// Promise-based
toastPatterns.promise(apiCall(), { pending: "Loading...", success: "Done!", error: "Failed!" });
```

**CRITICAL:** Always use `react-toastify`, NEVER use `sonner`

**Styling:**

- Position: Bottom-right corner
- Compact design with reduced padding
- Auto-close: 2.5s (errors: 3.5s)
- Smaller icons (h-4 w-4)

---

### ConfirmationDialog

**Path:** `src/components/v2/feedback/confirmation-dialog.tsx`

Confirmation dialog with destructive variant for delete operations.

```tsx
<ConfirmationDialog
  title="Delete Item"
  description="This action cannot be undone."
  variant="destructive"
  confirmLabel="Delete"
  onConfirm={handleDelete}
/>
```

**Key Props:** `title`, `description`, `variant` ("default" | "destructive"), `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `trigger`

---

### ProgressIndicator

**Path:** `src/components/v2/feedback/progress-indicator.tsx`

Progress display with bar, circular, and step variants.

```tsx
// Bar
<ProgressIndicator variant="bar" value={75} />

// Circular
<ProgressIndicator variant="circular" value={75} />

// Steps
<ProgressIndicator
  variant="steps"
  currentStep={2}
  steps={[
    { label: "Step 1", description: "Complete" },
    { label: "Step 2", description: "In progress" }
  ]}
/>
```

**Key Props:** `variant`, `value`, `max`, `steps`, `currentStep`, `showLabel`

---

## Utility Components

### CopyToClipboard

**Path:** `src/components/v2/utility/copy-to-clipboard.tsx`

Copy to clipboard utility with button, icon, and inline variants.

```tsx
// Button
<CopyToClipboard text="Hello World" variant="button" />

// Icon
<CopyToClipboard text="data" variant="icon" />

// Inline
<CopyToClipboard text="code" variant="inline">
  Click to copy
</CopyToClipboard>
```

**Key Props:** `text`, `variant` ("button" | "icon" | "inline"), `successMessage`, `showToast`

---

### Tooltip

**Path:** `src/components/v2/utility/tooltip.tsx`

Tooltip wrapper around shadcn tooltip with consistent API.

```tsx
<Tooltip content="This is a tooltip" side="top" delayDuration={200}>
  <Button>Hover me</Button>
</Tooltip>
```

**Key Props:** `content`, `side` ("top" | "right" | "bottom" | "left"), `align`, `delayDuration`

---

### Badge

**Path:** `src/components/v2/utility/badge.tsx`

Extended badge with success/warning/info variants and removable option.

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Info</Badge>
<Badge removable onRemove={handleRemove}>Removable</Badge>
```

**Key Props:** `variant` ("default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"), `size` ("sm" | "md" | "lg"), `removable`, `onRemove`

---

### Avatar

**Path:** `src/components/v2/utility/avatar.tsx`

User avatar with fallback, status indicator, and size variants.

```tsx
<Avatar src={user.avatarUrl} fallback="JD" size="md" status="online" shape="circle" />
```

**Key Props:** `src`, `alt`, `fallback`, `size` ("xs" | "sm" | "md" | "lg" | "xl"), `shape` ("circle" | "square"), `status` ("online" | "offline" | "away" | "busy")

---

### Icon (IconLibrary)

**Path:** `src/components/v2/utility/icon-library.tsx`

Dynamic icon rendering from lucide-react with helper functions.

```tsx
import { Icon } from "@/components/v2/utility/icon-library";

<Icon name="User" size={24} className="text-primary" />
<Icon name="Settings" size={20} strokeWidth={2} />
```

**Key Props:** `name` (any lucide-react icon name), `size`, `strokeWidth`, `className`

**Helpers:**

- `getAvailableIcons()` - Returns array of all icon names
- `searchIcons(query)` - Search icons by name

**Direct imports also available:**

```tsx
import { User, Settings, Search } from "@/components/v2/utility/icon-library";
```

---

## Admin Components

### AdminSidebarV2

**Path:** `src/components/v2/admin/admin-sidebar.tsx`

Admin panel sidebar with navigation links including primitives preview.

```tsx
<AdminSidebarV2 />
```

**Navigation includes:**

- Overview
- **Primitives** (links to `/admin/primitives`)
- Testing Tools
- App Management
- System Logs
- Analytics

---

## Pages

### Primitives Preview

**Path:** `src/app/[locale]/admin/primitives/page.tsx`

Live showcase of all Phase 2 components with interactive examples.

**URL:** `/admin/primitives`

Shows working examples of:

- All form components with live validation
- Layout components
- Feedback components with interactive demos
- Utility components

---

## Usage Patterns

### Form Pattern (Full Example)

```tsx
import { z } from "zod";
import { FormWrapper } from "@/components/v2/forms/form-wrapper";
import { TextInput } from "@/components/v2/forms/text-input";
import { Select } from "@/components/v2/forms/select";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string(),
});

function MyForm() {
  return (
    <FormWrapper
      schema={schema}
      onSubmit={async (data) => {
        await api.create(data);
      }}
    >
      <TextInput name="name" label="Name" required />
      <Select name="category" label="Category" options={[...]} />
    </FormWrapper>
  );
}
```

### Dialog Pattern

```tsx
import { CreateEditDialog } from "@/components/v2/forms/create-edit-dialog";
import { TextInput } from "@/components/v2/forms/text-input";

<CreateEditDialog mode="create" title="Create Item" schema={schema} onSubmit={handleCreate}>
  <TextInput name="title" label="Title" required />
  <Textarea name="description" label="Description" />
</CreateEditDialog>;
```

### Toast Pattern

```tsx
import { toastPatterns } from "@/components/v2/feedback/toast-patterns";

// Simple
toastPatterns.success("Saved!");

// Common patterns
toastPatterns.saved("Product");
toastPatterns.deleted("User");
toastPatterns.copied();

// Async
toastPatterns.promise(saveData(), {
  pending: "Saving...",
  success: "Saved!",
  error: "Failed to save",
});
```

---

## Architecture Notes

### All Components Follow:

- **SSR-first**: Work with Next.js 15 async server components
- **Mobile-responsive**: Mobile-first design with responsive breakpoints (375px baseline)
- **Type-safe**: Full TypeScript support with generics
- **Accessible**: ARIA labels, keyboard navigation, semantic HTML
- **Toast standard**: `react-toastify` only (NEVER sonner)
- **Shadcn/ui based**: Built on shadcn/ui for consistency

### Form Components Require:

- Must be wrapped in `<FormWrapper>` to access form context
- Use `react-hook-form` with `zod` validation
- Field names must match schema keys

### Client vs Server:

- All components marked `"use client"` (can be used in client components)
- Form components need client interaction
- Can be imported into server components as children

---

## Testing

Components with tests:

- ✅ **FormWrapper**: 6 tests passing
- ✅ **TextInput**: 7 tests passing

Test file pattern: `src/components/v2/{category}/__tests__/{component}.test.tsx`

---

## Quick Import Reference

```tsx
// Forms
import { FormWrapper } from "@/components/v2/forms/form-wrapper";
import { TextInput } from "@/components/v2/forms/text-input";
import { Textarea } from "@/components/v2/forms/textarea";
import { Select } from "@/components/v2/forms/select";
import { MultiSelect } from "@/components/v2/forms/multi-select";
import { DatePicker } from "@/components/v2/forms/date-picker";
import { FileUpload } from "@/components/v2/forms/file-upload";
import { CreateEditDialog } from "@/components/v2/forms/create-edit-dialog";
import { FilterForm } from "@/components/v2/forms/filter-form";
import { SearchForm } from "@/components/v2/forms/search-form";

// Layout
import { StatusBar } from "@/components/v2/layout/status-bar";
import { Breadcrumbs } from "@/components/v2/layout/breadcrumbs";
import { MobileDrawer } from "@/components/v2/layout/mobile-drawer";
import { QuickSwitcher } from "@/components/v2/layout/quick-switcher";

// Feedback
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { ErrorBoundary } from "@/components/v2/feedback/error-boundary";
import { toastPatterns } from "@/components/v2/feedback/toast-patterns";
import { ConfirmationDialog } from "@/components/v2/feedback/confirmation-dialog";
import { ProgressIndicator } from "@/components/v2/feedback/progress-indicator";

// Utility
import { CopyToClipboard } from "@/components/v2/utility/copy-to-clipboard";
import { Tooltip } from "@/components/v2/utility/tooltip";
import { Badge } from "@/components/v2/utility/badge";
import { Avatar } from "@/components/v2/utility/avatar";
import { Icon } from "@/components/v2/utility/icon-library";

// Admin
import { AdminSidebarV2 } from "@/components/v2/admin/admin-sidebar";
```

---

**Last Updated:** 2026-01-28
**Phase:** 2 - UI Primitives
**Status:** ✅ Complete (25/25 components)
