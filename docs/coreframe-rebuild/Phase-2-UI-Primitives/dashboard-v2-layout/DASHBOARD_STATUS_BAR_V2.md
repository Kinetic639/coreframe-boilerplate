# Dashboard Status Bar V2 - Component Verification & Progress Tracker

**Component**: Dashboard Status Bar V2 (Bottom Bar)
**File**: `src/components/v2/layout/dashboard-status-bar.tsx`
**Created**: TBD
**Updated**: 2026-01-19
**Status**: ⬜ Not Started

---

## Progress Overview

| Category          | Progress      | Status             |
| ----------------- | ------------- | ------------------ |
| Implementation    | 0% (0/8)      | ⬜ Not Started     |
| Status Indicators | 0% (0/6)      | ⬜ Not Started     |
| System Info       | 0% (0/5)      | ⬜ Not Started     |
| Visual Design     | 0% (0/5)      | ⬜ Not Started     |
| Responsiveness    | 0% (0/4)      | ⬜ Not Started     |
| Accessibility     | 0% (0/4)      | ⬜ Not Started     |
| **TOTAL**         | **0% (0/32)** | **⬜ Not Started** |

---

## Implementation Checklist

### Core Structure

- [ ] Client component with `"use client"` directive
- [ ] Fixed bottom bar (always visible)
- [ ] Full-width layout
- [ ] Integrates with sidebar (proper spacing)
- [ ] Height: 32px - 40px (compact)

### Bar Sections

- [ ] **Left Section**: Current route/page title or context
- [ ] **Center Section**: System status indicators
- [ ] **Right Section**: Version, environment, sync status
- [ ] Proper flex layout for alignment
- [ ] Responsive breakpoints

---

## Status Indicators Checklist

### Connection Status

- [ ] Online/offline indicator
- [ ] Connection quality (good/slow/poor) - optional
- [ ] Visual indicator (green/yellow/red dot)
- [ ] Tooltip on hover explaining status
- [ ] Real-time updates when connection changes

### Sync Status

- [ ] Shows when data is syncing (React Query refetching)
- [ ] "Synced" state with checkmark
- [ ] "Syncing..." with loading spinner
- [ ] "Sync failed" with error indicator
- [ ] Last sync timestamp

### Branch Context

- [ ] Shows current branch name (compact)
- [ ] Optional: Organization name
- [ ] Clickable to open branch switcher
- [ ] Badge/tag styling

---

## System Info Checklist

### Version Information

- [ ] App version (from package.json)
- [ ] Build number or commit hash (optional)
- [ ] Click to show detailed version info
- [ ] Only visible in development (optional)

### Environment Badge

- [ ] Shows "Development" | "Staging" | "Production"
- [ ] Color-coded badges (red for dev, yellow for staging, hidden for prod)
- [ ] Only visible in non-production environments

### Additional Info

- [ ] Current user role badge (optional)
- [ ] Active features flags (optional)
- [ ] Debug mode indicator (optional)

---

## Visual Design Checklist

### Styling & Theme

