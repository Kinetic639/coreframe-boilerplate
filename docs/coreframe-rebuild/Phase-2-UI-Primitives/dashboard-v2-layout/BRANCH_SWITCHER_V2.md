# Branch Switcher V2 - Component Verification & Progress Tracker

**Component**: Branch Switcher V2
**File**: `src/components/v2/layout/branch-switcher.tsx`
**Created**: 2026-01-17
**Updated**: 2026-01-19
**Status**: ✅ Implementation Complete - Pending Verification

---

## Progress Overview

| Category               | Progress        | Status                    |
| ---------------------- | --------------- | ------------------------- |
| Implementation         | 100% (12/12)    | ✅ Complete               |
| Branch Switching Logic | 0% (0/10)       | ⬜ Not Verified           |
| Permission Sync        | 0% (0/8)        | ⬜ Not Verified           |
| Visual Design          | 0% (0/6)        | ⬜ Not Verified           |
| Error Handling         | 0% (0/7)        | ⬜ Not Verified           |
| Accessibility          | 0% (0/6)        | ⬜ Not Verified           |
| Performance            | 0% (0/5)        | ⬜ Not Verified           |
| **TOTAL**              | **22% (12/54)** | **⬜ Needs Verification** |

---

## Implementation Checklist ✅

### Core Structure

- [x] Client component with `"use client"` directive
- [x] Uses shadcn/ui Popover + Command components
- [x] Reads `activeBranch` from `useAppStoreV2`
- [x] Reads `availableBranches` from `useAppStoreV2`
- [x] Displays current branch name with icon

### Branch Selection UI

- [x] Popover opens on click
- [x] Command palette with search/filter functionality
- [x] Lists all available branches
- [x] Shows checkmark on currently active branch
- [x] Branch items styled as clickable commands

### State Management

- [x] Uses `useTransition()` for pending state
- [x] Calls `changeBranch(branchId)` server action
- [x] Updates store with `setActiveBranch(branchId)` after success

---

## Branch Switching Logic Verification

### Server Action Flow

- [ ] `changeBranch(branchId)` validates session exists
- [ ] Server action updates `user_preferences.active_branch_id`
- [ ] Server action returns success/error response
- [ ] Handles case where branch doesn't exist
- [ ] Handles case where user doesn't have access to branch

### Store Update Flow

- [ ] `setActiveBranch(branchId)` updates `activeAppStoreV2.activeBranchId`
- [ ] Store update is immediate (no delay)
- [ ] Store update triggers React re-render
- [ ] Component reflects new branch name immediately

### Permission Refetch Flow

- [ ] Query key change detected: `["v2", "permissions", orgId, branchId]`
- [ ] `useBranchPermissionsQuery` automatically refetches
- [ ] New permissions loaded from server
- [ ] `PermissionsSync` syncs to `useUserStoreV2`
- [ ] Components re-render with new permissions

### Navigation Behavior

- [ ] User stays on current page after branch switch
- [ ] URL does not change (no redirect)
- [ ] Module navigation updates if modules differ per branch
- [ ] No full page reload

---

## Permission Sync Verification

### Immediate Permission Update

- [ ] Old permissions cleared before new ones load
- [ ] No stale permission data visible during transition
- [ ] Permission checks return correct results immediately after switch
- [ ] UI updates based on new permissions (buttons hide/show)

### Permission Loading States

- [ ] While permissions loading, previous permissions still valid
- [ ] No flash of "no permissions" state
- [ ] Loading indicator visible during fetch (optional)
- [ ] Error state handled if permission fetch fails

### Module Visibility

- [ ] Sidebar navigation updates to show/hide modules based on new permissions
- [ ] Dashboard widgets update based on new permissions
- [ ] No console errors during permission transition

---

## Visual Design Verification

### Current Branch Display

- [ ] Branch name visible and readable
- [ ] Branch icon (if any) displayed
- [ ] Chevron/dropdown indicator visible
- [ ] Hover state on button
- [ ] Focus state visible for keyboard users

### Popover/Dropdown

