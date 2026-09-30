# Ambra — Current Presentation Demo Setup

Defines the exact demo environment required for the current pitch, per `docs/mvp/ambra-skrypt-prezentacji.md` and `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/`. **Supersedes `docs/mvp/mvp-readiness-test-org-setup.md`** (2026-08-12, covered only QR/locations + Help Desk — predates RepairOrders/Matcher-approval/receiving/putaway/containers/issue entirely).

This document specifies what must exist before rehearsal. The organization, branches, user accounts and base warehouse data **were created on 2026-09-29** (see "Created demo environment" and "Created warehouse data" below). The remaining data rows are still to be created.

## Created demo environment (2026-09-29)

Project: live Supabase target `rjeraydumwechpjjzrus`. App: `https://app.ambra-system.com`.

| Item         | Value                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization | **Grupa Cichy-Zasada – CNP** (slug `ambra-demo-serwis`, id `2c5aa49a-cc3d-4166-8c5f-f6c94307103f`), plan **Professional** (10 branches, all modules) |
| Branch #1    | **CNP Piaseczno** (`5f1d2311-99c0-44b9-9f24-3af573a3af36`), presenter's default branch                                                               |
| Branch #2    | **CNP Poznań** (`cc67f108-33f1-4e80-98a4-15fc799d1a41`)                                                                                              |

| Account                                | Name             | Roles                                                     | Branch access       | Verified in app                                             |
| -------------------------------------- | ---------------- | --------------------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| `michal.stepien36+presenter@gmail.com` | Prezenter Demo   | `org_owner`                                               | both                | dashboard on CNP Piaseczno; switch to CNP Poznań took 2.0 s |
| `michal.stepien36+warehouse@gmail.com` | Magazynier Demo  | `org_member` + **Magazynier** (branch-scoped, CNP Poznań) | **CNP Poznań only** | switcher lists only CNP Poznań                              |
| `michal.stepien36+advisor@gmail.com`   | Doradca Demo     | `org_member` + **Doradca** (org)                          | both                | CNP Piaseczno + CNP Poznań; Workshop visible                |
| `michal.stepien36+helpdesk@gmail.com`  | Zgłaszający Demo | `org_member` + **Zgłaszający (Help Desk)** (org)          | both                | CNP Piaseczno + CNP Poznań                                  |

**Custom roles:**

- **Magazynier:** `module.warehouse.access`, `module.tools.access`, `warehouse.*`, `qr.*`, `tools.read`, `branches.read`.
- **Doradca:**
  - `module.workshop.access`, `workshop.*`;
  - `module.helpdesk.access` plus every concrete `helpdesk.*` slug;
  - `module.planning.access` plus every concrete `planning.*` slug;
  - `module.warehouse.access`, `warehouse.read`, `warehouse.inventory.read`, `warehouse.locations.read`, `warehouse.products.read`;
  - `module.tools.access`, `tools.read`;
  - `wdd_matcher.read` / `review` / `approve`;
  - `branches.view.any`.

  The Help Desk and Planning wildcards are expanded into explicit slugs on purpose (see bug 4 below).

- **Zgłaszający (Help Desk):** `module.helpdesk.access`, `helpdesk.read`, `helpdesk.tickets.read`, `helpdesk.tickets.create`, `branches.view.any`.

Passwords are set by the product owner and are **not** recorded here. They were shared in a working session, so change them before rehearsal.

**How it was created:**

- The presenter signed up through the real production sign-up form, with registration switched on for about a minute and then off again.
- The org and branches were created directly in the database, replicating `create_organization_for_current_user` plus branch numbering (bug 1 below).
- The roles were created in the admin Roles page, and their module permissions were added in the database (bug 3).
- The three users were invited from the admin Invitations page and accepted their invitations in the real app.

**Bugs found during setup** (not fixed; registration and onboarding are out of scope for the coming months):

