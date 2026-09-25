# Demo Users and Roles (Proposal Only — No Accounts Created)

Three accounts, matching `presentation-demo-setup.md`'s own three named personas (Presenter/admin, Warehouse user, Advisor/acceptor), mapped precisely onto what Phase 8's own scenario list actually requires. No real email addresses or passwords are chosen here — placeholders only, per this task's explicit instruction.

## USER 1 — Presenter / Admin (`<presenter-email>`)

- **Purpose:** drives most of the demo; the account with the broadest access.
- **Org membership:** `Ambra Demo`, org-level role with full/administrative permissions (an `org_owner`-equivalent role, or a role carrying the relevant wildcard permissions — e.g. `warehouse.*`, `branches.view.update.any`).
- **Branch access:** both Warszawa and Kraków (via `BRANCHES_VIEW_UPDATE_ANY`/`BRANCHES_VIEW_ANY`-equivalent, not two separate narrow assignments — this account should see and switch between both branches freely, matching an admin's real-world access).
- **Role per branch:** effectively org-wide administrative access, not branch-scoped.
- **Permissions relevant to demo:** full warehouse read/write, branch switching, one administrative action (e.g. a role/permission change, or an invitation — whichever the final choreography picks), QR assignment.
- **Exact Phase 8 scenarios that depend on this account:**
  - Scenario 4 (Sidebar A→B / B→A switch) — primary driver.
  - Scenario 6-9 (Locations/Balances/Movements/Products branch-switch) — primary driver.
  - Scenario 10 (RepairOrder/RSC safe redirect) — opens the RepairOrder, switches branch.
  - Scenario 11 (Matcher) — primary driver, including the RepairOrder-materialization step.
  - Scenario 12 (same-branch QR) — scans a Warszawa location QR while active in Warszawa.
  - Scenario 13 (accessible cross-branch QR confirm/cancel) — scans a Kraków location QR while active in Warszawa; has access to Kraków, so the confirm-then-switch flow succeeds.
  - One administrative action (per the task's own "Gate to DEMO READY" scenario requirement, sourced from the implementation plan).

## USER 2 — Warehouse Worker (`<worker-email>`)

- **Purpose:** provides the visible permission contrast Phase 8's own Section 5 scenario requires — a single account with genuinely different, branch-scoped roles on the two branches.
- **Org membership:** `Ambra Demo`.
- **Branch access:** both Warszawa and Kraków, but via two separate, narrower branch-scoped role assignments (not the admin's org-wide wildcard).
- **Role per branch:**
  - Warszawa: a **Manager**-level role (broader — e.g. can approve movements, manage locations within the branch).
  - Kraków: a **Warehouse Worker**-level role (narrower — e.g. read/write stock movements only, no location management, no approval actions).
- **Permissions relevant to demo:** demonstrates that switching branches doesn't just change WHICH data is visible, but also WHAT the same logged-in user is allowed to do — the exact "permission context" Zone 1's own architecture claims to enforce.
- **Exact Phase 8 scenarios that depend on this account:**
  - Scenario 5 (permission-context switch) — the primary and only account this scenario is designed around; log in as this user on Warszawa (Manager actions visible), switch to Kraków (those same actions become unavailable/hidden, Worker-level actions only), switch back and confirm restoration.

## USER 3 — Advisor / Restricted persona (`<advisor-email>`)

- **Purpose:** `presentation-demo-setup.md`'s own "Advisor/acceptor... used if the chosen Zone 1 administrative scenario needs a second account" — repurposed here to ALSO serve as the deliberately branch-restricted account Phase 8's inaccessible-cross-branch-QR scenario requires, since a realistic advisor role stationed at one location is a natural, non-contrived reason for a user to genuinely lack access to the other branch.
- **Org membership:** `Ambra Demo`.
- **Branch access:** Warszawa ONLY — no role assignment of any kind on Kraków, and does not hold `BRANCHES_VIEW_ANY`/`BRANCHES_VIEW_UPDATE_ANY`.
- **Role per branch:** Warszawa: Advisor-level role (or whatever narrow role the final admin-scenario choreography needs this account to demonstrate — e.g. as the target of an invitation or role-change action USER 1 performs).
- **Permissions relevant to demo:** deliberately excludes Kraków entirely — this is the exact condition `isBranchAccessible()` (Zone 1 Phase 6's own shared authorization check) needs to see a `false` result.
- **Exact Phase 8 scenarios that depend on this account:**
  - Scenario 14 (inaccessible cross-branch QR) — while active in Warszawa, scans/opens the Kraków location QR (`QR-B1`, see `qr-fixture-plan.md`); per Zone 1 Phase 6's own corrected contract, this must produce a safe `TARGET_NOT_FOUND`-shaped denial, no switch-branch dialog, no metadata disclosed.
  - Possibly the admin-action scenario, as the second account (invitee/role-change target), if that's the final choreography's chosen shape — TO BE CONFIRMED alongside picking the exact administrative action for Scenario 4's "one administrative action" requirement.

## Account creation method (see `creation-method-matrix.md` for the full matrix)

All 3 accounts: real sign-up via the app's own `/sign-up` flow (Category A) or an invitation accepted through the app's own `/invite/[token]` flow, followed by role assignment via the app's own organization/roles management UI (Category A) or the underlying server actions (Category B) — never a direct `INSERT` into `auth.users`/`organization_members`/`user_role_assignments`.