- [ ] Subtle background (doesn't dominate UI)
- [ ] Border top for separation
- [ ] Text small but readable (12px - 13px)
- [ ] Icons appropriately sized (12px - 14px)
- [ ] Consistent with design system

### Status Colors

- [ ] Green: Success/Online/Synced
- [ ] Yellow: Warning/Slow/Degraded
- [ ] Red: Error/Offline/Failed
- [ ] Gray: Neutral/Unknown
- [ ] Colors work in both light and dark mode

---

## Responsiveness Checklist

### Desktop (>1024px)

- [ ] All sections visible
- [ ] Full text labels shown
- [ ] Proper spacing between items

### Tablet/Mobile (<1024px)

- [ ] Hides less important info
- [ ] Shows icons only (no labels)
- [ ] Compact spacing
- [ ] Essential info remains visible

---

## Accessibility Checklist

### Keyboard Navigation

- [ ] Focusable elements reachable via Tab
- [ ] Tooltips on hover and focus
- [ ] Status announcements (optional)

### Screen Reader Support

- [ ] Status indicators have ARIA labels
- [ ] Connection changes announced
- [ ] Sync status changes announced
- [ ] Semantic HTML (`<footer>` tag)

---

## Integration Points

### Store Dependencies

- **useAppStoreV2**: `activeBranch.name`, `activeOrg.name`
- **useUserStoreV2**: `user.roles` (optional for role badge)
- Online status: `window.navigator.onLine` or custom hook

### React Query Integration

- [ ] Monitors React Query global state
- [ ] Shows loading indicator when any query is fetching
- [ ] Shows error indicator if queries failed
- [ ] Access via `useIsFetching()` and `useIsMutating()` hooks

### Environment Variables

```typescript
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";
const buildCommit = process.env.NEXT_PUBLIC_BUILD_COMMIT?.slice(0, 7);
```

---

## Manual Testing Checklist

### Visual Testing

- [ ] Status bar visible on all pages
- [ ] Doesn't overlap with content
- [ ] Readable text and icons
- [ ] Proper alignment
- [ ] Works with sidebar expanded/collapsed

### Functional Testing

- [ ] Connection status updates when going offline
- [ ] Sync status reflects React Query state
- [ ] Branch name matches current branch
- [ ] Version info is correct
- [ ] Environment badge shows correct environment

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
├── dashboard-status-bar.tsx      # Main status bar component
├── status-connection.tsx         # Connection indicator
├── status-sync.tsx               # Sync indicator
└── status-version.tsx            # Version info
```

### Component Props

```typescript
// dashboard-status-bar.tsx
interface DashboardStatusBarProps {
  // No props - reads from stores and environment
}
```

### Status Types

```typescript
type ConnectionStatus = "online" | "offline" | "slow";
type SyncStatus = "idle" | "syncing" | "synced" | "error";
type Environment = "development" | "staging" | "production";
```

---

## Example Status Bar Structure

```tsx
export function DashboardStatusBar() {
  const { activeBranch, activeOrg } = useAppStoreV2();
  const isOnline = useOnlineStatus();
  const isSyncing = useIsFetching() > 0;

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 border-t bg-background/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 text-xs text-muted-foreground">
        {/* Left: Current context */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline">{activeOrg?.name}</span>
          <ChevronRight className="h-3 w-3 hidden md:inline" />
          <Badge variant="outline" className="text-xs">
            {activeBranch?.name}
          </Badge>
        </div>

        {/* Center: Status indicators */}
        <div className="flex items-center gap-4">
          <ConnectionIndicator status={isOnline ? "online" : "offline"} />
          <SyncIndicator syncing={isSyncing} />
        </div>

        {/* Right: System info */}
        <div className="flex items-center gap-4">
          {environment !== "production" && (
            <Badge variant="secondary" className="text-xs uppercase">
              {environment}
            </Badge>
          )}
          <span className="hidden lg:inline">v{appVersion}</span>
        </div>
      </div>
    </footer>
  );
}
```

---

## Connection Indicator Example

```tsx
function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const icon = {
    online: <Wifi className="h-3 w-3 text-green-500" />,
    offline: <WifiOff className="h-3 w-3 text-red-500" />,
    slow: <Wifi className="h-3 w-3 text-yellow-500" />,
  }[status];

  const label = {
    online: "Online",
    offline: "Offline",
    slow: "Slow connection",
  }[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {icon}
            <span className="hidden md:inline text-xs">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connection status: {label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

---

## Sync Indicator Example

```tsx
function SyncIndicator({ syncing }: { syncing: boolean }) {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    if (!syncing && lastSynced) {
      setLastSynced(new Date());
    }
  }, [syncing]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {syncing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden md:inline">Syncing...</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="hidden md:inline">Synced</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {syncing ? (
            <p>Syncing data...</p>
          ) : (
            <p>Last synced: {lastSynced?.toLocaleTimeString()}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

---

## Online Status Hook

```typescript
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

---

## Performance Benchmarks

- [ ] Status bar renders < 20ms
- [ ] Status updates < 50ms
- [ ] No layout shift
- [ ] Minimal re-renders (memoize indicators)

---

## Accessibility Audit

- [ ] Lighthouse Accessibility score > 95
- [ ] axe DevTools: 0 violations
- [ ] Status changes announced to screen readers
- [ ] Tooltips accessible via keyboard

---

## Optional Features

### Advanced Status Indicators

- [ ] Database connection status
- [ ] API health check indicator
- [ ] Background job status
- [ ] Memory usage (development only)
- [ ] Network latency indicator

### Click Actions

- [ ] Click branch badge → open branch switcher
- [ ] Click version → show changelog/release notes
- [ ] Click sync status → force refresh
- [ ] Click connection → show network diagnostics

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

- Status bar is optional but provides valuable context to users
- Keep it minimal - don't clutter with too much information
- Prioritize information based on user needs and screen size
- Consider hiding in production or showing minimal info only
- Useful for developers during development and testing
