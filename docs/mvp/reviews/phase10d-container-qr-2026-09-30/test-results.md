# Phase 10D — Test Results (2026-09-30)

## New tests

| File                                                                                                       | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/qr/__tests__/container-target.test.ts`                                                         | 12    | Registry: registration + permissions; `validate` for OK, wrong org, soft-deleted and missing; `resolverPath`; label text with and without a RepairOrder. Resolver: same branch → container path; accessible other branch → `crossBranch` hint; inaccessible branch → `TARGET_NOT_FOUND`; cross-org → `TARGET_NOT_FOUND`; logged out → sign-in with return to `/qr/<token>` |
| `src/server/services/__tests__/inventory-containers.service.test.ts`                                       | 9     | `suggestCode` (first, next, skip taken, no ZL); `getDetail` mapping (contents, location, RepairOrder), RLS-hidden → null, no RepairOrder; `listForRepairOrder` summary + empty                                                                                                                                                                                             |
| `src/app/actions/qr/__tests__/assign-container.test.ts`                                                    | 7     | Gates: no `qr.assign`, no `warehouse.inventory.operate`, invalid input. Happy path: target type/id/org/assignedBy from server context. Failure pass-through; assignment read                                                                                                                                                                                               |
| `src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-containers.test.tsx`          | 9     | Containers section: empty, list + link, load error, create hidden without permission, suggested code prefilled. Line popover: reserve-first hint, allocate the whole outstanding quantity, place into the only container, controls hidden without permission                                                                                                               |
| `src/app/[locale]/dashboard/warehouse/containers/[id]/_components/__tests__/container-components.test.tsx` | 7     | QR card: generate → action + refresh, failure → no refresh, no permission notice, print → `/api/qr/labels` + open PDF. Cross-branch prompt: no contents shown, switch → `changeBranch` + `setActiveBranch` + reload, rejected switch → no reload                                                                                                                           |

**Updated:** `repair-order-lines-list.test.tsx`. Its mocks were extended for the new per-line container popover; no assertions changed.

## Regression run

Command: `pnpm vitest run` over:

- every test file matching the Zone 1 branch-switch, QR, RepairOrder, location and container patterns;
- `src/app/api/qr`;
- `src/app/[locale]/dashboard/warehouse/locations`.

Result: **39 files passed, 731 tests passed, 0 failed.**

## Static checks and build

- `pnpm type-check` (`tsc --noEmit`): exit 0.
- `npx eslint` on all 19 changed/new TS/TSX files: exit 0, no warnings.
- `pnpm build` (`next build`): exit 0. It compiled successfully, and the route `/[locale]/dashboard/warehouse/containers/[id]` is listed.

## Not yet run

Live verification on a deployed build: see `live-verification-plan.md`.
