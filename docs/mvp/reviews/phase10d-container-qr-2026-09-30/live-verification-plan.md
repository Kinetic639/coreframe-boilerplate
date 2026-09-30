# Phase 10D — Live Verification Plan (after deploy)

**Precondition:** branch `phase-10d-container-qr` is deployed to production (merged to `main`) on the demo org **Grupa Cichy-Zasada – CNP**.

## A. Build the demo container (presenter, CNP Piaseczno)

1. Open Warsztat → ZL **184213** (VW Golf VIII, Tomasz Wiśniewski).
2. On line `5H0807221HGRU` (zderzak przedni): reservation popover → **Zarezerwuj towar** → 1 szt. from `GAB-01`.
3. On the same line, the **Kontener** popover → **Przydziel**.
4. In **Kontenery zlecenia** → **Utwórz kontener**. The code should be prefilled as `K-184213-01`; choose location `ZLC-01` → **Utwórz**.
5. Back on the line's **Kontener** popover → **Dodaj do kontenera** → `K-184213-01`, quantity 1 → **Dodaj**.
6. Repeat 2–5 for `5H0821105` (błotnik lewy) and `WHT005263` (spinki, 10 szt.) into the same container.
7. Open the container (**Otwórz**) and check: code, status, ZL 184213 link, location `ZLC-01`, and three content lines with quantities.
8. **Wygeneruj kod QR** → **Drukuj etykietę**. The PDF label should show `K-184213-01` / `ZL 184213 · Volkswagen` / "Kontener".

## B. Scan checks (phone)

1. Logged in on CNP Piaseczno: scanning the label opens the container screen.
2. Logged out: scan → sign-in → back on the container screen.
3. Presenter active on CNP Poznań: scan → "Kontener w innym oddziale" → **Przełącz oddział**. The page reloads on CNP Piaseczno and shows the container.
4. Magazynier (`+warehouse`, CNP Poznań only): scan → "not available". There must be no container data and no switch offer.

## C. Cross-checks

1. Lokalizacje → `ZLC-01` detail shows the container under containerized stock, and **Otwórz kontener** opens it.
2. Doradca (`+advisor`, org-level `warehouse.inventory.read`, no operate) opens the container and sees its contents, with no "Wygeneruj kod QR" button.

Record PASS/FAIL per step here and in the Zone 3 tracker.
