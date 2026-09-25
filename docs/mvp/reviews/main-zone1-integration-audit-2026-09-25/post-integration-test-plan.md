# Post-Integration Test Plan

**Not executed in this pass — planning only, per the task's own explicit instruction.** To be run in full after conflict resolution actually lands (Option A, per `recommended-integration-strategy.md`), before that merge is considered safe to bring into `main`.

## 1. Full Zone 1 regression set

The exact 21-file, 264-test set already established and documented in `docs/mvp/reviews/zone1-phase7-automated-closeout-2026-09-24/full-regression-results.md`, re-run against the POST-MERGE tree — a pre-merge pass on the unmerged branch is not sufficient, since the merge itself (specifically the DataView reconciliation) touches files this suite depends on. Any of the 3 branch-wiring consumer test files (`inventory-client.branch-wiring.test.tsx`, `inventory-movements-client.branch-wiring.test.tsx`, `inventory-products-client.branch-wiring.test.tsx`, `locations-data-view.branch-wiring.test.tsx`) that fail against main's `scope`-based wiring need their own assertions updated to check `scope`/`dataViewScope.branch(...)` instead of the old `branchId` prop — this is expected, not a regression, given the recommended resolution.

## 2. Type-check and lint

`pnpm type-check` and `pnpm lint` across the FULL, now-integrated `apps/web` tree — not just Zone 1's own files. Main's independent work (dashboard rebuild, DataView refactor, Zone 8 fix) needs to type-check and lint cleanly together with Zone 1's own surviving files, and the deletions recommended in `three-way-resolution-matrix.md` (`buildDataViewQueryKey`, the dead `branchId` prop/type-field) need to leave zero dangling references.

## 3. Dashboard smoke test

Load `/dashboard/start` and confirm it renders as main's own rebuilt operational dashboard (ticket queue, activity feed, Planning widget) — not the old placeholder, not a broken hybrid. This is a NEW check this integration specifically requires, since Zone 1 itself never tested this route.

## 4. Branch switch (full re-verification, not just Zone 1's own suite)

Manually or via Playwright (main's own dashboard work already has Playwright coverage for "zmiana i przywrócenie oddziału" — branch switch and restore): switch branches while on `/dashboard/start` and confirm the new dashboard's own widgets re-scope correctly, in addition to Zone 1's own already-covered warehouse/Matcher/Locations branch-switch behavior.

## 5. DataView consumers (all of them, not just Zone 1's 4)

Main's refactor touched additional `DataView` consumers Zone 1 never worked on (CRM contacts/parties, Help Desk tickets/ticket-types, Organization branches/invitations/members/positions/roles, Planning tasks, QR management). These are not Zone 1's responsibility to verify in depth, but a basic "does each of these screens still render and page/filter correctly" smoke pass is warranted given the shared `DataView`/`DataViewProvider`/`use-data-view-query` files are the ones being reconciled.

## 6. Matcher

Re-run `wdd-matcher.test.ts`, `extraction-review-approval.test.tsx`, `movement-import-boundary.test.ts` (already in the Phase 7 regression set) — expected to be unaffected (Matcher was never in the overlap list), but re-confirm post-merge as a matter of discipline, not because a specific risk was found.

## 7. QR resolver

Re-run `public-token-resolver.test.ts`, `ambra-locations-client.cross-branch.test.tsx` — same rationale as Matcher: unaffected per this audit's own findings, re-confirm post-merge anyway.

## 8. Sign-in returnUrl

Re-run `sign-in-form.test.tsx`, the sign-in `page.test.tsx` — unaffected, same rationale.

## 9. Locations

Re-run `locations-data-view.branch-wiring.test.tsx` — **expected to need updating** per the DataView reconciliation (see item 1).

## 10. RepairOrder route

No RepairOrder-specific automated test exists in Zone 1's own suite (Phase 8's own manual scenario, still pending human UAT per `docs/mvp/reviews/zone1-phase8-manual-uat-2026-09-24/`) — flagged here so the post-integration pass doesn't forget it needs the same manual check once real UAT happens, now against the integrated build rather than the pre-integration branch alone.

## 11. Any test belonging to main-side conflicting runtime files

`data-view-foundation.test.ts`, `data-view-hydration.test.tsx`, `data-view-url-state.test.tsx`, `data-view-invalidation.test.tsx` (all new files main's own dataview-refactor commit added, per its own `--stat` output) — these are main's own coverage for the mechanism being adopted; running them post-merge confirms the reconciliation didn't silently break main's own already-passing tests either.

## Manual smoke (per the task's own explicit inclusion)

- Dashboard renders (no console error, no blank screen).
- Branch switch lands safely (on `/dashboard/start`, with correctly-scoped content, no stale prior-branch data flash).
- No obvious UI regression on any of the 4 warehouse DataView consumers (Locations, Balances, Movements, Products) — since these are the files most directly touched by the reconciliation.

## Explicit non-execution

None of the above was run in this pass. This is the plan for AFTER conflict resolution lands — this audit itself performed zero test runs against merged/hypothetical content, only read-only diff/content inspection.