1. **Onboarding can't create an organization:** `create_organization_for_current_user` inserts `branches` without the NOT NULL `branch_number`.
2. **Auth email links 404:** confirmation and recovery links point to `https://www.ambra-system.com/auth/confirm…`, which returns 404. The same path on `app.ambra-system.com` works. Likely fix: set `NEXT_PUBLIC_SITE_URL=https://app.ambra-system.com` in Vercel.
3. **Roles page can't assign module permissions.** The permission picker lists only Organization Management permissions.
4. **Permission compile fails on overlapping wildcards.** `compile_user_permissions` hits "ON CONFLICT DO UPDATE command cannot affect row a second time" when a role's wildcard (e.g. `helpdesk.*`) expands to a slug that `org_member` grants explicitly. `accept_invitation_and_join_org` hides this as `INTERNAL_ERROR`.
5. **Invitation sign-up shows a false error.** After a successful invitation sign-up, the redirect back to `/rejestracja` drops the `invitation` param, so the page shows "Registration disabled".
6. Org-scoped roles give no branch access without `branches.view.any`, so users see "No accessible branch". This is expected by design but easy to miss when creating roles.
7. `org_member` alone makes Warehouse, Planning and CRM appear in the sidebar for the Help Desk user. Review before the demo if that user is shown.

## Created warehouse data (2026-09-29)

Modelled on a VW Group **blacharnia-lakiernia** (body and paint shop, the Grupa Cichy-Zasada Centrum Napraw Powypadkowych profile). All names are in Polish.

- **How it was created:** as the presenter, through the same database functions the app calls:
  - `inventory_seed_movement_types`;
  - `inventory_create_product_with_default_variant`;
  - `inventory_receive_stock` (101/PZ).

  Stock therefore has a proper posted ledger, not direct balance writes.

- **Movement types:** the org's standard 7 were seeded (101, 311, 312, 401, 402, 801, 900).
- **Units:** SZT (sztuka), KPL (komplet), OP (opakowanie), ROL (rolka), L (litr), ML (mililitr), KG (kilogram), M (metr).

**Locations:** the same 26-node layout in each branch (codes are unique per branch):

| Code                    | Name                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `PRZ`                   | Strefa przyjęć dostaw (**receiving location**)                                                          |
| `MC`                    | Magazyn części blacharskich                                                                             |
| `MC/R01` (`R01-A..C`)   | Regał R01: drobnica i elementy mocujące                                                                 |
| `MC/R02` (`R02-A..C`)   | Regał R02: oświetlenie i lusterka                                                                       |
| `MC/R03` (`R03-A..B`)   | Regał R03: atrapy, listwy, osłony                                                                       |
| `MC/GAB`                | Strefa gabarytów: `GAB-01` zderzaki, `GAB-02` błotniki, `GAB-03` maski i drzwi                          |
| `MC/ZLC` (`ZLC-01..03`) | Regał zleceń: części skompletowane                                                                      |
| `LAK`                   | Magazyn lakierni: `LAK-A` lakiery i utwardzacze, `LAK-B` podkłady i szpachle, `LAK-C` ścierniwa i taśmy |
| `ZWR`                   | Zwroty i reklamacje                                                                                     |

**Products (46):**

- **Body parts (26):** VW-format part numbers as SKUs, no spaces, `GRU` = gruntowany (primed). Models: VW Golf VIII (`5H0…`/`5H1…`), Tiguan II (`5NA…`), Passat B8 Variant (`3G9…`), Polo VI (`2G4…`), T-Roc (`2GA…`); Škoda Octavia IV (`5E3…`); Audi A3 8Y (`8Y0…`). Examples: `5H0807221HGRU` zderzak przedni Golf VIII, `5H1941005B` reflektor Full LED lewy Golf VIII, `5E3821106` błotnik przedni prawy Octavia IV.
- **Fasteners (5):** e.g. `WHT005263`, `3C0853585`.
- **Paint-shop materials (15):** internal codes. Base coats mixed to VW colours `LC9X` Deep Black Perłowy, `LB9A` Pure White and `LA7W` Reflex Silver; clear coat HS 2K; hardener; thinner; primer 2K; putty; degreaser; abrasive discs P320/P500/P800; masking tape and film; tack cloths.
- **Data details:** purchase prices in PLN; brand set to Volkswagen / Škoda / Audi for parts.
- **Research sources for the numbering pattern and example numbers:** public parts listings (Allegro, 2407.pl, motoplatforma.com). The numbers are realistic demo data, not a verified catalogue.

**Stock (4 posted PZ documents, received straight onto the target shelves):**

| Branch        | Documents                                                                                   | SKUs in stock | Stock value (purchase) |
| ------------- | ------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| CNP Piaseczno | PZ/2026/000001 (`VGP/2026/09/4812`, części), PZ/2026/000002 (`LAK/2026/09/0317`, materiały) | 43            | 44 411,20 zł           |
| CNP Poznań    | PZ/2026/000003 (`VGP/2026/09/4827`), PZ/2026/000004 (`LAK/2026/09/0322`)                    | 41            | 34 499,80 zł           |

