# Zone 1 / Phase 6 — Cross-Branch Flow (Cases B & C)

> **Corrected 2026-09-24.** The sequence below now reflects Correction A: the access check happens INSIDE the resolver, before any redirect is computed, not after a confirm click. See `qr-flow-contract.md` for the full before/after narrative.

## Sequence diagram (text form)

```
User scans/opens QR for Location L (branch B) while active branch is A
        │
        ▼
resolvePublicQrToken(token)
  - resolves QR → assignment → target (service-role client, unchanged)
  - validates org match (unchanged)
  - calls loadDashboardContextV2() (same authoritative loader changeBranch()
    itself uses) to get the caller's activeBranchId, accessibleBranches,
    permissionSnapshot
  - IF anonymous (loadDashboardContextV2() === null):
        -> redirect to /sign-in?returnUrl=/qr/<token>  (Case D, see below)
  - activeBranchId (A) != target branch (B):
        -> CORRECTION A: isBranchAccessible(B, accessibleBranches, permissionSnapshot)?
             NO  -> return {ok:false, error:"TARGET_NOT_FOUND"} -- STOP HERE,
                    no redirect to the dashboard at all (Case C)
             YES -> append crossBranch=B to redirect (Case B, continue below)
        │
        ▼ (Case B path only)
redirectPath = /dashboard/warehouse/locations?selected=L&crossBranch=B&view=tree
        │
        ▼
Browser navigates to redirectPath (existing QR-scan → redirect infra, unchanged)
        │
        ▼
AmbraWarehouseLocationsPage (Server Component) loads with activeBranchId=A (unchanged;
this page load happens BEFORE any switch — branch A's own data is what's fetched)
        │
        ▼
AmbraLocationsClient mounts (key={A})
  - initialUrlState reads selected=L, crossBranch=B from the URL (once, on mount)
  - treeSelectedId = null (crossBranch present -> do NOT auto-select L)
  - pendingCrossBranch = {targetBranchId: B, targetLocationId: L}
  - AlertDialog renders: open={!!pendingCrossBranch} = true
        │
        ├── User clicks Cancel ──────────────────────────────────────────┐
        │     handleCancelCrossBranch():                                 │
        │       - setPendingCrossBranch(null)                            │
        │       - strip crossBranch from URL (history.replaceState)      │
        │     Dialog closes. treeSelectedId stays null (or the           │
        │     pre-existing reset-effect's own fallback, e.g. locations[0]│
        │     of branch A -- same "silent drop" outcome as pre-Phase-6). │
        │     NO changeBranch call. Branch A remains authoritative.      │
        │                                                                 ▼
        │                                                          [terminal: Case B cancel]
        │
        └── User clicks "Switch branch"
              handleConfirmCrossBranch():
                - setIsSwitchingBranch(true)
                - event.preventDefault() on the button click first, so
                  Radix's own auto-close does NOT fire prematurely (see
                  security-review.md for why this matters)
                - await changeBranch(B)   <-- THE authorization checkpoint --
                  independently re-runs isBranchAccessible(B, ...) itself,
                  fresh, server-side. By this point in the Case B path it is
                  already known the hint was only shown because this same
                  check passed once -- this is deliberate defense in depth
                  (a race where access was revoked between hint and click is
                  still caught), not redundant distrust of the hint.
                        │
                        ├── success: false (a race/revocation between hint
                        │            computation and confirm click, or any
                        │            other server-side rejection -- NOT the
                        │            normal path to Case C anymore, since
                        │            Case C now never reaches this dialog)
                        │     - toast.error(safe message)
                        │     - setIsSwitchingBranch(false)
                        │     - pendingCrossBranch UNCHANGED (dialog stays open)
                        │     - NO setActiveBranch, NO navigation
                        │     ▼
                        │   [terminal: failed switch -- user may retry or Cancel]
                        │
                        └── success: true
                              - useAppStoreV2.getState().setActiveBranch(B)
                              - router.replace({pathname: locations, query: {selected: L, view: tree}})
                                (URL now has NO crossBranch param)
                              - router.refresh()
                                    │
                                    ▼
                              AmbraWarehouseLocationsPage re-executes with
                              activeBranchId=B, branch B's own data fetched
                                    │
                                    ▼
                              <AmbraLocationsClient key={B}> -- key changed from A to B,
                              FULL REMOUNT (fresh useState from fresh props/URL)
                                    │
                                    ▼
                              initialUrlState reads selected=L, crossBranch=undefined
                              treeSelectedId = L (crossBranch absent now -> auto-select)
                              pendingCrossBranch = null -> no dialog
                                    ▼
                              Location L opens directly, under branch B, in the tree view.
                              [terminal: Case B confirm-success]
```

## What changed for Case C (inaccessible cross-branch)

Before the correction, Case C was reached by: dialog appears → user clicks Confirm → `changeBranch()` rejects → error toast. The user COULD see and interact with a "Switch branch" offer that was guaranteed to fail.

After the correction, Case C is resolved entirely inside `resolvePublicQrToken`, before any dashboard redirect is computed. The user never sees `/dashboard/warehouse/locations` at all for this scenario — they land on the QR page's own existing "target not found" card. `AmbraLocationsClient` is never involved. See `qr-flow-contract.md`'s Case C section for the full before/after.

## Why the exact target survives the switch

The target's ID (`targetLocationId`) is captured in `pendingCrossBranch` at mount and threaded explicitly through `router.replace`'s `query.selected` — it is never re-derived from anything mutable, so the switch cannot land on the "wrong" location or silently substitute a fallback. Unchanged by this correction.

## Why no silent switch is possible

`changeBranch` is only ever called inside `handleConfirmCrossBranch`, which itself only runs from the Confirm button's `onClick`. Verified negatively by test: `ambra-locations-client.cross-branch.test.tsx`'s "no silent switch occurs on mount" asserts `changeBranch` was never called merely from rendering the dialog. Unchanged by this correction.

## Cross-reference

See `qr-flow-contract.md` for the case-by-case behavioral contract (including the corrected Case C and D narratives) and `security-review.md` for the authorization analysis.
