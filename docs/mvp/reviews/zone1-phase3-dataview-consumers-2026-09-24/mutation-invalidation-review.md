# Zone 1 / Phase 3 — Mutation Invalidation Review

Required by the task's own Section 12: for each of the 4 consumers, verify that moving the list query to a branch-aware key does not cause an existing mutation to invalidate only the old static key.

## Method

Grepped all 4 consumer files and their sibling detail/panel components (rendered via each `<DataView>`'s own `renderDetail`) for `invalidateQueries`, `useQueryClient`, and `refreshToken`.

```
grep -rln "invalidateQueries" \
  src/app/[locale]/dashboard/warehouse/locations/_components/ \
  src/app/[locale]/dashboard/warehouse/inventory/_components/ \
  src/app/[locale]/dashboard/warehouse/inventory/movements/_components/ \
  src/app/[locale]/dashboard/warehouse/items/_components/
```

**Result: zero matches anywhere across all 4 directories.** None of the 4 consumers, and none of their sibling detail/panel components, contain any query-invalidation logic at all today — neither `invalidateQueries`, nor `useQueryClient`, nor a `refreshToken` prop passed to `<DataView>`.

## Per-consumer classification

### Locations

**No relevant mutation exists.** `locations-data-view.tsx` itself has no mutating form — only row selection, print-label dialog triggering, and navigation to a separate audit-creation page. Classification: no update needed.

### Inventory Balances

**Pre-existing gap, discovered but explicitly NOT fixed in this phase.** `inventory-client.tsx` has 4 real mutation forms (`receiveStockAction`, `issueStockAction`, `transferStockAction`, `adjustStockAction`, all via a shared `submitAction` helper). None of them call `invalidateQueries`, set a `refreshToken`, or call `router.refresh()` after a successful submission — the list simply does not refresh itself after a stock movement is posted from this screen today. This means the list was ALREADY not being kept in sync with these mutations before Phase 3 — the branch-key change does not make this any more or less correct, since there was no existing invalidation logic targeting the OLD static key (`["inventory-balances"]`) that could now be "pointing at the wrong key." Nothing needed updating in this same phase, per the task's own instruction ("If a mutation invalidation clearly targets the static key that Phase 3 is replacing, update it in this same phase" — none does). Recorded here, not silently fixed, since this is a separate, pre-existing UX gap outside Phase 3's own scope (fixing it would mean designing new invalidation behavior, not migrating an existing one to a new key).

### Inventory Movements

**No relevant mutation exists in this file.** Movement creation happens on a separate page (`/dashboard/warehouse/inventory/movements/new`), not inside `inventory-movements-client.tsx` itself. That separate page's own submit handler already calls `router.push("/dashboard/warehouse/inventory/movements")` followed by `router.refresh()` (`inventory-movement-new-client.tsx:269-270`) — a full client-side navigation to a NEW route, which mounts a brand-new `<DataView>` instance with its own fresh, per-mount `QueryClient` (per `data-view.tsx`'s own `useState(makeQueryClient)` design) and fresh SSR `initialData`. This flow was already correct before Phase 3 and remains correct after — it never depended on any specific query-key shape, branch-aware or not, since it fully remounts rather than relying on cache invalidation. Classification: no update needed.

### Inventory Products

**No relevant mutation exists in this file.** Product creation and CSV import happen on separate pages (`/dashboard/warehouse/items/new`, `/dashboard/warehouse/items/import`); the CSV export action is a read-only download, not a mutation. Classification: no update needed.

## Summary

No consumer required a mutation-invalidation update in this phase. One pre-existing, unrelated gap was found (Inventory Balances) and is recorded — not fixed — since it predates and is orthogonal to branch-awareness, and fixing it would be new UX-behavior design work, not a migration of existing behavior to a new key.

## Why the `refreshToken`-based invalidation effect itself needed no change

`DataViewProvider`'s own effect (`useEffect(() => { ...; void queryClient.invalidateQueries({ queryKey }); }, [...])`) calls `invalidateQueries` with the RAW `queryKey` prop (e.g. `["locations"]`), not a branch-merged one. React Query v5's `invalidateQueries` defaults to `exact: false`, meaning it matches every cached query whose key STARTS WITH the given array — so `{queryKey: ["locations"]}` still correctly matches and invalidates `["locations", "branch-a", listParams]` after this phase's change. None of the 4 consumers currently pass a `refreshToken` prop at all, so this mechanism isn't exercised by any of them today regardless — but it remains correct, unmodified, and ready for a future consumer that does use it.