- Stock levels deliberately differ between branches, so a branch switch shows a visible difference.
  - CNP Piaseczno only: e.g. Golf VIII rear bumper, bonnet, left headlight, Audi A3 bumper.
  - CNP Poznań only: e.g. Passat B8 rear bumper, Polo VI door, Octavia IV headlight.
- Verified in the app as the presenter: Produkty lists 46/46 with per-branch "Na stanie"; the Lokalizacje tree shows the layout with quantities.
- **App UI gap noticed** (not data): the product list shows the type and status values in English ("Stocked", "active"), and dates in US format.

## Names, suppliers and repair orders (2026-09-30)

**Renamed** to mirror a Grupa Cichy-Zasada Centrum Napraw Powypadkowych:

- organization "Ambra Demo Serwis" → **Grupa Cichy-Zasada – CNP** (slug unchanged);
- branch "Warszawa" → **CNP Piaseczno** (`cnp-piaseczno`), still the presenter's default;
- branch "Kraków" → **CNP Poznań** (`cnp-poznan`).

The branch ids are unchanged, so all data, roles and access carried over.

**Suppliers:**

- **Volkswagen Group Polska – Dystrybucja Części:** default supplier of the 31 body parts and fasteners.
- **Hurtownia lakiernicza – materiały i ścierniwa:** default supplier of the 15 paint-shop materials.

**Repair orders:** created as the presenter, like the app's manual create (`RepairOrdersService.createRepairOrder` + lines). All are `open` and `resolved`, and every line is `pending`.

| ZL     | Order no.  | Branch        | Vehicle / VIN                         | Client                  | Lines                                                                        |
| ------ | ---------- | ------------- | ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| 184213 | 4500418823 | CNP Piaseczno | VW Golf VIII, `WVWZZZCDZNW012487`     | Tomasz Wiśniewski       | zderzak przedni, błotnik lewy, reflektor LED lewy, 2× uchwyt PDC, 10× spinka |
| 184257 | 4500418861 | CNP Piaseczno | Škoda Octavia IV, `TMBJR7NX3MY054219` | Anna Zielińska          | zderzak przedni, błotnik prawy, listwa progowa, 6× klips                     |
| 184301 | 4500418907 | CNP Piaseczno | Audi A3 8Y, `WAUZZZGY6NA031552`       | Flota-Serwis Sp. z o.o. | zderzak przedni, atrapa, 2× czujnik PDC                                      |
| 191044 | 4500421115 | CNP Poznań    | VW Polo VI, `WVWZZZAWZKU087341`       | Marek Nowicki           | drzwi przednie lewe, 4× klips                                                |
| 191078 | 4500421152 | CNP Poznań    | VW Tiguan II, `WVGZZZ5NZKW102938`     | Katarzyna Lewandowska   | zderzak przedni, błotnik prawy, 2× czujnik PDC, 8× spinka nadkola            |

- `dealer_name` holds a 4-digit dealer code (`0214` Piaseczno, `0187` Poznań), following existing data.
- Client names, VINs and order numbers are fictional.
- Verified in the app: Warsztat → Zlecenia naprawy lists each branch's own orders.

**Still to do, by a human:**

- generate and print the location QR labels on the presentation printer, then test them with the phone;
- change all demo passwords before rehearsal.

## Organization

- One demo organization. **CREATED**: Grupa Cichy-Zasada – CNP.

## Branches

- **At least two branches**, so Zone 1 branch switching can be demonstrated and verified live. This is the exact mechanism the confirmed Zone 1 bugs affect: the demo itself must exercise a real branch switch, not merely claim the capability. **CREATED**: CNP Piaseczno, CNP Poznań.

## Users

- **Presenter/admin:** full access, the account driving most of the demo. **CREATED** (`+presenter`).
- **Warehouse user:** a role distinct from admin, used to demonstrate role-scoped access and the branch-switch scenario. **CREATED** (`+warehouse`, CNP Poznań only).
- **Advisor/acceptor:** a second, contrasting role, used if the chosen Zone 1 administrative scenario (role change or invitation) needs a second account. **CREATED** (`+advisor`).
- **Optional Help Desk second user:** only if Zone 8's two-account ticket scenario (create → comment → accept) is included in the final choreography. **CREATED** (`+helpdesk`).

