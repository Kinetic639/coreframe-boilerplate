# Phase 10D — Container QR: Audit and Implementation Plan (2026-09-30)

**Status:** PLAN, awaiting product-owner approval. No code has been changed yet.

**Source phase:** `docs/mvp/zones/03-repair-orders-implementation-plan.md`, "Phase 10D — Container QR".

**Product rules:** `docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/container-product-decisions.md`:

- RepairOrder parts live in containers;
- a container belongs to one RepairOrder;
- no "store loose" flow.

## 1. What the presentation needs (script §9)

> "Jeżeli natomiast części zostały wcześniej zgrupowane w kontener — fizyczny zestaw z własnym kodem QR — mogę przenieść cały kontener naraz: POKAŻ „PRZENIEŚ KONTENER”, ZESKANUJ KOD QR KONTENERA…"

On stage:

1. A container exists, holds a RepairOrder's parts, sits at a location and carries a printed QR label.
2. Scanning the label with the phone opens that container's screen: code, RepairOrder, contents, location.
3. From there, "Przenieś kontener" is used. That action is **Phase 10E**, not this phase.

Phase 10D delivers 1 and 2. It also has to deliver the means to _create_ the container in the UI, because none exists today (see §2).

## 2. Audit: what exists today

| Area                                          | State                                                                                                                                                                                                  | Evidence                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| QR target registry                            | 3 types: `warehouse.location`, `helpdesk.ticket`, `planning.task`. The pattern is simple and additive                                                                                                  | `src/server/qr/target-registry.ts`                                |
| Public QR resolver                            | Generic over the registry. It already handles anonymous scan → sign-in → return, cross-branch confirm hint, and denial for inaccessible branches                                                       | `src/server/qr/public-token-resolver.ts`                          |
| DB constraint on `qr_assignments.target_type` | Format regex only (`^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`), so `inventory.container` is allowed. **No migration needed**                                                                                | live `pg_constraint`                                              |
| QR services                                   | `QrCodesService`, `QrAssignmentsService.assignToTarget` / `createAndAssign` / `getActiveForTarget(s)`                                                                                                  | `src/server/services/qr.service.ts`                               |
| QR label PDF                                  | Generic via each descriptor's `getLabelContext`                                                                                                                                                        | `src/app/api/qr/labels/route.ts`                                  |
| Quick-assign wizard for pre-printed codes     | Supports ticket and task only                                                                                                                                                                          | `dashboard/qr/assign/[token]/_components/quick-assign-wizard.tsx` |
| Containers backend (Phase 10C)                | Tables `inventory_containers` / `_lines` / `inventory_allocation_container_links`. RPCs create/add/remove. RepairOrder ownership is enforced (no mixing), and quantity conservation is proven by pgTAP | Zone 3 progress, Phase 10C                                        |
| Container server actions                      | `createRepairOrderContainerAction`, `placeAllocationInContainerAction`, `removeAllocationFromContainerAction`, all gated on `warehouse.inventory.operate`                                              | `src/app/actions/workshop/repair-orders.ts`                       |
| Reservation (RepairOrder line)                | Server action + UI                                                                                                                                                                                     | `repair-order-line-reservation.tsx`                               |
| Allocation (RepairOrder line)                 | Server action (`allocateRepairOrderLineAction`), **no UI**                                                                                                                                             | same file, comment "not an allocation/container UI"               |
| Container creation / placement UI             | **None**                                                                                                                                                                                               | Phase 10C built no UI by design                                   |
| Container detail screen                       | **None**                                                                                                                                                                                               | —                                                                 |
| Location detail panel                         | Already lists "containerized stock" at a location, with no link to a container screen                                                                                                                  | `warehouse/locations/_components/location-detail-panel.tsx`       |

## 3. Proposed scope (PITCH MVP)

