# Sidebar V2 - Component Verification & Progress Tracker

**Component**: Sidebar V2 (shadcn/ui native)
**File**: `src/components/v2/layout/sidebar-v2.tsx`
**Created**: 2026-01-17
**Updated**: 2026-01-19
**Status**: ⬜ Not Started

---

## Progress Overview

| Category       | Progress      | Status             |
| -------------- | ------------- | ------------------ |
| Implementation | 0% (0/15)     | ⬜ Not Started     |
| Visual Design  | 0% (0/8)      | ⬜ Not Started     |
| Interactivity  | 0% (0/12)     | ⬜ Not Started     |
| Responsiveness | 0% (0/6)      | ⬜ Not Started     |
| Accessibility  | 0% (0/8)      | ⬜ Not Started     |
| Performance    | 0% (0/5)      | ⬜ Not Started     |
| **TOTAL**      | **0% (0/54)** | **⬜ Not Started** |

---

## Implementation Checklist

### Core Structure

- [ ] Uses shadcn/ui Sidebar component (`npx shadcn@latest add sidebar`)
- [ ] Implements proper sidebar structure with header, content, footer
- [ ] Client component with `"use client"` directive
- [ ] Reads `sidebarOpen` state from `useUiStoreV2`
- [ ] Calls `setSidebarOpen()` to toggle state

### Navigation Items

- [ ] Loads navigation items from `getAllModules(activeOrgId)`
- [ ] Displays module icons (Lucide icons)
- [ ] Shows module names with translations (`useTranslations("modules")`)
- [ ] Highlights active route based on current pathname
- [ ] Groups items by category (if applicable)

### Module-Based Routing

- [ ] Dynamically generates routes from module config
- [ ] Handles nested navigation (submenus if needed)
- [ ] Links use Next.js `<Link>` component for client-side navigation
- [ ] Prefetches routes on hover (Next.js default behavior)
- [ ] Correct locale prefix in all routes (e.g., `/en/dashboard/...`)

### Sidebar Header

- [ ] Displays organization logo/name
- [ ] Shows branch name from `useAppStoreV2.activeBranch`
- [ ] Includes branch switcher component (or link to it)
- [ ] Responsive to sidebar collapsed state

### Sidebar Footer

- [ ] User profile section with avatar
- [ ] Displays user name from `useUserStoreV2.user`
- [ ] Settings/preferences link
- [ ] Sign out button

---

## Visual Design Checklist

### Styling & Theme

- [ ] Uses Tailwind CSS classes
- [ ] Follows design system colors and spacing
- [ ] Supports light/dark mode (CSS variables)
- [ ] Consistent with shadcn/ui design tokens

### Layout & Spacing

- [ ] Fixed width when expanded (default: 240px)
- [ ] Collapsed width (default: 64px for icons only)
- [ ] Proper padding and margins for all sections
- [ ] Smooth transitions between expanded/collapsed states

### Visual States

- [ ] Active navigation item styling (highlighted)
- [ ] Hover states on all interactive elements
- [ ] Focus states for keyboard navigation
- [ ] Disabled state for unavailable items (permission-based)

---

## Interactivity Checklist

### Sidebar Toggle

- [ ] Toggle button visible and functional
- [ ] Clicking toggle updates `useUiStoreV2.sidebarOpen`
- [ ] Sidebar expands/collapses smoothly
- [ ] Toggle state persists across page navigation
- [ ] Keyboard shortcut (e.g., `Ctrl+B`) to toggle sidebar

### Navigation Behavior

- [ ] Clicking nav item navigates to correct route
- [ ] Active route highlighted automatically
- [ ] Nested items expand/collapse correctly (if applicable)
- [ ] Back button navigation updates active state
- [ ] No full page reload on navigation (SPA behavior)

### Permission-Based Visibility

- [ ] Nav items filtered by `usePermissions().can()`
- [ ] Hidden items don't appear in collapsed mode
- [ ] Items with no permission are not rendered (not just hidden)
- [ ] Permission changes update navigation dynamically

---

## Responsiveness Checklist

### Desktop (>768px)

- [ ] Sidebar visible by default
- [ ] Toggle button collapses sidebar to icon-only mode
- [ ] Full navigation labels visible when expanded

### Tablet (768px - 1024px)

- [ ] Sidebar starts collapsed by default
- [ ] Expands on toggle
- [ ] Overlays content when expanded (mobile-style)

### Mobile (<768px)

- [ ] Sidebar hidden by default
- [ ] Opens as overlay/drawer when toggled
- [ ] Closes when clicking outside sidebar
- [ ] Full-width when open (or near full-width)

---

## Accessibility Checklist

### Keyboard Navigation

- [ ] All nav items reachable via Tab key
- [ ] Enter/Space activates navigation
- [ ] Arrow keys navigate between items (optional but recommended)
- [ ] Escape key closes sidebar on mobile
- [ ] Focus trap when sidebar is open on mobile

### Screen Reader Support

- [ ] Semantic HTML (`<nav>`, `<ul>`, `<li>`)
- [ ] ARIA labels on interactive elements
- [ ] ARIA expanded state on toggle button
- [ ] Screen reader announces active route
- [ ] Skip navigation link (optional)

---

## Performance Checklist

### Rendering Performance

- [ ] No unnecessary re-renders when sidebar state changes
- [ ] Navigation items memoized (if large list)
- [ ] Icons lazy loaded or bundled efficiently
- [ ] Smooth animations without jank (60fps)

### Bundle Size

- [ ] Only imports needed shadcn/ui components
- [ ] Tree-shaking removes unused code
- [ ] Icon library optimized (only used icons imported)

---

## Manual Testing Checklist

### Visual Testing