## Data

| Datum                                                                   | Timing                                                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Representative products/SKUs                                            | **CREATED 2026-09-29**: 46 products (see "Created warehouse data")                                                                                              |
| Warehouse locations (a small, named set with unique codes)              | **CREATED 2026-09-29**: 26 per branch                                                                                                                           |
| Receiving location (designated per branch)                              | **CREATED 2026-09-29**: `PRZ` in each branch                                                                                                                    |
| One RepairOrder with representative lines                               | CREATE BEFORE REHEARSAL (or live during Matcher demo — see below)                                                                                               |
| One Matcher source session that materializes into the RepairOrder above | CREATE DURING DEMO (this is the live-demoed step itself — §3/§6 of the script)                                                                                  |
| One reservation                                                         | CREATE DURING DEMO (part of the live container-workflow chain, once Phase 10D/10E land)                                                                         |
| One allocation                                                          | CREATE DURING DEMO (same chain)                                                                                                                                 |
| One container                                                           | CREATE DURING DEMO (same chain)                                                                                                                                 |
| Container QR (after Phase 10D lands)                                    | CREATE DURING DEMO — printed/assigned live as part of the container step                                                                                        |
| Location QR (printed labels for the demo location set)                  | CREATE BEFORE REHEARSAL — must be physically printed and tested on the presentation printer ahead of time, not generated live                                   |
| Stock sufficient for putaway/relocation/issue                           | **Base stock CREATED 2026-09-29** (4 posted PZ documents); the putaway/relocation/issue operations THEMSELVES are performed live                                |
| One ticket, if Help Desk is shown                                       | CREATE DURING DEMO (the create step is itself part of the Zone 8 demo) — or CREATE BEFORE REHEARSAL if the chosen choreography instead opens an existing ticket |
| One planning task, only if Planning is shown                            | CREATE BEFORE REHEARSAL, if the narrow Zone 9 example is included                                                                                               |

## Devices

- **Presentation laptop** — primary driving device for Matcher, RepairOrder detail views, search/relocation UI, dashboard.
- **Presentation phone** — required for: QR scanning (location + container once Phase 10D lands), mobile putaway (once built, P0-3), ticket QR scan (if Zone 8 shown). Must be tested at the actual presentation location beforehand (camera permissions, HTTPS, lighting) — per `mvp-readiness.md`'s own risk table.
- **Printer** — only if label printing itself will be demonstrated live; otherwise labels are pre-printed (see Data table above) and the printer is not part of the live demo path.

## Deployment topology (required for demo performance)

- **Vercel Function Region: `dub1` (Dublin). Supabase: `eu-west-1`. Fluid Compute: ON.** Confirmed 2026-09-29.
- Keep the functions co-located with Supabase. With the previous `iad1` region, a branch switch took ~15–25 s in production; after the move to `dub1` it takes ~1–2 s.
- Before the presentation, re-check that neither region has changed.
- Evidence: `docs/mvp/reviews/branch-switch-performance-closeout-2026-09-29/`. Deeper optimizations are deferred post-demo; see `deferred-performance-work.md` there.

## Sequencing note

This setup document assumes the P0 blockers in `presentation-ready-gate.md` are resolved before rehearsal — several data rows above (container, container QR, mobile putaway session) depend on code that does not exist yet as of 2026-09-23. Do not attempt to prepare those specific data rows until the corresponding P0 item has landed.

## Manual UAT scenarios this setup must support

Cross-referenced from `mvp-readiness.md`'s own "Globalny plan weryfikacji ręcznej" table and `presentation-ready-gate.md`'s own done-criteria — this setup's org/branch/user/data combination must be sufficient to execute, in order: Access (Zone 1, including a real branch switch) → Matcher public + persistent → RepairOrder + attachments → Receiving/putaway → Search/relocation (including container QR relocation) → Issue (201/WZ) → Access administration → Ticket (if shown) → full dress-rehearsal run.

## Browser/device matrix

- Desktop browser on the presentation laptop (primary driving device for non-phone steps).
- Mobile browser on the presentation phone (camera-based QR scanning, mobile putaway).
- No other device/browser combination is required — the product is a responsive web app, not a native mobile app; there is no separate "mobile app" build to test.
