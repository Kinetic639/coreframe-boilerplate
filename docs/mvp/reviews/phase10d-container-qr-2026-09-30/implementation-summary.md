# Phase 10D — Container QR: Implementation Summary (2026-09-30)

**Plan:** `../phase10d-container-qr-plan-2026-09-30/plan.md`, approved with the recommended answers:

1. auto `K-<ZL>-NN` code;
2. containers are created from the RepairOrder detail;
3. a minimal "Przydziel" step;
4. QR is generated and printed from the container screen.

**Code:** commit `22ed5069` on branch `phase-10d-container-qr`. **Database:** no changes.

## What was built

| Sub-step                     | Result                                                                                                                                                                                                                                                                                    | Files                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 10D-1 QR target              | `inventory.container` in the registry: `validate()` (org check, row's own branch, soft-delete), assign `warehouse.inventory.operate` / read `warehouse.inventory.read`, `resolverPath` → `/dashboard/warehouse/containers/{id}`, label = code / `ZL <nr> · <brand>` / "Kontener"          | `src/server/qr/target-registry.ts`                                                                               |
| 10D-2 Container screen       | `/dashboard/warehouse/containers/[id]` (PL: `/dashboard/magazyn/kontenery/[id]`), mobile-first. Shows code, status, RepairOrder (ZL link, client, vehicle, VIN), location (link to the locations tree), contents (SKU, name, quantity, unit) and a QR card. See the visibility note below | `src/app/[locale]/dashboard/warehouse/containers/[id]/**`, `src/server/services/inventory-containers.service.ts` |
| 10D-3 RepairOrder containers | "Kontenery zlecenia" section (list + create with the suggested code and a location picker). Per-line "Kontener" popover: "Przydziel" (allocate a reservation line) → "Dodaj do kontenera" (place the allocation into a container)                                                         | `src/app/[locale]/dashboard/workshop/[id]/**`, `src/hooks/queries/workshop/index.ts`                             |
| 10D-4 Container QR           | "Wygeneruj kod QR" (`createAndAssignQrToContainerAction`: `qr.assign` + `warehouse.inventory.operate`); "Drukuj etykietę" via the existing `/api/qr/labels` PDF route (`qr.export` + registry read permission)                                                                            | `src/app/actions/qr/assign-container.ts`, `container-qr-card.tsx`                                                |
| 10D-5 Links                  | The location detail panel's container rows link to the container screen                                                                                                                                                                                                                   | `location-detail-panel.tsx`                                                                                      |
| i18n                         | Polish + English: `modules.warehouse.containers`, `modules.workshop.repairOrders.containers`, `…lines.container`, `ambraLocations.inventory.openContainer`                                                                                                                                | `messages/{pl,en}.json`                                                                                          |

**Container screen visibility:**

- Requires `warehouse.inventory.read`, enforced by RLS on the container's branch.
- A container in another branch the user can read shows only a confirm-then-switch prompt. After `changeBranch` succeeds, the page does a full reload rather than `router.replace` + `refresh`, which keeps it clear of BLOCKER-Z1-019.
- Anything else returns 404.

## Security notes

- **Org and branch are always server-derived.** They come from the registry `validate()` and the RepairOrder's own row, never from the client.
- **Containers are branch-scoped by RLS.** An unreadable container is a 404.
- **The QR resolver is unchanged.** The new target inherits its behaviour: anonymous scan → sign-in → return, the cross-branch hint, and "not available" for branches the user can't access.
- **Client-side hiding is convenience only.** Every write goes through an existing permission-gated action/RPC.

## Known limits (accepted for the pitch)

- **Placed quantity isn't tracked per allocation in the UI.** After "Dodaj do kontenera" the allocation still shows its outstanding quantity. Over-placement is prevented by the Phase 10C quantity-conservation invariant in the RPC.
- **Location visibility:** a Magazynier's branch-scoped `qr.*` doesn't satisfy `qr_codes` org-level `qr.read` RLS, so QR assign/print is for org-level roles (presenter). Scanning works for everyone with branch access, since the resolver uses the service role.
- **Out of scope:** "Przenieś kontener" (10E), the partial-move split (product decision C) and issue (10F).