- [ ] Opens smoothly without jank
- [ ] Positioned correctly (doesn't overflow screen)
- [ ] Proper z-index (appears above other elements)
- [ ] Backdrop/overlay if applicable
- [ ] Closes when clicking outside
- [ ] Closes when pressing Escape

---

## Error Handling Verification

### Server Action Errors

- [ ] Network error shows user-friendly toast
- [ ] Permission denied error shows appropriate message
- [ ] Branch not found error handled gracefully
- [ ] Store state remains consistent after error
- [ ] User can retry after error

### Edge Cases

- [ ] Only one branch available: switcher disabled or hidden
- [ ] No branches available: handled gracefully (shouldn't happen)
- [ ] Switching to same branch: no-op, no error

---

## Accessibility Verification

### Keyboard Navigation

- [ ] Tab key reaches button
- [ ] Enter/Space opens popover
- [ ] Arrow keys navigate branch list
- [ ] Enter selects branch
- [ ] Escape closes popover

### Screen Reader Support

- [ ] Button labeled correctly (e.g., "Switch branch, currently Main")
- [ ] Popover announced when opened
- [ ] Branch options announced with selection state
- [ ] Loading state announced during transition

---

## Performance Verification

### Interaction Performance

- [ ] Button click responds immediately (< 100ms)
- [ ] Popover opens without delay
- [ ] Branch switch feels instant (< 300ms to update UI)
- [ ] No UI freeze during permission refetch

### Optimization

- [ ] Branch list memoized (doesn't rebuild on every render)
- [ ] Server action doesn't block UI
- [ ] Transition state prevents double-clicks

---

## Manual Testing Checklist

### Happy Path

1. [ ] Open branch switcher popover
2. [ ] Select different branch
3. [ ] Verify branch name updates immediately
4. [ ] Verify permissions update (check sidebar navigation)
5. [ ] Verify toast shows "Branch switched successfully"

### Error Scenarios

1. [ ] Disconnect network → try to switch → verify error toast
2. [ ] Switch to invalid branch ID → verify error handling
3. [ ] Rapid click switching (double-click) → verify only one switch happens

### Permission Changes

1. [ ] Switch to branch with fewer permissions → verify UI updates
2. [ ] Switch to branch with more permissions → verify new items appear
3. [ ] Switch to branch with different modules → verify sidebar updates

### Edge Cases

1. [ ] User with only one branch → verify switcher hidden/disabled
2. [ ] Switch to same branch → verify no error, no unnecessary refetch
3. [ ] Switch branches rapidly → verify state remains consistent

---

## Integration Points

### Server Action

**File**: `src/app/actions/v2/branches.ts`

```typescript
export async function changeBranch(branchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Validate user has access to branch
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .single();

  if (branchError || !branch) {
    return { error: "Branch not found or access denied" };
  }

  // Update user preference
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    active_branch_id: branchId,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

### Store Actions

**useAppStoreV2.setActiveBranch(branchId)**

- Updates `activeBranchId` in store
- Does NOT fetch data (dumb setter)
- Triggers React Query refetch via key change

### Permission Sync

**Automatic via React Query**

```typescript
// Query key changes from:
["v2", "permissions", "org-123", "branch-old"][
  // To:
  ("v2", "permissions", "org-123", "branch-new")
];

// React Query automatically refetches
// PermissionsSync syncs new data to useUserStoreV2
```

---

## Detailed Component Specification

### Component Structure

```tsx
export function BranchSwitcher() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { activeBranch, availableBranches, setActiveBranch } = useAppStoreV2();
  const t = useTranslations("branches");

  const handleBranchChange = (branchId: string) => {
    if (branchId === activeBranch?.id) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await changeBranch(branchId);

      if (result.error) {
        toast.error(t("switchError"));
        return;
      }

      setActiveBranch(branchId);
      toast.success(t("switchSuccess"));
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <Building2 className="mr-2 h-4 w-4" />
          {activeBranch?.name}
          <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noBranches")}</CommandEmpty>
            <CommandGroup>
              {availableBranches.map((branch) => (
                <CommandItem key={branch.id} onSelect={() => handleBranchChange(branch.id)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeBranch?.id === branch.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {branch.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Props Interface

```typescript
interface BranchSwitcherProps {
  // No props - reads from stores
}
```

### Translation Keys

```json
{
  "branches": {
    "switchSuccess": "Branch switched successfully",
    "switchError": "Failed to switch branch. Please try again.",
    "searchPlaceholder": "Search branches...",
    "noBranches": "No branches available"
  }
}
```

---

## Testing Strategy

### Unit Tests

- [ ] Branch list filters correctly
- [ ] Current branch marked as active
- [ ] Handles empty branch list
- [ ] Handles single branch

### Integration Tests

**File**: `src/components/v2/layout/__tests__/branch-switcher.test.tsx`

- [ ] Switching branch calls server action
- [ ] Switching branch updates store
- [ ] Error from server action shows toast
- [ ] Success shows toast
- [ ] Switching to same branch is no-op
- [ ] Rapid clicks don't cause multiple switches

### E2E Tests

- [ ] User can switch branches via UI
- [ ] Permissions update after switch
- [ ] Sidebar navigation updates after switch
- [ ] No console errors during switch

---

## Known Issues / Edge Cases

### Race Conditions

- [ ] Rapid branch switches: useTransition prevents multiple concurrent switches
- [ ] Permission refetch during switch: old permissions remain valid until new ones load
- [ ] Store update before server action completes: prevented by waiting for server action

### Permission Gaps

- [ ] Brief moment where permissions are being fetched
- [ ] Solution: Keep old permissions until new ones load
- [ ] PermissionsSync only updates when `isFetched && data`

### Module Changes

- [ ] Different branches may have different modules
- [ ] Sidebar navigation must update dynamically
- [ ] Solution: `getAllModules(activeOrgId)` re-runs when branch changes

---

## Browser Console Tests

### Network Tab

```bash
# 1. Switch branch
# Expected: POST to changeBranch server action

# 2. After switch
# Expected: POST to getBranchPermissions server action

# 3. No other requests
# Expected: No full page reload
```

### React DevTools

```bash
# 1. useAppStoreV2.activeBranchId
# Should update immediately after switch

# 2. useUserStoreV2.permissionSnapshot
# Should update within ~500ms after switch

# 3. Component re-renders
# Only components using affected state should re-render
```

### React Query DevTools

```bash
# 1. Query key
# Should change from [..., "branch-old"] to [..., "branch-new"]

# 2. Query status
# Should show "fetching" briefly, then "success"

# 3. Old query
# Should be garbage collected
```

---

## Performance Benchmarks

- [ ] Button click to UI update: < 100ms
- [ ] Server action response time: < 500ms
- [ ] Permission refetch time: < 500ms
- [ ] Total switch time (user perspective): < 1000ms
- [ ] No frame drops during transition

---

## Accessibility Audit

- [ ] Lighthouse Accessibility score > 95
- [ ] axe DevTools: 0 violations
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces branch changes
- [ ] Focus management correct

---

## Sign-Off Checklist

- [ ] All verification checkboxes completed
- [ ] Manual testing completed on all browsers
- [ ] No console errors or warnings
- [ ] Permission sync works correctly
- [ ] Error handling works correctly
- [ ] Toast notifications work correctly
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Code reviewed
- [ ] Ready for production

**Ready for Production**: ⬜ NO

---

## Critical Integration Test

**This test validates the entire branch switching flow:**

```typescript
test("branch switching updates permissions correctly", async () => {
  // 1. Initial state: Branch A with permission warehouse.products.read
  expect(useUserStoreV2.getState().permissionSnapshot.allow).toContain("warehouse.products.read");

  // 2. Switch to Branch B (has warehouse.products.* permission)
  await userEvent.click(screen.getByRole("button", { name: /branch/i }));
  await userEvent.click(screen.getByText("Branch B"));

  // 3. Verify branch updated in store
  await waitFor(() => {
    expect(useAppStoreV2.getState().activeBranchId).toBe("branch-b-id");
  });

  // 4. Verify permissions refetched and updated
  await waitFor(() => {
    expect(useUserStoreV2.getState().permissionSnapshot.allow).toContain("warehouse.products.*");
  });

  // 5. Verify UI reflects new permissions
  expect(screen.getByText("Create Product")).toBeInTheDocument(); // Now visible with new permission
});
```

---

## Notes

- This component is CRITICAL for multi-branch functionality
- Permission sync must be flawless to maintain security UX
- Error handling must be robust - users should never be stuck
- Performance must be excellent - this is a frequently used action
