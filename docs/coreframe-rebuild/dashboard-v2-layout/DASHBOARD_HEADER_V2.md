# Dashboard Header V2 - Component Verification & Progress Tracker

**Component**: Dashboard Header V2
**File**: `src/components/v2/layout/dashboard-header.tsx`
**Created**: TBD
**Updated**: 2026-01-19
**Status**: ⬜ Not Started

---

## Progress Overview

| Category             | Progress      | Status             |
| -------------------- | ------------- | ------------------ |
| Implementation       | 0% (0/10)     | ⬜ Not Started     |
| Search Functionality | 0% (0/8)      | ⬜ Not Started     |
| Notifications        | 0% (0/7)      | ⬜ Not Started     |
| User Menu            | 0% (0/6)      | ⬜ Not Started     |
| Visual Design        | 0% (0/6)      | ⬜ Not Started     |
| Responsiveness       | 0% (0/5)      | ⬜ Not Started     |
| Accessibility        | 0% (0/6)      | ⬜ Not Started     |
| **TOTAL**            | **0% (0/48)** | **⬜ Not Started** |

---

## Implementation Checklist

### Core Structure

- [ ] Client component with `"use client"` directive
- [ ] Fixed/sticky header (remains visible on scroll)
- [ ] Full-width layout
- [ ] Integrates with SidebarV2 (proper spacing)
- [ ] Uses Tailwind CSS for styling

### Header Sections

- [ ] **Left Section**: Sidebar toggle button (mobile) + breadcrumbs
- [ ] **Center Section**: Global search bar (command palette)
- [ ] **Right Section**: Notifications + user profile menu
- [ ] Proper flex/grid layout for alignment
- [ ] Responsive breakpoints for different layouts

### Breadcrumbs

- [ ] Displays current route hierarchy (e.g., "Dashboard > Warehouse > Products")
- [ ] Generated from current pathname
- [ ] Links to parent routes
- [ ] Translatable route names
- [ ] Truncates long breadcrumbs on mobile

---

## Search Functionality Checklist

### Command Palette

- [ ] Uses shadcn/ui Command component
- [ ] Opens with keyboard shortcut (Ctrl+K / Cmd+K)
- [ ] Opens when clicking search input
- [ ] Fuzzy search across modules, pages, actions
- [ ] Keyboard navigation (arrow keys, enter)

### Search Scope

- [ ] Searches navigation items (filtered by permissions)
- [ ] Searches recent pages
- [ ] Searches quick actions (if applicable)
- [ ] Shows "No results" state
- [ ] Closes on selection

### Search UX

- [ ] Instant results (< 100ms)
- [ ] Highlighted matching text
- [ ] Icons for each result type
- [ ] Keyboard shortcut hints visible
- [ ] Search history (optional)

---

## Notifications Checklist

### Notification Bell

- [ ] Bell icon button in header
- [ ] Unread count badge visible
- [ ] Badge hidden when count is 0
- [ ] Opens notification popover on click
- [ ] Notification dot indicator for new items

### Notification List

- [ ] Shows recent notifications (last 10-20)
- [ ] Each notification has: icon, title, timestamp, read/unread state
- [ ] Clicking notification marks as read
- [ ] "Mark all as read" action
- [ ] "View all notifications" link to full page
- [ ] Empty state when no notifications

### Real-time Updates (Optional)

- [ ] Notifications update in real-time (Supabase Realtime or polling)
- [ ] Toast notification for important events
- [ ] Sound/visual alert for critical notifications (optional)

---

## User Menu Checklist

### Profile Button

- [ ] User avatar displayed (or initials fallback)
- [ ] User name from `useUserStoreV2.user`
- [ ] Dropdown menu on click
- [ ] Hover state visible
- [ ] Focus state for keyboard navigation

### Menu Items

- [ ] Profile/Account settings link
- [ ] Organization settings link (if permitted)
- [ ] Language/locale switcher
- [ ] Theme switcher (light/dark mode)
- [ ] Sign out button
- [ ] Dividers between sections

---

## Visual Design Checklist

### Styling & Theme

- [ ] Consistent with design system
- [ ] Border/shadow separating from content
- [ ] Background color matches theme
- [ ] Icons properly sized and aligned
- [ ] Text legible and properly sized

### Interactive States

- [ ] Hover states on all buttons
- [ ] Focus states visible
- [ ] Active states for dropdowns
- [ ] Disabled states (if applicable)
- [ ] Loading states for async actions

---

## Responsiveness Checklist

### Desktop (>1024px)

- [ ] All sections visible
- [ ] Search bar expanded
- [ ] Full user name visible
- [ ] Notifications and user menu side-by-side

### Tablet (768px - 1024px)

- [ ] Sidebar toggle button visible
- [ ] Search bar slightly compressed
- [ ] User name may be hidden (avatar only)