- [ ] Sidebar looks correct in expanded state
- [ ] Sidebar looks correct in collapsed state
- [ ] Active route highlighted correctly
- [ ] Hover/focus states visible
- [ ] No layout shift when toggling sidebar
- [ ] Icons aligned properly

### Functional Testing

- [ ] Toggle button opens/closes sidebar
- [ ] Navigation links work on all routes
- [ ] Active state updates on route change
- [ ] Permission-based filtering works correctly
- [ ] Branch switching updates navigation (if modules change)

### Cross-Browser Testing

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

### Device Testing

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## Integration Points

### Store Dependencies

- **useUiStoreV2**: `sidebarOpen`, `setSidebarOpen()`
- **useAppStoreV2**: `activeOrgId`, `activeBranch`, `userModules`
- **useUserStoreV2**: `user` (for profile section)
- **usePermissions**: `can()` (for filtering navigation)

### Module System

- Calls `getAllModules(activeOrgId)` to get navigation items
- Each module defines routes via `config.ts`
- Module icons from Lucide React

### Routing

- Uses Next.js App Router
- Links with locale prefix: `/[locale]/dashboard/...`
- Active route detection via `usePathname()`

---

## Known Issues / Edge Cases

### Permission Changes

- [ ] Navigation updates when permissions change (via PermissionsSync)
- [ ] No console errors when module list changes
- [ ] Gracefully handles empty module list

### Branch Switching

- [ ] Sidebar remains stable during branch switch
- [ ] Module list updates if branch has different modules
- [ ] No flash of incorrect navigation items

### SSR/Hydration

- [ ] No hydration mismatch warnings
- [ ] Sidebar state consistent between server and client
- [ ] Toggle button functional immediately on page load

---

## Detailed Component Specification

### File Structure

```
src/components/v2/layout/
├── sidebar-v2.tsx              # Main sidebar component
├── sidebar-nav.tsx             # Navigation items list
├── sidebar-header.tsx          # Header section
├── sidebar-footer.tsx          # Footer section
└── sidebar-nav-item.tsx        # Individual nav item
```

### Component Props

```typescript
// sidebar-v2.tsx
interface SidebarV2Props {
  // No props needed - reads from stores
}

// sidebar-nav-item.tsx
interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: string | number; // Optional notification badge
}
```

### Sidebar States

```typescript
type SidebarState = {
  open: boolean; // From useUiStoreV2
  collapsed: boolean; // Desktop collapsed state
  isMobile: boolean; // Responsive breakpoint detection
};
```

### Navigation Item Structure

```typescript
interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  permission?: string; // Required permission to view
  badge?: string | number;
  children?: NavigationItem[]; // For nested navigation
}
```

### Permissions Integration

```typescript
// Filter navigation by permissions
const visibleItems = navigationItems.filter((item) => {
  if (!item.permission) return true;
  return can(item.permission);
});
```

### Active Route Detection

```typescript
const pathname = usePathname();
const isActive = (href: string) => {
  // Exact match for dashboard home
  if (href === "/dashboard/start" && pathname === "/dashboard/start") {
    return true;
  }
  // Prefix match for other routes
  return pathname.startsWith(href) && href !== "/dashboard/start";
};
```

### Responsive Behavior

```typescript
const isMobile = useMediaQuery("(max-width: 768px)");
const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1024px)");

// Mobile: drawer overlay
// Tablet: collapsed by default, overlay when expanded
// Desktop: expanded by default, collapsible
```

---

## shadcn/ui Sidebar Components Used

### Core Components

- `Sidebar` - Main container
- `SidebarHeader` - Top section
- `SidebarContent` - Scrollable navigation area
- `SidebarFooter` - Bottom section
- `SidebarGroup` - Groups of related items
- `SidebarGroupLabel` - Group labels
- `SidebarMenu` - Navigation menu wrapper
- `SidebarMenuItem` - Individual menu items
- `SidebarMenuButton` - Interactive buttons
- `SidebarTrigger` - Toggle button

### Example Structure

```tsx
<Sidebar>
  <SidebarHeader>
    <OrganizationInfo />
    <BranchSwitcher />
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {navigationItems.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={isActive(item.href)}>
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter>
    <UserProfile />
  </SidebarFooter>
</Sidebar>
```

---

## Testing Strategy

### Unit Tests

- [ ] Navigation filtering by permissions
- [ ] Active route detection logic
- [ ] Module loading and transformation

### Integration Tests

- [ ] Sidebar toggle updates store
- [ ] Navigation updates on permission change
- [ ] Branch switching updates module list

### Visual Regression Tests

- [ ] Expanded state screenshot
- [ ] Collapsed state screenshot
- [ ] Mobile overlay screenshot
- [ ] Active state screenshot

---

## Performance Benchmarks

- [ ] Initial render < 50ms
- [ ] Toggle animation smooth (60fps)
- [ ] Route change updates active state < 16ms
- [ ] No layout shift (CLS = 0)

---

## Accessibility Audit

- [ ] Lighthouse Accessibility score > 95
- [ ] axe DevTools: 0 violations
- [ ] Keyboard-only navigation works
- [ ] Screen reader tested with NVDA/JAWS

---

## Browser Compatibility

- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

---

## Documentation Status

- [ ] Component usage documented
- [ ] Props interface documented
- [ ] Store integration documented
- [ ] Permission filtering documented

---

## Sign-Off Checklist

- [ ] All checkboxes above completed
- [ ] Code reviewed by senior developer
- [ ] Visual design approved by designer
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] No console errors or warnings
- [ ] Works on all target browsers/devices

**Ready for Production**: ⬜ NO

---

## Notes

- Sidebar must work seamlessly with BranchSwitcher component
- Module-based navigation is dynamic - changes per org/branch
- Permission filtering is critical for security UX
- Must handle both org-level and branch-level modules
