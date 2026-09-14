# Zone 3 Phase 10A Reservation Integration — Changed Files Manifest

Baseline: `HEAD` `52fc0913` ("phase 10 pass" — Phase 9 + completed Phase 10 base scope + Phase 10's write-boundary correction, all committed). Unchanged from the first version of this bundle. Phase 10A's own work (now including this UI/cache correction pass) remains the _only_ uncommitted change in the working tree, confirmed via `git status --porcelain` immediately before regenerating this bundle: a plain `git add` + `git diff --cached HEAD` + `git restore --staged`, no reconstruction needed.

**This is the SECOND version of this bundle**, regenerated in place against the SAME baseline after a narrow, external-review-driven UI/cache correction pass (2026-09-14). Diff scope: **only** Phase 10A's own 17 files (was 16 — one new test file added by the correction). No allocation, container, QR, 801/201/WZ, or Zone 5 file was touched, and no migration was created in either version of this phase.

## Added (3)

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-line-reservation.tsx`

Minimal line-level reservation UI. **Correction pass**: now derives a `ReservationViewState` (`never-fetched | loading | error | empty | populated`) from react-query's own `isLoading`/`isError`/`isSuccess` flags via a pure `deriveReservationViewState` function, instead of collapsing `data ?? []`. The trigger badge shows neutral wording for never-fetched/loading/error (never "No reservation" unless the query has genuinely succeeded with zero reservations); the popover renders a dedicated, localized, popover-local error state (`repair-order-line-reservation-error` testid) distinct from the empty state. Both hooks (`useRepairOrderLineReservationsQuery`, the two mutations) are now called with `branchId` as well as `lineId`.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-line-reservation.test.tsx`

10 original tests retained unmodified in substance (mock shape extended with `isError`/`isSuccess`). 5 new tests added: never-fetched does not render "No reservation"; successful empty renders "No reservation"; successful reservation renders "Reserved N"; query failure renders the error testid; query failure does not render empty/no-reservation copy. 15/15 passing.

### `apps/web/src/hooks/queries/workshop/__tests__/index.test.tsx` (new in this correction pass)

New file — the branchId-cache-key bug can only be proven against a real `QueryClient` (the component test file mocks the hooks module wholesale), so this dedicated file uses `renderHook` + a real `QueryClientProvider` + mocked server actions. 6 tests: distinct keys per branch, distinct key for `null` vs. a real branch id, stable key for the same branch+line pair, a genuine cache-isolation regression (priming branch A's key then mounting under branch B proves branch A's cached data is not reused/rendered), and exact-key invalidation for both the reserve and release mutations.

## Modified (14)

### `apps/web/src/hooks/queries/workshop/index.ts`

**Correction pass**: `workshopKeys.lineReservations` now takes `(branchId: string | null, lineId: string)`, not just `lineId`. `useRepairOrderLineReservationsQuery` now takes `(lineId, enabled, branchId)`. `useReserveRepairOrderLineMutation`/`useReleaseRepairOrderLineReservationMutation` now take `(lineId, branchId)` and invalidate against the branch-scoped key. `branchId` is cache identity only, never passed to any authorization check — the server actions/service methods are unchanged.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-lines-list.tsx`, `page.tsx`, `_components/__tests__/repair-order-lines-list.test.tsx`

No change beyond what the first version of this bundle already described (`branchId` prop plumbing, hook mocks for the newly-rendered child component). Included here only because they remain part of Phase 10A's own diff against the `52fc0913` baseline.

### `apps/web/src/server/services/repair-orders.service.ts`, `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`, `apps/web/src/server/audit/event-registry.ts`, `apps/web/src/lib/validations/repair-orders.ts`, `apps/web/src/app/actions/workshop/repair-orders.ts`, `apps/web/supabase/tests/098_repair_order_line_reservation_phase10a_test.sql`

**Unchanged by this correction pass** — the accepted service contract (`reserveForLine`/`releaseReservationForLine` ownership resolution, `reference_type`/`reference_id` model, outstanding formula, error allowlist, event model) was explicitly frozen per instruction. `098_...` was re-run live, byte-for-byte unmodified, still 17/17. Listed here because they remain part of the diff against the `52fc0913` baseline (first introduced in the pre-correction version of this bundle).

### `apps/web/messages/en.json`, `apps/web/messages/pl.json`

**Correction pass**: two new keys added to `modules.workshop.repairOrders.lines.reservation` — `badgeUnknown` (neutral trigger wording for never-fetched/loading/error) and `errorState` (generic, localized popover error message). Both files re-verified to parse as valid JSON.

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

Unchanged by this correction pass (no stale claim was found in this file — see `review-context.md` §D). Listed here because it remains part of the diff against the `52fc0913` baseline (first introduced pre-correction).

### `docs/mvp/zones/03-repair-orders-progress.md`

**Correction pass**: one new change-log entry appended documenting the three bug fixes and the live permission-contract verification. No other phase's row or change-log entry touched; the pre-correction Phase 10A entry itself was left as-is (matching this project's standing convention of appending corrections rather than rewriting prior entries).

## Cross-validation

- File count: **17** (3 added + 14 modified), matching this manifest's own count and the diff's 17 `diff --git` headers exactly.
- `zone3-phase10a-reservation.diff`: 2626 lines, 171080 bytes.
- Baseline: unchanged — `52fc0913`, no reconstruction needed.
- Packaging verification: `git status --porcelain` before staging and after `git restore --staged .` shows the identical set of paths, confirming bundle regeneration did not alter, leave staged, or commit any implementation file.
