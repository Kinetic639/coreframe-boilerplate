# Zone 1 — Implementation Boundary: Demo vs. Pilot

Split per this task's own instruction: minimal-but-sufficient for the accepted Zone 1 pitch contract, without pulling PILOT-only IAM hardening into this week's critical path — but without hiding a genuine pitch-path bug merely because it's inconvenient.

## A. REQUIRED FOR DEMO READY NOW

1. **Branch-switch atomic transition fix** (root cause). `SidebarBranchSwitcher` must call `router.refresh()` + navigate to a safe route after a successful switch. This single fix repairs every RSC-rendered page's staleness (RepairOrder list/detail, Movement detail/edit) in one place.
2. **Branch-scoped React Query key fixes** — 4 confirmed instances: Matcher sessions, Locations, Inventory Balances, Inventory Movements, Inventory Products. Each needs `branchId` added to its query key (or equivalent invalidation).
3. **Cross-branch QR/deep-link confirm-then-switch** for `warehouse.location` — currently silently drops the deep-link intent instead of prompting. Reuses the already-correct `changeBranch()` action; no new authorization primitive needed.
4. **Demo choreography discipline** for the confirmed-but-unfixed admin/security gaps (owner protection, last-owner, privilege escalation, self-demotion) — these do NOT require code changes for THIS WEEK's demo, per Zone 1's own accepted scope note ("do not accidentally make full last-owner implementation a pitch blocker unless the pitch path can trigger it"), **provided the demo script only performs the one pre-rehearsed, narrow, already-authorized admin action** (a single role change or invitation, using prepared accounts) and never exercises self-demotion, owner removal, or role-creation-beyond-the-actor's-own-authority. This is a REQUIREMENT ON THE REHEARSAL/CHOREOGRAPHY, not on the code.

## B. REQUIRED BEFORE PILOT

1. **Last-owner protection** at the DB/transactional layer — `ownerCount >= 1` enforced, not just assumed.
2. **Owner-only gate on granting/revoking `org_owner`** — both the direct role-assignment path AND the invitation-acceptance path (currently the weaker, unguarded route).
3. **Anti-privilege-escalation checks** across role creation, role editing, and role assignment (org and branch scope) — compare the requested grant against the actor's own compiled effective permissions.
4. **Self-demotion UI warning**.
5. **Invitation acceptance-time one-organization re-validation** (defense-in-depth; creation-time check already works).
6. **RLS hardening + FORCE** for `wdd_matcher_*` and `helpdesk_tickets` (currently org-scoped-only despite live `branch_id` columns) — real cross-branch data exposure once a pilot introduces more than one branch with real data and more than one account.
7. **Schema/migration reconciliation** for `warehouse_locations`, `wdd_matcher_*`, `app_attachments` (source missing from the authoritative tree) and `qr_codes`/`qr_assignments` (source missing from BOTH trees — must be reverse-engineered from live schema, since no committed definition exists anywhere).
8. **One-organization-per-user** DB-level enforcement (currently app-level-only).
9. **Unsaved-work protection**, generalized beyond the single Movement Editor risk, if pilot usage patterns show real multi-tasking risk.
10. **Live-DB RLS integration test coverage that actually runs** — the one existing test file is structurally skipped under the project's own documented test command; fix the env-loading gap so this coverage is real, not theoretical.
11. **Administrative auditability** for sensitive admin actions (not independently re-verified this pass; carried forward from Zone 1's own doc).

## C. ALREADY CORRECT — DO NOT TOUCH

- `changeBranch` server action's own access validation (JWT-validated, re-derives everything server-side, cannot be bypassed by a crafted client call).
- Server loaders (`load-app-context.v2.ts`, `load-dashboard-context.v2.ts`) — no stale-caching layer, `resolveActiveBranch`'s safe fallback logic (including its own explicit re-validation + userContext reload on branch mismatch).
- Permission-context-after-switch (`PermissionsSync` → `useBranchPermissionsQuery` → Zustand bridge) — proven correct with a concrete Manager-A/Worker-B scenario.
- Multi-role union computation (`compile_user_permissions`) — correct set-based logic, no "pick one role" bug.
- Org-wide wildcard/admin branch-access mechanism (NULL-branch inheritance in `has_branch_permission`).
- Branch-scope containment (branch-scoped roles cannot escape to org-wide permissions) — the one architecturally sound piece of the otherwise-broken privilege-escalation story.
- Member removal, revocation-on-next-request, and historical-identity preservation — all three independently verified correct, including the synchronous trigger-driven permission recompilation.
- `session-branch.ts` per-tab isolation.
- Warehouse Map page and `workshopKeys.lineReservations` — reference implementations of the correct branch-keyed query pattern.
- QR resolver's cross-org rejection and the login `returnUrl` open-redirect protection.

## D. DEFERRED / OUT OF SCOPE

- Clean-room migration reproducibility (Inventory Core's own already-accepted, separately-deferred technical debt — not reopened by this Zone 1 pass).
- Full schema/RLS coverage for every table in the app (only Zone-1-critical tables were audited this pass).
- The branch-access-vs-permission schema conflation (item 4 in `authorization-model-verification.md`) — a real architectural note, but not a functional bug; worth a future design conversation, not urgent for either demo or pilot.
- Advanced concurrency/race testing beyond what's already covered.
- `apps/web/CLAUDE.md`'s stale project-ref instruction — a one-line documentation fix, low priority, not touched in this read-only pass.

## Explicit risk disclosure (per this task's own instruction not to hide inconvenient findings)

The admin/security gaps in Section A.4 above (no owner protection, no anti-escalation checks) are **real, confirmed vulnerabilities**, not merely theoretical. They are being classified as "does not require code before Thursday" ONLY because Zone 1's own already-accepted product contract explicitly scopes them this way ("not necessarily a pitch blocker unless the chosen pitch scenario exercises it"), AND because the current demo choreography (per `docs/mvp/presentation-demo-setup.md` and `docs/mvp/ambra-skrypt-prezentacji.md`) does not call for demonstrating self-demotion, owner removal, or an unauthorized escalation. **If the demo choreography changes to include any of those, this classification must be revisited before that rehearsal, not after.**