### Mobile (<768px)

- [ ] Hamburger menu button for sidebar
- [ ] Search icon only (opens command palette)
- [ ] Notifications icon only (no text)
- [ ] User avatar only (no name)
- [ ] Proper spacing and touch targets

---

## Accessibility Checklist

### Keyboard Navigation

- [ ] All buttons reachable via Tab
- [ ] Search opens with Ctrl+K
- [ ] Escape closes dropdowns
- [ ] Arrow keys navigate menus
- [ ] Enter/Space activates buttons

### Screen Reader Support

- [ ] Semantic HTML structure
- [ ] ARIA labels on icon-only buttons
- [ ] ARIA expanded state on dropdowns
- [ ] Notification count announced
- [ ] Keyboard shortcuts announced

---

## Integration Points

### Store Dependencies

- **useUserStoreV2**: `user` (avatar, name, email)
- **useUiStoreV2**: `sidebarOpen`, `setSidebarOpen()`
- **useAppStoreV2**: `activeBranch` (for context in breadcrumbs)

### Routing

- Uses `usePathname()` for breadcrumb generation
- Uses Next.js `<Link>` for navigation
- Locale-aware routing

### Command Palette

- Integrates with module navigation
- Filters by permissions
- Uses fuzzy search library (e.g., fuse.js or built-in Command filter)

---

## Manual Testing Checklist

### Visual Testing

- [ ] Header looks correct on desktop
- [ ] Header looks correct on tablet
- [ ] Header looks correct on mobile
- [ ] No layout shift on scroll
- [ ] Icons and text aligned properly

### Functional Testing

- [ ] Sidebar toggle works on mobile
- [ ] Search opens with Ctrl+K
- [ ] Search results filter correctly
- [ ] Notifications popover opens
- [ ] User menu dropdown works
- [ ] Sign out works correctly
- [ ] Breadcrumbs navigate correctly

### Cross-Browser Testing

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

---

## Detailed Component Specification

### File Structure

```
src/components/v2/layout/
├── dashboard-header.tsx          # Main header component
├── header-search.tsx             # Search/command palette
├── header-notifications.tsx      # Notification bell + popover
├── header-user-menu.tsx          # User profile dropdown
└── header-breadcrumbs.tsx        # Breadcrumb navigation
```

### Component Props

```typescript
// dashboard-header.tsx
interface DashboardHeaderProps {
  // No props - reads from stores and routing
}
```

### Search Command Structure

```typescript
interface SearchCommand {
  id: string;
  type: "navigation" | "action" | "page";
  label: string;
  description?: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  keywords?: string[]; // For search matching
}
```

### Notification Structure

```typescript
interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}
```

### Breadcrumb Generation

```typescript
function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => ({
    label: translateSegment(segment), // Get translated label
    href: "/" + segments.slice(0, index + 1).join("/"),
  }));
  return breadcrumbs;
}
```

---

## Example Header Structure

```tsx
export function DashboardHeader() {
  const { user } = useUserStoreV2();
  const { setSidebarOpen } = useUiStoreV2();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4">
        {/* Left: Mobile sidebar toggle + Breadcrumbs */}
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Breadcrumbs />
        </div>

        {/* Center: Search */}
        <div className="hidden md:block flex-1 max-w-md">
          <HeaderSearch />
        </div>

        {/* Right: Notifications + User Menu */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => openCommandPalette()}
          >
            <Search className="h-5 w-5" />
          </Button>
          <HeaderNotifications />
          <HeaderUserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
```

---

## Command Palette Example

```tsx
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useRouter();
  const { userModules } = useAppStoreV2();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const commands = useMemo(() => {
    // Generate commands from modules
    return userModules.flatMap((module) =>
      module.routes.map((route) => ({
        id: route.href,
        type: "navigation" as const,
        label: route.label,
        icon: route.icon,
        href: route.href,
      }))
    );
  }, [userModules]);

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search... <Kbd>⌘K</Kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {commands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={() => {
                  navigate.push(cmd.href);
                  setOpen(false);
                }}
              >
                <cmd.icon className="mr-2 h-4 w-4" />
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

---

## Performance Benchmarks

- [ ] Header render time < 50ms
- [ ] Search results appear < 100ms after typing
- [ ] Command palette opens < 50ms
- [ ] No layout shift when sticky
- [ ] Smooth scroll behavior

---

## Accessibility Audit

- [ ] Lighthouse Accessibility score > 95
- [ ] axe DevTools: 0 violations
- [ ] Keyboard-only navigation works
- [ ] Screen reader tested
- [ ] Focus visible on all interactive elements

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

- Header must work with both sidebar expanded and collapsed states
- Search is critical for navigation - must be fast and accurate
- Notifications are optional but recommended for production apps
- User menu must include sign out at minimum
