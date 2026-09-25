# Warehouse Fixture Plan (Proposal Only — Nothing Created)

Deliberately small and deterministic, per this task's own instruction ("Avoid creating a huge fake warehouse. The goal is: small, deterministic, easy to reset, easy to recognize during demo").

## Locations

| Code   | Branch   | Name (PL, matching the app's Polish-first UI) | Purpose                                                                                                         |
| ------ | -------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| WAW-01 | Warszawa | Strefa Przyjęć (Receiving Zone)               | Where the RepairOrder's receiving step would land, and the target of the same-branch QR scenario (`QR-A1`).     |
| WAW-02 | Warszawa | Regał A1 (Rack A1)                            | A second, visually distinct Warszawa location — makes the tree/list genuinely have >1 row.                      |
| KRK-01 | Kraków   | Strefa Przyjęć (Receiving Zone)               | The target of both cross-branch QR scenarios (`QR-B1`) — accessible for USER 1/USER 2, inaccessible for USER 3. |
| KRK-02 | Kraków   | Regał B1 (Rack B1)                            | A second, visually distinct Kraków location.                                                                    |

3 locations per branch is the plan's own upper bound; 2 is the floor. Starting with 2 per branch (WAW-01/WAW-02, KRK-01/KRK-02) is the recommended minimum — add a 3rd per branch only if the chosen demo choreography specifically needs more than one non-receiving location to look convincing on stage.

## Products

A small set of recognizable, realistic warehouse parts (final names TBD with the product owner, but the shape should be):

| SKU (proposed) | Name (proposed)                                                                                                                                                               | Purpose                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AMB-DEMO-001   | (a plausible auto-part or fastener name matching the pitch's own repair-shop narrative — see `docs/mvp/ambra-skrypt-prezentacji.md` for the established narrative vocabulary) | Primary demo part — appears in the RepairOrder's lines and in stock in both branches.                                                   |
| AMB-DEMO-002   | (second part)                                                                                                                                                                 | Secondary demo part — appears in stock, used to make Balances/Movements look like a real small warehouse, not a single-SKU toy example. |
| AMB-DEMO-003   | (third part)                                                                                                                                                                  | Same purpose — kept to 3 total products, matching "several recognizable products" from this task's own minimum, not more.               |

All SKUs prefixed `AMB-DEMO-` for traceability/cleanup (see `cleanup-reset-plan.md`).

## Balances (stock)

Deliberately NOT mirrored 1:1 between branches, so a live switch shows genuinely different numbers, not just a re-label:

- Warszawa: meaningful on-hand quantity for all 3 products (e.g. AMB-DEMO-001: 40, AMB-DEMO-002: 15, AMB-DEMO-003: 8).
- Kraków: a different, smaller/different subset (e.g. AMB-DEMO-001: 12, AMB-DEMO-002: 0 — deliberately absent to show "this branch doesn't have this part", AMB-DEMO-003: 5).

The Kraków AMB-DEMO-002 = 0 (or genuinely absent balance row) case is deliberate: it's the cleanest possible visual proof that the Balances screen is NOT reusing Warszawa's cached list after a switch (the exact Zone 1 bug class Phases 2-3 fixed).

## Movements

A small representative history per branch — enough that Movements is not empty, not so much that it's hard to point at a specific row live:

- Warszawa: 2-3 movements (e.g. a 101 receipt establishing the initial balance, one 301/311 transfer between WAW-01 and WAW-02).
- Kraków: 2-3 movements, different types/quantities/timestamps from Warszawa's (e.g. a 101 receipt, one 801 relocation).

## Creation method

See `creation-method-matrix.md`. Locations, products, and the initial stock/movements that establish them are all createable via existing application UI/server actions (receiving/movement-creation flows already exist per Zone 6/Inventory Core's own already-live status) — no direct SQL required for this category.
