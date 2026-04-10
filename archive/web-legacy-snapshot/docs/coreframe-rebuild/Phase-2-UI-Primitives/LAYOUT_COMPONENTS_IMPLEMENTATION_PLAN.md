# Dashboard V2 Layout Components - Implementation Plan

**Created**: 2026-01-28
**Phase**: Layout Components Completion
**Status**: 🟡 Planning Phase
**Duration Estimate**: 8-10 hours total

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Components Status Matrix](#components-status-matrix)
4. [Implementation Priorities](#implementation-priorities)
5. [Detailed Implementation Plan](#detailed-implementation-plan)
6. [Component Specifications](#component-specifications)
7. [Quality Gates](#quality-gates)
8. [Timeline](#timeline)

---

## Executive Summary

### Objective

Complete the Dashboard V2 layout system to enable full module development with:

- Fixed layout components (header, sidebar, status bar)
- Enhanced global search/command palette (Cmd+K/Ctrl+K)
- Notification system foundation
- Page-level component templates

### Current Progress

- **Layout Container**: ✅ 100% Complete
- **Core Navigation**: ✅ 85% Complete (minor enhancements needed)
- **Search System**: 🟡 40% Complete (basic version exists, needs enhancement)
- **Notifications**: 🔴 15% Complete (placeholder only)
- **Page Components**: 🟡 50% Complete (needs standardization)

### Blocking Status

**No Blockers** - All Phase 2 primitives are complete, ready to build layout components

---

## Current State Analysis

### ✅ **Fully Implemented Components** (7/11)

#### 1. Dashboard Layout Container

**File**: `src/app/[locale]/dashboard/layout.tsx`
**Status**: ✅ 100% Complete (73% verified)
**Features**:

- SSR data loading via `loadDashboardContextV2()`
- Server-side redirect when no context
- Zustand store hydration
- SidebarProvider integration
- Responsive container with proper flex layout

**Remaining Work**: Manual verification only

---

#### 2. SidebarV2

**File**: `src/components/v2/layout/sidebar.tsx`
**Status**: ✅ 100% Complete (needs verification)
**Features**:

- shadcn/ui Sidebar components
- Module-based navigation from `userModules`
- Active route detection
- Icon mapping (Home, Package, Users, Settings, HelpCircle)
- BranchSwitcherV2 integration
- Mobile drawer behavior (automatic)

**Remaining Work**: Verification testing only

---

#### 3. DashboardHeaderV2

**File**: `src/components/v2/layout/dashboard-header.tsx`
**Status**: ✅ 83% Complete
**Features Implemented**:

- Sidebar toggle button (mobile/desktop)
- Global search trigger (opens command palette)
- Notifications bell (placeholder)
- User profile menu with avatar
- Responsive layout (mobile/tablet/desktop)

**Features Missing**:

- Breadcrumbs integration (optional - can use standalone Breadcrumbs component)

**Remaining Work**: Minor enhancements, verification

---

#### 4. HeaderSearch

**File**: `src/components/v2/layout/header-search.tsx`
**Status**: ✅ 100% Complete (basic version)
**Features**:

- Cmd+K / Ctrl+K keyboard shortcut
- Opens CommandDialog
- Searches userModules
- Basic fuzzy filtering

**Enhancement Needed**: See "Enhanced Search Plan" below

---

#### 5. HeaderUserMenu

**File**: `src/components/v2/layout/header-user-menu.tsx`
**Status**: ✅ 100% Complete
**Features**:

- User avatar with fallback initials
- Dropdown menu with profile links
- Account settings link
- Preferences link
- Sign out action

**Remaining Work**: None

---

#### 6. BranchSwitcherV2

**File**: `src/components/v2/layout/branch-switcher.tsx`
**Status**: ✅ 100% Complete (22% verified)
**Features**:

- Popover with command palette
- Lists available branches
- Calls `changeBranch()` server action
- Updates Zustand store
- Triggers permission refetch
- Toast notifications

**Remaining Work**: Verification testing only

---

#### 7. StatusBar

**File**: `src/components/v2/layout/status-bar.tsx`
**Status**: ✅ 100% Complete (Phase 2 primitive)
**Features**:

- Online/offline status
- Organization + branch info
- Current time display
- Compact and full variants
- Position: top or bottom

**Remaining Work**: None (already complete from Phase 2)

---

### 🟡 **Partially Implemented** (3/11)

#### 8. HeaderNotifications

**File**: `src/components/v2/layout/header-notifications.tsx`
**Status**: 🟡 15% Complete (placeholder only)
**Current State**:

- Bell icon button exists
- Button is disabled
- No popover/dropdown
- No notification data
- No real-time updates

**Needs Implementation**: Full notification system (see below)

---

#### 9. QuickSwitcher (Basic Version)

**File**: `src/components/v2/layout/quick-switcher.tsx`
**Status**: 🟡 40% Complete
**Current Features**:

- Cmd+K / Ctrl+K shortcut
- CommandDialog with basic actions
- Default actions (dashboard, settings, team, products)
- Navigation via router.push

**Needs Enhancement**: See "Enhanced Search/Command Palette Plan" (Part 2)

---

#### 10. PageHeader Component

**File**: None yet (uses Breadcrumbs component)
**Status**: 🟡 50% Complete (scattered)
**Current State**:

- Breadcrumbs component exists as standalone
- No standardized page header pattern
- Each page implements headers differently

**Needs Implementation**: Reusable page header component template

---

### 🔴 **Not Yet Implemented** (1/11)

#### 11. MobileDrawer

**File**: `src/components/v2/layout/mobile-drawer.tsx`
**Status**: ✅ 100% Complete (Phase 2 primitive)
**Features**:

- Sheet-based mobile navigation
- Customizable side (left/right/top/bottom)
- Hamburger menu trigger
- Works with shadcn/ui Sheet

**Remaining Work**: None (already complete from Phase 2)

---

## Components Status Matrix

| Component                | Status  | Priority | Blocks Module Dev? | Est. Time |
| ------------------------ | ------- | -------- | ------------------ | --------- |
| **Layout Container**     | ✅ 100% | Critical | No                 | 0h        |
| **SidebarV2**            | ✅ 100% | Critical | No                 | 0h        |
| **DashboardHeaderV2**    | ✅ 83%  | Critical | No                 | 0.5h      |
| **BranchSwitcherV2**     | ✅ 100% | High     | No                 | 0h        |
| **HeaderUserMenu**       | ✅ 100% | High     | No                 | 0h        |
| **HeaderSearch**         | ✅ 40%  | High     | No (basic works)   | 0h        |
| **StatusBar**            | ✅ 100% | Medium   | No                 | 0h        |
| **Breadcrumbs**          | ✅ 100% | Medium   | No                 | 0h        |
| **MobileDrawer**         | ✅ 100% | Medium   | No                 | 0h        |
| **PageHeader**           | 🟡 50%  | High     | **Yes**            | 1.5h      |
| **HeaderNotifications**  | 🔴 15%  | Low      | No                 | 3-4h      |
| **QuickSwitcher (Enh.)** | 🟡 40%  | High     | No (basic works)   | 3-4h      |
| **TOTAL**                | 85%     | -        | -                  | **8-10h** |

**Legend**:

- ✅ Complete (ready for use)
- 🟡 Partial (usable but needs work)
- 🔴 Placeholder (not functional)

---

## Implementation Priorities

### 🚨 **Priority 1: Critical for Module Development** (MUST DO)

#### A. PageHeader Component

**Why Critical**: Every module page needs consistent header structure
**Status**: 50% complete (Breadcrumbs exist, need wrapper)
**Blocks**: All module pages
**Time**: 1.5 hours

**Implementation Steps**:

1. Create `src/components/v2/layout/page-header.tsx`
2. Integrate Breadcrumbs component
3. Add title + description slots
4. Add actions slot (buttons, filters)
5. Add responsive layout
6. Test with existing pages
7. Document usage pattern

**Deliverables**:

- Reusable PageHeader component
- Usage examples for module pages
- Updated documentation

---

### 🎯 **Priority 2: High Value Enhancements** (SHOULD DO)

#### B. Enhanced Search/Command Palette

**Why Important**: Critical UX feature for power users
**Status**: 40% complete (basic version exists)
**Blocks**: None (basic version works)
**Time**: 3-4 hours

**See**: "Enhanced Search/Command Palette - Detailed Plan" (Part 2 below)

**Implementation Steps** (summary):

1. Enhance data model (categories, providers)
2. Implement search providers system
3. Add recent searches
4. Add keyboard shortcuts
5. Add search scope filters
6. Optimize performance
7. Test thoroughly

**Deliverables**:

- Enhanced command palette with extensible architecture
- Search providers for modules, pages, actions
- Future-ready for branch/user/client search

---

#### C. DashboardHeaderV2 Polish

**Why Important**: Minor improvements to header
**Status**: 83% complete
**Blocks**: None
**Time**: 0.5 hours

**Implementation Steps**:

1. Review header layout on all breakpoints
2. Verify all interactive states
3. Test keyboard navigation
4. Update documentation

**Deliverables**:

- Fully verified header component
- No visual bugs
- Updated test coverage

---

### 📦 **Priority 3: Nice to Have** (CAN DEFER)

#### D. Notification System

**Why Defer**: Complex feature, not critical for MVP
**Status**: 15% complete (placeholder)
**Blocks**: None
**Time**: 3-4 hours

**Can be implemented later when needed**

**Implementation Steps** (when ready):

1. Design notification data model
2. Create notification service
3. Implement Supabase Realtime integration
4. Build notification popover UI
5. Add mark as read functionality
6. Add notification preferences
7. Test real-time updates

**Deliverables**:

- Full notification system
- Real-time updates via Supabase
- Notification preferences

---

## Detailed Implementation Plan

### Phase 1: Critical Components (Day 1 - 1.5 hours)

#### Task 1.1: PageHeader Component

**File**: `src/components/v2/layout/page-header.tsx`
**Duration**: 1.5 hours

**Specification**:

```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}
```

**Implementation Checklist**:

- [ ] Create component file with TypeScript interface
- [ ] Import and use Breadcrumbs component
- [ ] Implement title and description layout
- [ ] Add actions slot for buttons/filters
- [ ] Make responsive (mobile stacks vertically)
- [ ] Add proper spacing and typography
- [ ] Test with multiple layouts (with/without breadcrumbs, actions)
- [ ] Write unit tests
- [ ] Document usage with examples

**Example Usage**:

```typescript
<PageHeader
  title="Products"
  description="Manage your product inventory"
  breadcrumbs={[
    { label: "Dashboard", href: "/dashboard/start" },
    { label: "Warehouse", href: "/dashboard/warehouse" },
    { label: "Products" },
  ]}
  actions={
    <>
      <Button variant="outline">Import</Button>
      <Button>Add Product</Button>
    </>
  }
/>
```

**Testing Strategy**:

- Render with all props
- Render with minimal props
- Test responsive breakpoints
- Test breadcrumb navigation
- Test actions slot rendering

**Documentation**:

- Add to COMPONENT_REFERENCE.md
- Create usage examples
- Document responsive behavior
- Add to Storybook/preview page

---

### Phase 2: High Value Enhancements (Day 2-3 - 4 hours)

#### Task 2.1: Enhanced Search/Command Palette

**File**: `src/components/v2/layout/command-palette.tsx` (new file)
**Duration**: 3-4 hours

**See Part 2 below for full detailed plan**

---

#### Task 2.2: DashboardHeaderV2 Polish

**File**: `src/components/v2/layout/dashboard-header.tsx`
**Duration**: 0.5 hours

**Checklist**:

- [ ] Review all responsive breakpoints
- [ ] Test mobile layout
- [ ] Test tablet layout
- [ ] Test desktop layout
- [ ] Verify keyboard navigation
- [ ] Test with screen reader
- [ ] Check focus states
- [ ] Update tests if needed
- [ ] Update documentation

---

### Phase 3: Optional Enhancements (Future - 3-4 hours)

#### Task 3.1: Notification System

**Duration**: 3-4 hours
**Status**: Can be deferred to Phase 3/4

**Implementation Steps**:

1. **Database Schema** (0.5h)
   - Create notifications table
   - Add indexes
   - Set up RLS policies
   - Create migration

2. **Notification Service** (1h)
   - Create NotificationService class
   - Implement CRUD operations
   - Add real-time subscription
   - Handle permission checks

3. **UI Components** (1h)
   - Build notification popover
   - Create notification item component
   - Add empty state
   - Implement mark as read

4. **Integration** (0.5h)
   - Connect to Supabase Realtime
   - Add toast for new notifications
   - Implement unread badge count
   - Test real-time updates

5. **Testing & Polish** (0.5-1h)
   - Write unit tests
   - Test real-time subscriptions
   - Test on multiple devices
   - Document API

---

## Component Specifications

### PageHeader Component (Detailed Spec)

#### File Structure

```
src/components/v2/layout/
├── page-header.tsx           # Main component
└── __tests__/
    └── page-header.test.tsx  # Tests
```

#### Component Props

```typescript
interface PageHeaderProps {
  /** Page title - required */
  title: string;

  /** Optional description/subtitle */
  description?: string;

  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbItem[];

  /** Action buttons/components (right side on desktop) */
  actions?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /** Show back button (mobile) */
  showBackButton?: boolean;

  /** Custom back action */
  onBack?: () => void;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}
```

#### Layout Structure

```tsx
<div className="page-header">
  {/* Mobile: Back button + Title */}
  <div className="mobile-header md:hidden">
    {showBackButton && <BackButton />}
    <h1>{title}</h1>
  </div>

  {/* Desktop: Breadcrumbs + Title + Actions */}
  <div className="desktop-header hidden md:block">
    {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
    <div className="title-actions-row">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  </div>
</div>
```

#### Styling Guidelines

```typescript
// Typography
title: "text-2xl font-bold md:text-3xl"
description: "text-sm text-muted-foreground md:text-base"

// Spacing
container: "space-y-4 pb-4 border-b"
title-actions-row: "flex items-start justify-between gap-4"

// Responsive
mobile: "flex flex-col gap-2"
desktop: "flex items-center justify-between"
```

#### Usage Patterns

**Pattern 1: Simple Page**

```tsx
<PageHeader title="Settings" />
```

**Pattern 2: With Description**

```tsx
<PageHeader title="Products" description="Manage your product inventory" />
```

**Pattern 3: With Breadcrumbs**

```tsx
<PageHeader
  title="Product Details"
  breadcrumbs={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Products", href: "/dashboard/products" },
    { label: "Product Details" },
  ]}
/>
```

**Pattern 4: With Actions**

```tsx
<PageHeader
  title="Users"
  actions={
    <div className="flex gap-2">
      <Button variant="outline">Import</Button>
      <Button>Add User</Button>
    </div>
  }
/>
```

**Pattern 5: Full Featured**

```tsx
<PageHeader
  title="Organization Settings"
  description="Manage your organization preferences and billing"
  breadcrumbs={[
    { label: "Dashboard", href: "/dashboard" },
    { label: "Organization", href: "/dashboard/organization" },
    { label: "Settings" },
  ]}
  actions={
    <>
      <Button variant="outline">Cancel</Button>
      <Button>Save Changes</Button>
    </>
  }
/>
```

#### Accessibility Checklist

- [ ] Proper heading hierarchy (h1 for title)
- [ ] Breadcrumb navigation semantic markup
- [ ] Keyboard navigation for all actions
- [ ] Focus visible on interactive elements
- [ ] ARIA labels where needed
- [ ] Screen reader friendly structure

#### Testing Checklist

- [ ] Renders with minimal props (title only)
- [ ] Renders with all props
- [ ] Breadcrumbs navigate correctly
- [ ] Actions slot renders children
- [ ] Responsive layout works
- [ ] Back button on mobile (if enabled)
- [ ] Custom back action works
- [ ] CSS classes applied correctly

---

## Quality Gates

### Before Marking Complete

#### Code Quality

- [ ] `npm run type-check` - 0 errors
- [ ] `npm run lint` - 0 errors
- [ ] `npm run build` - Build succeeds
- [ ] All new components have TypeScript types
- [ ] No `any` types (except where necessary)

#### Functionality

- [ ] All components render without errors
- [ ] Responsive design works (mobile/tablet/desktop)
- [ ] Keyboard navigation works
- [ ] No console errors or warnings
- [ ] No hydration mismatches

#### Testing

- [ ] Critical components have unit tests
- [ ] Test coverage > 70%
- [ ] Manual testing completed
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

#### Documentation

- [ ] COMPONENT_REFERENCE.md updated
- [ ] Usage examples provided
- [ ] Props interface documented
- [ ] Integration guide written

#### Performance

- [ ] Page loads in < 2 seconds
- [ ] No unnecessary re-renders
- [ ] Proper memoization where needed
- [ ] Lighthouse score > 90

---

## Timeline

### Week 1: Critical Components

**Day 1 (1.5 hours)**

- [ ] Morning: PageHeader component (1h)
- [ ] Afternoon: Testing & documentation (0.5h)

**Day 1 Deliverable**: PageHeader component ready for use

---

**Day 2-3 (4 hours)**

- [ ] Enhanced Search/Command Palette (3-4h)
  - See Part 2 for detailed breakdown
  - Data model enhancement
  - Provider system
  - Recent searches
  - Keyboard shortcuts
  - Performance optimization

**Day 2-3 Deliverable**: Enhanced command palette ready

---

**Day 4 (0.5 hours)**

- [ ] DashboardHeaderV2 polish
- [ ] Final verification testing
- [ ] Documentation updates

**Day 4 Deliverable**: All layout components production-ready

---

### Future: Optional Enhancements

**Week 2+ (3-4 hours)**

- [ ] Notification system (when needed)
- [ ] Additional search providers
- [ ] Advanced keyboard shortcuts
- [ ] Customization options

---

## Success Criteria

### Definition of Done

#### Layout System Complete When:

- [x] All critical components implemented (7/7)
- [ ] PageHeader component ready for use
- [ ] Enhanced search working
- [ ] All components documented
- [ ] Test coverage > 70%
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] Ready for module development

#### Module Development Unblocked When:

- [ ] Developers can create new pages using PageHeader
- [ ] Navigation works seamlessly
- [ ] Search works for basic use cases
- [ ] Documentation clear and complete
- [ ] Example pages available for reference

---

## Risk Assessment

### Low Risk ✅

- PageHeader component (straightforward)
- DashboardHeaderV2 polish (minor changes)
- Documentation (time-consuming but clear)

### Medium Risk ⚠️

- Enhanced search (complex but well-scoped)
- Performance optimization (need profiling)
- Cross-browser testing (time investment)

### High Risk 🔴

- Notification system (complex, many moving parts)
- Real-time subscriptions (Supabase integration)
- Mobile performance (need testing on real devices)

**Mitigation Strategy**: Focus on Priority 1 (critical) first, defer high-risk items

---

## Dependencies

### External Dependencies

- shadcn/ui components (already installed)
- Lucide icons (already installed)
- React Hook Form (already installed)
- Zustand stores (already implemented)

### Internal Dependencies

- Phase 2 primitives (all complete ✅)
- Dashboard context loading (complete ✅)
- Permission system (complete ✅)
- Module system (complete ✅)

**No Blockers** - All dependencies met ✅

---

## Next Steps

### Immediate Actions (Start Now)

1. **Review this plan** with team/stakeholders
2. **Approve priorities** and timeline
3. **Create PageHeader component** (1.5h)
4. **Test with existing pages**
5. **Update documentation**

### Then (Day 2-3)

1. **Implement enhanced search** (see Part 2)
2. **Test thoroughly**
3. **Polish DashboardHeaderV2**

### Finally (Day 4)

1. **Final verification**
2. **Documentation updates**
3. **Mark Phase 2 layout complete**
4. **Unblock module development**

---

## Notes

### Architecture Principles

- **SSR-First**: All components work with Next.js 15 server components
- **Mobile-First**: Design for mobile, enhance for desktop
- **Accessible**: WCAG 2.1 AA compliance
- **Performant**: Lighthouse score > 90
- **Type-Safe**: Full TypeScript with no `any` types

### Best Practices

- Use shadcn/ui components first
- Never use sonner (only react-toastify)
- Follow existing patterns from Phase 2
- Document as you build
- Test on real devices

### Anti-Patterns to Avoid

- Don't reinvent existing components
- Don't skip TypeScript types
- Don't ignore responsive design
- Don't forget keyboard navigation
- Don't skip documentation

---

**Last Updated**: 2026-01-28
**Status**: 🟡 Planning Complete - Ready for Implementation
**Next Phase**: Implementation Day 1 - PageHeader Component

---

# Part 2: Enhanced Search/Command Palette - Detailed Implementation Plan

**Component**: Enhanced Command Palette (Cmd+K / Ctrl+K)
**Current Status**: 40% Complete (basic version exists)
**Target Status**: 100% Complete with extensible architecture
**Duration**: 3-4 hours
**Priority**: High (improves UX significantly)

---

## Vision & Goals

### Current State (Basic Version)

The current `QuickSwitcher` component has:

- ✅ Keyboard shortcut (Cmd+K / Ctrl+K)
- ✅ CommandDialog with basic search
- ✅ Hardcoded default actions
- ✅ Simple navigation

**Limitations**:

- Fixed action list (not dynamic)
- No categorization
- No recent searches
- No extensibility for future features
- Limited keyboard shortcuts
- No search scope filtering

### Target State (Enhanced Version)

**Goals**:

1. **Extensible Architecture**: Plugin system for search providers
2. **Rich Categories**: Modules, Pages, Actions, Settings, Help
3. **Recent Searches**: Track and suggest recent items
4. **Future-Ready**: Easy to add branch/user/client search later
5. **Performance**: Fast search (<100ms) with large datasets
6. **UX Excellence**: Keyboard shortcuts, icons, descriptions, badges

---

## Architecture Design

### Search Provider System

#### Provider Interface

```typescript
interface SearchProvider {
  /** Unique provider ID */
  id: string;

  /** Display name */
  name: string;

  /** Provider icon */
  icon: LucideIcon;

  /** Search function - returns results */
  search: (query: string, context: SearchContext) => Promise<SearchResult[]> | SearchResult[];

  /** Priority (higher = shown first) */
  priority?: number;

  /** Enabled by default */
  enabled?: boolean;

  /** Permission required to use */
  permission?: string;
}

interface SearchContext {
  activeOrgId: string;
  activeBranchId: string;
  userPermissions: string[];
  userModules: Module[];
}

interface SearchResult {
  /** Unique result ID */
  id: string;

  /** Provider ID */
  providerId: string;

  /** Result type */
  type: "navigation" | "action" | "command" | "shortcut";

  /** Display label */
  label: string;

  /** Optional description */
  description?: string;

  /** Icon */
  icon?: React.ReactNode;

  /** Badge (e.g., "New", "Beta") */
  badge?: string;

  /** Keywords for better matching */
  keywords?: string[];

  /** Action to perform on select */
  onSelect: () => void;

  /** Keyboard shortcut hint (e.g., "⌘⇧P") */
  shortcut?: string;

  /** Category for grouping */
  category?: string;
}
```

---

### Core Search Providers

#### 1. Navigation Provider

**Purpose**: Search module pages and routes
**Source**: `userModules` from `useAppStoreV2`

```typescript
const navigationProvider: SearchProvider = {
  id: "navigation",
  name: "Navigation",
  icon: Compass,
  priority: 100,
  search: (query, context) => {
    const results: SearchResult[] = [];

    context.userModules.forEach((module) => {
      module.routes?.forEach((route) => {
        if (fuzzyMatch(route.label, query)) {
          results.push({
            id: route.href,
            providerId: "navigation",
            type: "navigation",
            label: route.label,
            description: `Go to ${route.label}`,
            icon: <route.icon className="h-4 w-4" />,
            keywords: [module.slug, route.href],
            category: module.label,
            onSelect: () => router.push(route.href),
          });
        }
      });
    });

    return results;
  },
};
```

---

#### 2. Actions Provider

**Purpose**: Quick actions (create, import, export, etc.)
**Source**: Predefined actions based on current context

```typescript
const actionsProvider: SearchProvider = {
  id: "actions",
  name: "Actions",
  icon: Zap,
  priority: 90,
  search: (query, context) => {
    const actions: SearchResult[] = [];

    // Add create actions based on permissions
    if (can("warehouse.products.create")) {
      actions.push({
        id: "create-product",
        providerId: "actions",
        type: "action",
        label: "Create Product",
        description: "Add a new product to inventory",
        icon: <Plus className="h-4 w-4" />,
        shortcut: "⌘N",
        category: "Warehouse",
        onSelect: () => openCreateProductDialog(),
      });
    }

    if (can("teams.members.invite")) {
      actions.push({
        id: "invite-member",
        providerId: "actions",
        type: "action",
        label: "Invite Team Member",
        description: "Send an invitation email",
        icon: <UserPlus className="h-4 w-4" />,
        category: "Team",
        onSelect: () => openInviteMemberDialog(),
      });
    }

    return actions.filter((a) => fuzzyMatch(a.label, query));
  },
};
```

---

#### 3. Settings Provider

**Purpose**: Quick access to settings pages
**Source**: Settings routes

```typescript
const settingsProvider: SearchProvider = {
  id: "settings",
  name: "Settings",
  icon: Settings,
  priority: 70,
  search: (query, context) => {
    const settings = [
      {
        label: "Account Settings",
        href: "/dashboard/account/profile",
        icon: User,
        keywords: ["profile", "account", "user"],
      },
      {
        label: "Organization Settings",
        href: "/dashboard/organization/settings",
        icon: Building,
        keywords: ["org", "organization", "company"],
        permission: "organization.settings.edit",
      },
      {
        label: "Branch Settings",
        href: `/dashboard/organization/branches/${context.activeBranchId}/settings`,
        icon: MapPin,
        keywords: ["branch", "location"],
        permission: "branch.settings.edit",
      },
      {
        label: "Preferences",
        href: "/dashboard/account/preferences",
        icon: Sliders,
        keywords: ["prefs", "settings", "options"],
      },
    ];

    return settings
      .filter((s) => !s.permission || can(s.permission))
      .filter((s) => fuzzyMatch(s.label, query))
      .map((s) => ({
        id: s.href,
        providerId: "settings",
        type: "navigation",
        label: s.label,
        icon: <s.icon className="h-4 w-4" />,
        keywords: s.keywords,
        category: "Settings",
        onSelect: () => router.push(s.href),
      }));
  },
};
```

---

#### 4. Help Provider

**Purpose**: Quick access to documentation and support
**Source**: Help links

```typescript
const helpProvider: SearchProvider = {
  id: "help",
  name: "Help & Support",
  icon: HelpCircle,
  priority: 50,
  search: (query, context) => {
    const help = [
      {
        label: "Documentation",
        href: "/dashboard/support/help",
        icon: Book,
        keywords: ["docs", "help", "guide"],
      },
      {
        label: "Keyboard Shortcuts",
        icon: Keyboard,
        keywords: ["shortcuts", "keys", "hotkeys"],
        onSelect: () => openShortcutsModal(),
      },
      {
        label: "Contact Support",
        href: "/dashboard/support/contact",
        icon: Mail,
        keywords: ["help", "support", "contact", "email"],
      },
      {
        label: "Report Bug",
        icon: Bug,
        keywords: ["bug", "issue", "problem"],
        onSelect: () => openBugReportDialog(),
      },
    ];

    return help
      .filter((h) => fuzzyMatch(h.label, query))
      .map((h) => ({
        id: h.label.toLowerCase().replace(/\s+/g, "-"),
        providerId: "help",
        type: h.onSelect ? "action" : "navigation",
        label: h.label,
        icon: <h.icon className="h-4 w-4" />,
        keywords: h.keywords,
        category: "Help",
        onSelect: h.onSelect || (() => router.push(h.href!)),
      }));
  },
};
```

---

### Future-Ready Providers (Phase 3+)

#### 5. Branch Search Provider (Future)

```typescript
const branchSearchProvider: SearchProvider = {
  id: "branches",
  name: "Branches",
  icon: MapPin,
  priority: 80,
  permission: "organization.branches.view",
  search: async (query, context) => {
    // Fetch branches from API
    const branches = await fetchBranches(context.activeOrgId, query);

    return branches.map((branch) => ({
      id: branch.id,
      providerId: "branches",
      type: "action",
      label: branch.name,
      description: `Switch to ${branch.name}`,
      icon: <MapPin className="h-4 w-4" />,
      badge: branch.id === context.activeBranchId ? "Current" : undefined,
      category: "Branches",
      onSelect: () => switchToBranch(branch.id),
    }));
  },
};
```

---

#### 6. User Search Provider (Future)

```typescript
const userSearchProvider: SearchProvider = {
  id: "users",
  name: "Users",
  icon: Users,
  priority: 75,
  permission: "organization.users.view",
  search: async (query, context) => {
    // Fetch users from API
    const users = await searchUsers(context.activeOrgId, query);

    return users.map((user) => ({
      id: user.id,
      providerId: "users",
      type: "navigation",
      label: user.fullName,
      description: user.email,
      icon: <User className="h-4 w-4" />,
      category: "Users",
      onSelect: () => router.push(`/dashboard/users/${user.id}`),
    }));
  },
};
```

---

#### 7. Client Search Provider (Future - B2B)

```typescript
const clientSearchProvider: SearchProvider = {
  id: "clients",
  name: "Clients",
  icon: Building2,
  priority: 85,
  permission: "warehouse.b2b.clients.view",
  search: async (query, context) => {
    // Fetch clients from API
    const clients = await searchClients(context.activeOrgId, query);

    return clients.map((client) => ({
      id: client.id,
      providerId: "clients",
      type: "navigation",
      label: client.name,
      description: `${client.contactPerson} • ${client.email}`,
      icon: <Building2 className="h-4 w-4" />,
      category: "Clients",
      onSelect: () => router.push(`/dashboard/warehouse/b2b/clients/${client.id}`),
    }));
  },
};
```

---

## Implementation Plan

### Step 1: Enhance Data Model (0.5h)

**File**: `src/types/search.ts` (new)

**Checklist**:

- [ ] Create TypeScript interfaces (SearchProvider, SearchResult, SearchContext)
- [ ] Define provider priority system
- [ ] Add fuzzy matching utility
- [ ] Create result categorization types

---

### Step 2: Create Provider Registry (0.5h)

**File**: `src/lib/search/provider-registry.ts` (new)

```typescript
class SearchProviderRegistry {
  private providers: Map<string, SearchProvider> = new Map();

  register(provider: SearchProvider) {
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string) {
    this.providers.delete(providerId);
  }

  getProviders(): SearchProvider[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );
  }

  async search(query: string, context: SearchContext): Promise<SearchResult[]> {
    const providers = this.getProviders().filter((p) => {
      if (!p.enabled) return false;
      if (p.permission && !context.userPermissions.includes(p.permission)) return false;
      return true;
    });

    const results = await Promise.all(providers.map((p) => p.search(query, context)));

    return results.flat();
  }
}

export const searchRegistry = new SearchProviderRegistry();
```

**Checklist**:

- [ ] Implement provider registry class
- [ ] Add register/unregister methods
- [ ] Implement search aggregation
- [ ] Add permission filtering
- [ ] Export singleton instance

---

### Step 3: Implement Core Providers (1h)

**Files**:

- `src/lib/search/providers/navigation.provider.ts`
- `src/lib/search/providers/actions.provider.ts`
- `src/lib/search/providers/settings.provider.ts`
- `src/lib/search/providers/help.provider.ts`

**Checklist**:

- [ ] Implement navigation provider
- [ ] Implement actions provider
- [ ] Implement settings provider
- [ ] Implement help provider
- [ ] Register all providers in registry
- [ ] Test each provider individually

---

### Step 4: Build Enhanced UI Component (1h)

**File**: `src/components/v2/layout/command-palette.tsx` (new)

**Features to Implement**:

- [ ] CommandDialog with enhanced layout
- [ ] Category grouping (CommandGroup per provider)
- [ ] Result item with icon, label, description, badge
- [ ] Keyboard shortcuts display (kbd element)
- [ ] Recent searches section (top of list)
- [ ] Loading state during async search
- [ ] Empty state with helpful message
- [ ] Keyboard navigation (up/down/enter/esc)

**UI Structure**:

```tsx
<CommandDialog>
  <CommandInput placeholder="Search or jump to..." />

  <CommandList>
    {/* Recent Searches (if query empty) */}
    {query === "" && recentSearches.length > 0 && (
      <CommandGroup heading="Recent">
        {recentSearches.map((result) => (
          <SearchResultItem key={result.id} result={result} />
        ))}
      </CommandGroup>
    )}

    {/* Search Results by Category */}
    {Object.entries(groupedResults).map(([category, results]) => (
      <CommandGroup key={category} heading={category}>
        {results.map((result) => (
          <SearchResultItem key={result.id} result={result} />
        ))}
      </CommandGroup>
    ))}

    {/* Empty State */}
    <CommandEmpty>
      <div className="py-6 text-center text-sm">
        <p className="text-muted-foreground">No results found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try searching for pages, actions, or settings
        </p>
      </div>
    </CommandEmpty>
  </CommandList>
</CommandDialog>
```

---

### Step 5: Add Recent Searches (0.5h)

**File**: `src/lib/search/recent-searches.ts` (new)

**Implementation**:

```typescript
const RECENT_SEARCHES_KEY = "commandPalette_recent";
const MAX_RECENT = 5;

export function saveRecentSearch(result: SearchResult) {
  const recent = getRecentSearches();

  // Remove if exists (to re-add at top)
  const filtered = recent.filter((r) => r.id !== result.id);

  // Add to top, limit to MAX_RECENT
  const updated = [result, ...filtered].slice(0, MAX_RECENT);

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

export function getRecentSearches(): SearchResult[] {
  try {
    const data = localStorage.getItem(RECENT_SEARCHES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}
```

**Checklist**:

- [ ] Implement localStorage persistence
- [ ] Add save/get/clear methods
- [ ] Handle localStorage errors gracefully
- [ ] Limit to 5 recent items
- [ ] De-duplicate by result ID

---

### Step 6: Performance Optimization (0.5h)

**Optimizations to Implement**:

- [ ] Debounce search input (300ms)
- [ ] Memoize search results
- [ ] Lazy load providers
- [ ] Cancel previous search when new query
- [ ] Limit results per provider (max 10)
- [ ] Use virtual scrolling for 100+ results (optional)

**Example**:

```typescript
const debouncedSearch = useMemo(
  () =>
    debounce((query: string) => {
      setLoading(true);
      searchRegistry.search(query, context).then((results) => {
        setResults(results);
        setLoading(false);
      });
    }, 300),
  [context]
);
```

---

### Step 7: Keyboard Shortcuts Enhancement (0.5h)

**Additional Shortcuts**:

```typescript
const shortcuts = {
  "Cmd+K / Ctrl+K": "Open command palette",
  "Cmd+N / Ctrl+N": "Create new item (context-aware)",
  "Cmd+P / Ctrl+P": "Quick switch pages",
  "Cmd+Shift+P / Ctrl+Shift+P": "Show all commands",
  Escape: "Close palette",
  "↑↓": "Navigate results",
  Enter: "Select result",
  "Cmd+Backspace": "Clear search",
};
```

**Implementation**:

- [ ] Add global keyboard listener
- [ ] Implement shortcut handler
- [ ] Show shortcuts modal (? key)
- [ ] Display shortcuts in result items

---

### Step 8: Integration & Testing (0.5h)

**Integration Steps**:

- [ ] Replace QuickSwitcher with CommandPalette
- [ ] Update DashboardHeaderV2 to use new component
- [ ] Register all providers on app init
- [ ] Test with real user data
- [ ] Test permission filtering
- [ ] Test on mobile (touch-friendly)

**Testing Checklist**:

- [ ] Search works with empty query
- [ ] Search finds results across providers
- [ ] Recent searches persist
- [ ] Keyboard shortcuts work
- [ ] Categories group correctly
- [ ] Icons and badges display
- [ ] Performance is good (<100ms)
- [ ] Works on mobile
- [ ] Screen reader accessible

---

## UI/UX Specifications

### Visual Design

#### Result Item Layout

```
┌─────────────────────────────────────────────────┐
│ [Icon] Label                          [Badge]   │
│        Description                     [⌘⇧P]    │
└─────────────────────────────────────────────────┘
```

#### Category Headers

```
Navigation
───────────────────────────────────────────────────
```

#### Empty State

```
       ╭─────╮
       │  🔍 │
       ╰─────╯
    No results found
Try searching for pages, actions, or settings
```

### Interaction Design

**Open**:

- Cmd+K / Ctrl+K
- Click search button in header

**Navigate**:

- ↑↓ arrow keys
- Mouse hover
- Tab key (accessibility)

**Select**:

- Enter key
- Mouse click

**Close**:

- Escape key
- Click outside
- Select a result

**Clear**:

- Cmd+Backspace / Ctrl+Backspace
- Click X button in input

### Responsive Behavior

**Desktop (>1024px)**:

- Dialog width: 640px
- Max height: 600px
- Centered on screen

**Tablet (768px - 1024px)**:

- Dialog width: 90vw
- Max height: 80vh
- Centered on screen

**Mobile (<768px)**:

- Full screen modal
- No max height
- Optimized for touch

---

## Testing Strategy

### Unit Tests

**File**: `src/lib/search/__tests__/provider-registry.test.ts`

- [ ] Test provider registration
- [ ] Test provider priority sorting
- [ ] Test permission filtering
- [ ] Test search aggregation
- [ ] Test async provider handling

**File**: `src/lib/search/__tests__/navigation.provider.test.ts`

- [ ] Test module route search
- [ ] Test fuzzy matching
- [ ] Test keyword matching
- [ ] Test empty query handling

---

### Integration Tests

**File**: `src/components/v2/layout/__tests__/command-palette.test.tsx`

- [ ] Test dialog opens/closes
- [ ] Test search executes on input
- [ ] Test results render correctly
- [ ] Test category grouping
- [ ] Test result selection
- [ ] Test keyboard navigation
- [ ] Test recent searches
- [ ] Test permission filtering

---

### E2E Tests

**File**: `e2e/command-palette.spec.ts`

- [ ] Open palette with Cmd+K
- [ ] Search for "products"
- [ ] Select result
- [ ] Verify navigation
- [ ] Test on mobile
- [ ] Test with screen reader

---

## Performance Benchmarks

### Targets

- Search latency: < 100ms (95th percentile)
- Dialog open time: < 50ms
- Results render time: < 100ms
- Memory usage: < 5MB
- Bundle size increase: < 20KB gzipped

### Monitoring

- [ ] Add performance marks
- [ ] Track search latency
- [ ] Monitor result count
- [ ] Track provider execution time
- [ ] Log slow providers

---

## Documentation

### User Documentation

**File**: `docs/features/command-palette.md`

- [ ] Feature overview
- [ ] Keyboard shortcuts
- [ ] Search tips
- [ ] Supported categories
- [ ] How to use effectively

### Developer Documentation

**File**: `docs/development/search-providers.md`

- [ ] Provider interface
- [ ] How to create custom provider
- [ ] How to register provider
- [ ] Best practices
- [ ] Examples

**Update**: `COMPONENT_REFERENCE.md`

- [ ] Add CommandPalette component
- [ ] Document props and usage
- [ ] Add examples

---

## Migration from QuickSwitcher

### Migration Steps

1. [ ] Create new CommandPalette component
2. [ ] Implement all providers
3. [ ] Test thoroughly
4. [ ] Update DashboardHeaderV2
5. [ ] Remove old QuickSwitcher
6. [ ] Update all imports
7. [ ] Delete old files

### Backwards Compatibility

- Keep QuickSwitcher for 1-2 versions (deprecated)
- Add deprecation warning
- Provide migration guide

---

## Future Enhancements (Phase 3+)

### Advanced Features

- [ ] Search syntax (e.g., `@user:john`, `#tag:important`)
- [ ] Search filters (scope: module, type: action)
- [ ] Search history analytics
- [ ] AI-powered suggestions
- [ ] Custom user commands
- [ ] Slash commands (e.g., `/create-product`)
- [ ] Plugin system for third-party providers

### Enterprise Features

- [ ] Multi-org search
- [ ] Cross-branch search
- [ ] Global search (all accessible resources)
- [ ] Advanced filtering
- [ ] Search result ranking/scoring
- [ ] Search analytics dashboard

---

## Success Metrics

### Quantitative

- Search success rate > 90%
- Average search time < 2 seconds
- Dialog open time < 100ms
- User adoption > 70% (tracked via analytics)
- Keyboard shortcut usage > 40%

### Qualitative

- Users find it intuitive
- Reduces navigation clicks
- Improves productivity
- Positive user feedback

---

## Risk Assessment

### Technical Risks

- **Performance degradation with many providers**: Mitigate with debouncing, limits
- **Async provider delays**: Mitigate with loading states, timeouts
- **Memory leaks from event listeners**: Mitigate with cleanup in useEffect
- **Bundle size bloat**: Mitigate with lazy loading, code splitting

### UX Risks

- **Too many results overwhelming**: Mitigate with categorization, limits
- **Empty results frustrating**: Mitigate with helpful empty state
- **Learning curve for shortcuts**: Mitigate with onboarding, hints

**Mitigation**: Thorough testing, user feedback, performance monitoring

---

## Conclusion

### Summary

This enhanced command palette will:

1. ✅ Provide fast, extensible search across the entire app
2. ✅ Support future features (branches, users, clients) with no refactoring
3. ✅ Improve UX with categories, recent searches, keyboard shortcuts
4. ✅ Maintain performance even with large datasets
5. ✅ Be accessible, responsive, and production-ready

### Estimated Effort

- **Total**: 3-4 hours
- **Priority**: High (significant UX improvement)
- **Complexity**: Medium (well-architected, clear scope)
- **Risk**: Low (incremental enhancement to existing component)

### Next Steps

1. Review and approve this detailed plan
2. Create TypeScript types and interfaces
3. Implement provider registry
4. Build core providers
5. Enhance UI component
6. Test thoroughly
7. Deploy to production

---

**Last Updated**: 2026-01-28
**Status**: 📋 Planning Complete - Ready for Implementation
**Next Action**: Begin Step 1 - Enhance Data Model