All UI is in Polish (plus English i18n keys, per the repo's i18n convention).

**10D-1: QR registry entry `inventory.container`**

- `validate()`: explicit org check against `inventory_containers`, `branchId` derived from the row, rejects soft-deleted. Same shape as `warehouse.location`.
- `requiredAssignPermission = warehouse.inventory.operate`, `requiredReadPermission = warehouse.inventory.read` (plan decision 5).
- `resolverPath()` → `/dashboard/warehouse/containers/{id}`.
- `getLabelContext()` → container code, RepairOrder ZL + vehicle, "Kontener".
- The cross-branch and anonymous-scan behaviour is inherited from the resolver unchanged.

**10D-2: Container detail screen `/dashboard/warehouse/containers/[id]`**, server-rendered and branch-scoped. It shows:

- code, status and current location (linked);
- the RepairOrder (ZL number, client, vehicle, linked to the RepairOrder);
- contents: each line with SKU, name, quantity and unit;
- a QR section: the assigned code, or "Przypisz kod QR" / "Drukuj etykietę";
- the cross-branch hint handling, reusing the Phase 6 location confirm-then-switch pattern.

The "Przenieś kontener" button stays hidden until Phase 10E. The screen is mobile-first, since it's opened by phone scan.

**10D-3: RepairOrder detail, "Kontenery zlecenia" section**

- List the RepairOrder's containers: code, location, number of lines.
- "Utwórz kontener": code auto-proposed as `K-<ZL>-NN` (editable), plus a starting location picker scoped to the branch's locations.
- "Przydziel" on a reserved line (minimal allocation UI over the existing action), then "Dodaj do kontenera" on an allocation (existing place action). This is the smallest path from a reserved part to a part in a container.

**10D-4: Container QR**

- From the container screen: "Wygeneruj i przypisz kod QR" (`createAndAssign`), then "Drukuj etykietę" via the existing label PDF route.
- _Optional, P2:_ also allow assigning a pre-printed blank QR code via the quick-assign wizard.

**10D-5: Links.** Container rows in the location detail panel link to the container screen.

## 4. Out of scope (explicit)

- Whole-container move (Phase 10E).
- Partial move that creates a new container (product decision C, not yet designed).
- Issue 201/WZ (Phase 10F).
- Per-part QR.
- Any DB/RLS/migration change.
- Fixing BLOCKER-Z1-019 (branch-switch hang). It's relevant as a risk, see §6.

## 5. Tests

- **Unit:** registry `validate()` (found / wrong org / soft-deleted / not found); `getLabelContext`; `resolverPath`.
- **Resolver:** container token resolves to the container path; cross-branch accessible adds the `crossBranch` hint; inaccessible or cross-org returns `TARGET_NOT_FOUND`.
- **Actions:** permission gates (no `warehouse.inventory.operate` → denied); the container stays branch-scoped.
- **Components:** container screen (contents, RepairOrder, QR states); RepairOrder "Kontenery" section (create, allocate, place).
- **Live (demo org, after deploy):** create a container for ZL 184213 at `ZLC-01`, assign and print QR, scan it with the phone → container screen. Cross-branch: scan a Poznań container while in Piaseczno → confirm-then-switch. Warehouse user (Poznań only) scanning a Piaseczno container → "not available".
- **Regression:** Zone 1 suite, QR suites, Zone 3 container suites; `pnpm type-check`, lint.

## 6. Risks

- **BLOCKER-Z1-019:** the cross-branch confirm-then-switch on the locations page also calls `changeBranch` + navigation inside an async transition. It must be checked live that the container screen's version doesn't hang. If it does, the container screen uses a full-document navigation after a successful switch (a local, low-risk choice).
- **Allocation UI:** kept deliberately minimal (one "Przydziel" per reserved line, full reserved quantity by default, editable). No generic allocation management.

## 7. Decisions needed from the product owner

1. **Container code format:** auto `K-<ZL>-NN` (e.g. `K-184213-01`), editable. _Recommended._
2. **Where containers are created:** from the RepairOrder detail only (recommended for the pitch). A Magazyn → Kontenery list page is later.
3. **Minimal allocation step** ("Przydziel" on a reserved line) inside this phase: OK?
4. **QR for containers:** generate-and-print from the container screen (recommended), with or without the optional pre-printed-code assignment (P2)?

## 8. Delivery

- One branch. Commits per sub-step (10D-1 … 10D-5).
- Tests and type-check/lint green before each commit.
- A review bundle `docs/mvp/reviews/phase10d-container-qr-<date>/` at the end.
- Zone 3 progress tracker updated.
- Deploy (push/PR/merge) is the product owner's step. The live checks in §5 run after deploy.
