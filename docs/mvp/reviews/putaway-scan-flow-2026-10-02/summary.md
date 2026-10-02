# Scan-driven putaway + "Do przepisania" (2026-10-02)

Goal: putaway on a phone with as little friction as possible, and no walking to the computer after every shelf to update AutoStacja.

## Screen

`/dashboard/magazyn/rozlokowanie` stays, extended. It has two tabs: **Do rozłożenia** and **Do przepisania**.

### Do rozłożenia

- The list is grouped per repair order, showing the client and brand and **the containers the order already has (code · location)**. Bulk and free stock come last.
- Each item keeps the manual "Rozłóż" (scan location → confirm) as a fallback.
- **"Skanuj"** is sticky at the bottom, within thumb reach. It opens a bottom sheet (92dvh) where one scan decides the path:
  - **Repair-order container**
    - Shows only that order's parts, **all preselected** at full quantity, then "Włóż do kontenera".
  - **Blank sticker**
    - "Nowy kontener": the **order comes first** (search by ZL digits or client; most pending first; auto-picked when only one order waits).
    - Then the parts, **none preselected** (a box usually holds some of them).
    - The location can be scanned or picked at any moment; it is required to confirm.
    - The container (`K-<ZL>-NN`) is created and the sticker bound to it.
  - **Location**
    - "What is here": repair-order containers (with "Dołóż" when the order has parts waiting) and loose stock (with reserved quantities).
    - Actions:
      - **"Nowy kontener tutaj"**: the location is preset and the sticker optional. Without a sticker it is the logical container for oversize parts.
      - **"Odłóż luzem"**: free stock and bulk material, with material whose fixed bin is this location preselected.
- **After each putaway the scanner reopens.** It also gives a short vibration on scan and restarts the camera after a failed scan.

### Do przepisania

- Repair orders whose locations changed (today / since yesterday / 7 days). Changes come from putaway, container moves and RW issues.
- Per order:
  - current locations (containers listed), with **new** ones bold and badged;
  - **released** locations struck through.
- No export and no ticking. It is a temporary aid while the manager wants locations kept in AutoStacja as well.

## Database

Migration `20261002133521_putaway_batch` (applied to supabase-target, additive):

- **`inventory_putaway_batch(actor, org, branch, location, container, new_container_repair_order_id, lines)`**
  - puts several items away in **one transaction**;
  - the target is an existing RO container (its own location), a new container created here for one open order, or a location;
  - every line goes through the existing `inventory_putaway_from_receiving`, so commitments and the engine are unchanged.
- **A container holds parts of one repair order only.** A line of another order, or a free/bulk line into a container, is refused (22023) and not re-routed.

The sticker is bound with `QrAssignmentsService.assignToTarget` right after the batch commits. This needs `qr.assign`. If the bind fails, the container exists without a sticker and the UI says so.

## Code

- **Service** `putaway-scan.service.ts`:
  - `containersForRepairOrders`, `getContainer`, `getLocationContents`, `putawayBatch`, `listLocationChanges`.
- **Actions** `actions/warehouse/putaway-scan.ts`:
  - org, branch and actor come from context;
  - reads need `warehouse.inventory.read`, the batch needs `warehouse.inventory.operate`.
- **UI** in `putaway/_components`:
  - `scan-flow.tsx` (the sheet state machine), `part-picker.tsx` (whole-row toggle, −/+ steppers);
  - `location-changes.tsx`, `putaway-utils.ts`, and the reworked `putaway-board.tsx`.
- **`QrCameraScanner`** gets an optional `onRetry`.

## Tests

- `scan-flow.test.tsx`, 5 tests:
  - container path;
  - blank-sticker path with ZL search and the sticker;
  - location → loose with the fixed bin preselected;
  - refusals;
  - mixed-order error.
- `putaway-scan.service.test.ts`, 7 tests: RPC mapping and the error codes.
- The existing putaway tests are green; type-check and build pass.
- **Not verified on a real phone or against real data yet.**
