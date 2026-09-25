# Demo Organization Design (Proposal Only — Not Created)

## Organization

- **Proposed name:** `Ambra Demo`
- **Proposed slug:** `ambra-demo` (deterministic, greppable, clearly distinguishable from scratch/test orgs — see `cleanup-reset-plan.md`)
- **Not created in this pass.** See `approval-checklist.md`.

## Branch A

- **Proposed name:** `Warszawa` (matches the branch-slug naming already used as a realistic example throughout Zone 1's own test fixtures, e.g. `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts`'s `branches: { data: { slug: "warsaw" } }` — reusing a name already established in this codebase's own test/demo conventions, not inventing a new one).
- **Purpose:** the "home"/primary branch. Where the Presenter/Admin starts, where the RepairOrder + first Matcher session + the receiving/putaway/issue narrative live (to the extent those flows are built — see the "What is NOT yet buildable" note below).
- **Data that lives there:** 2-3 named locations, a subset of the representative products with stock, movement history, the RepairOrder, the Presenter/Admin's Manager-level role, the Warehouse Worker's Manager-level role (see `demo-users-and-roles.md`).

## Branch B

- **Proposed name:** `Kraków`
- **Purpose:** the "other" branch — exists specifically to make the branch-switch behavior (Zone 1's own core subject) visually and functionally obvious: different locations, different stock, a different (or absent) Matcher session, and — critically — the target of both the accessible-cross-branch QR scenario (for the Presenter/Admin and the Warehouse Worker) and the inaccessible-cross-branch QR scenario (for the Advisor/Restricted persona, who has no role here at all).
- **Data that lives there:** 2-3 named locations (visually distinct names from Branch A's, e.g. different location-code prefix), a different subset/quantity of the representative products, its own movement history, one Matcher session, the Presenter/Admin's full access, the Warehouse Worker's Warehouse-Worker-level (narrower) role.

## Why this pair makes the branch-switch difference "visually obvious" (per this task's own requirement)

- Different location naming prefixes per branch (e.g. `WAW-` vs `KRK-`) so a screenshot or a live switch instantly shows different location codes, not just different row counts.
- Deliberately different product/stock quantities per branch (not mirrored 1:1) so the Balances screen visibly changes, not just re-labels.
- Deliberately different movement history per branch so Movements visibly changes.
- Only Branch A gets the RepairOrder + primary Matcher-materialization narrative; Branch B gets its own distinct, smaller Matcher session — so the Matcher session list visibly changes on switch, and the RepairOrder itself (correctly) does NOT appear when active in Branch B (this IS the Zone 1 branch-isolation behavior being demonstrated).

## What is NOT yet buildable on top of this org (per `current-pitch-scope.md` and `presentation-ready-gate.md`, both read as authoritative sources for this plan)

The full container workflow (reservation → allocation → container → container QR → container relocation → 201/WZ issue) and the mobile receiving/putaway UI are **PITCH REQUIRED but NOT YET BUILT** (Phase 10D/10E/10F and Zone 5's mobile UI are all `NOT STARTED` per `presentation-ready-gate.md`, last verified 2026-09-23/24 — this plan does not re-verify that status, since it's Zone 3/Zone 5 scope, explicitly out of bounds for this Zone 1 task). This demo org design is scoped to what Zone 1's own Phase 8 UAT actually needs (branch switching, permissions, Locations/Balances/Movements/Products, RepairOrder detail's safe-redirect behavior, Matcher session-list switching, and location QR) — it does **not** attempt to provision reservation/allocation/container/container-QR/issue fixtures, since the underlying features don't exist yet to exercise them. When Phase 10D/10E/10F land, this same demo org can be extended (not rebuilt) with that data.
