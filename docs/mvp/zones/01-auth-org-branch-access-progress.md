# Zone 1 — Identity / Access / Branch / Authorization Progress Tracker

> **Live execution tracker.** This file records CURRENT execution state only — phase statuses, evidence, blockers, discoveries, task counts. It does not own product/architecture decisions (see `01-auth-org-branch-access.md`) or phase design/task definitions (see `01-auth-org-branch-access-implementation-plan.md`). Update this file as work happens; do not let it drift from the plan's own checkbox counts.

- **Zone:** 1
- **Priority:** P0
- **Architecture:** APPROVED
- **Runtime status:** PARTIAL
- **Current phase:** Phase 0 DONE — Phase 1 is next (not started)
- **Pitch readiness:** NOT YET
- **Pilot readiness:** NOT READY
- **Last updated:** 2026-09-23

---

## Mechanical task counts

Computed directly from checkbox counts in `01-auth-org-branch-access-implementation-plan.md`. Recompute whenever a phase's task list changes.

- **Total implementation tasks (DEMO + PILOT): 9/95**
- **Pitch-required tasks (Phases 0-8): 9/48**
- **Pilot-required tasks (Phases A-I): 0/47**

Breakdown by phase (task count = number of checkboxes in that phase's "Implementation tasks" section in the plan):

| Phase     | Task count | Completed |
| --------- | ---------- | --------- |
| 0         | 9          | 9         |
| 1         | 5          | 0         |
| 2         | 4          | 0         |
| 3         | 5          | 0         |
| 4         | 4          | 0         |
| 5         | 4          | 0         |
| 6         | 6          | 0         |
| 7         | 6          | 0         |
| 8         | 5          | 0         |
| A         | 8          | 0         |
| B         | 6          | 0         |
| C         | 3          | 0         |
| D         | 5          | 0         |
| E         | 6          | 0         |
| F         | 5          | 0         |
| G         | 4          | 0         |
| H         | 6          | 0         |
| I         | 4          | 0         |
| **Total** | **95**     | **9**     |

---

## Phase tracker table

| Phase                               | Status            | Pitch/Pilot        | Completed | Notes                                                                                      |
| ----------------------------------- | ----------------- | ------------------ | --------- | ------------------------------------------------------------------------------------------ |
| 0 — Implementation baseline         | DONE (2026-09-23) | PITCH prerequisite | 9/9       | Satisfied entirely by the pre-implementation verification bundle, committed at `5dfce9d3`. |
| 1 — Centralized branch transition   | NOT STARTED       | PITCH              | 0/5       | Next phase. Root-cause fix for the branch-switch bug.                                      |
| 2 — DataView/query-key foundation   | NOT STARTED       | PITCH              | 0/4       | Independent of Phase 1; can run in parallel.                                               |
| 3 — Migrate DataView consumers      | NOT STARTED       | PITCH              | 0/5       | Depends on Phase 2.                                                                        |
| 4 — Matcher query key               | NOT STARTED       | PITCH              | 0/4       | Independent of Phases 1-3.                                                                 |
| 5 — Branch-state re-sweep           | NOT STARTED       | PITCH gate         | 0/4       | Depends on Phases 1-4.                                                                     |
| 6 — Cross-branch QR/deep-link       | NOT STARTED       | PITCH              | 0/6       | Depends on Phase 1.                                                                        |
| 7 — Automated closeout              | NOT STARTED       | PITCH gate         | 0/6       | Depends on Phases 1-6.                                                                     |
| 8 — Manual DEMO READY UAT           | NOT STARTED       | PITCH gate         | 0/5       | Depends on Phases 1-7. Only after this: 🔵 DEMO READY.                                     |
| A — Ownership invariants            | NOT STARTED       | PILOT              | 0/8       | Not scheduled this week.                                                                   |
| B — Anti-escalation                 | NOT STARTED       | PILOT              | 0/6       | Not scheduled this week.                                                                   |
| C — Invitation + one-org invariant  | NOT STARTED       | PILOT              | 0/3       | Not scheduled this week.                                                                   |
| D — Branch RLS hardening            | NOT STARTED       | PILOT              | 0/5       | Not scheduled this week.                                                                   |
| E — Schema reconciliation           | NOT STARTED       | PILOT              | 0/6       | Not scheduled this week. Includes the CLAUDE.md project-ref fix.                           |
| F — Unsaved-work safety             | NOT STARTED       | PILOT              | 0/5       | Not scheduled this week.                                                                   |
| G — Live test infrastructure        | NOT STARTED       | PILOT              | 0/4       | Not scheduled this week.                                                                   |
| H — Administrative auditability     | NOT STARTED       | PILOT              | 0/6       | Not scheduled this week.                                                                   |
| I — PILOT READY manual verification | NOT STARTED       | PILOT gate         | 0/4       | Depends on Phases A-H. Only after this: 🟢 PILOT READY.                                    |

---

## Active blockers

Stable IDs, once assigned, are never reused. None of the items below block Phase 1 (the next phase to implement) from starting — they are recorded so they are not forgotten, per the task's own explicit instruction not to let known gaps disappear from view after the presentation.

### PITCH implementation gaps (block DEMO READY, not yet started)

- **BLOCKER-Z1-001** — Branch switch performs no `router.refresh()`/navigation/cache invalidation (`SidebarBranchSwitcher.handleBranchSelect`). Owner: Phase 1. Status: OPEN, not yet started.
- **BLOCKER-Z1-002** — `DataViewListParams` has no `branchId` field; 4 confirmed consumers (Locations, Inventory Balances, Inventory Movements, Inventory Products) have branch-agnostic cache keys. Owner: Phases 2-3. Status: OPEN, not yet started.
- **BLOCKER-Z1-003** — `wddMatcherKeys.sessions()` is branch-agnostic; zero test coverage exists for this key. Owner: Phase 4. Status: OPEN, not yet started.
- **BLOCKER-Z1-004** — `warehouse.location` QR/deep-link silently drops cross-branch intent instead of confirm-then-switch (safe, not a leak, but a missing UX requirement). Owner: Phase 6. Status: OPEN, not yet started.
- **BLOCKER-Z1-005** — 2 Zone-1-relevant test files carry mock/fixture drift (`organization-rls.test.ts`'s `createBranch` test, `load-app-context.v2.test.ts`'s branch-field fixture). Owner: Phase 7. Status: OPEN, not yet started.

### PILOT security blockers (real vulnerabilities, deliberately deferred past the presentation)

- **BLOCKER-Z1-006** — No owner-only gate on granting/revoking `org_owner`; a second, weaker route exists via invitation acceptance (`accept_invitation_and_join_org` performs zero re-check). Owner: PILOT Phase A. Severity: HIGH. Demo-safe only because current choreography never exercises owner grant/revoke beyond one pre-rehearsed action.
- **BLOCKER-Z1-007** — No `ownerCount >= 1` enforcement at any layer; the last owner of an org can be removed/demoted with no protection. Owner: PILOT Phase A. Severity: HIGH.
- **BLOCKER-Z1-008** — No anti-privilege-escalation check anywhere in role creation/editing/assignment; any `members.manage` holder can grant themselves or others permissions broader than their own (branch-scope containment is the one safe exception). Owner: PILOT Phase B. Severity: HIGH.
- **BLOCKER-Z1-009** — Invitation acceptance does not re-validate the one-org-per-user invariant; the invariant is app-level only, not DB-enforced. Owner: PILOT Phase C. Severity: MEDIUM.
- **BLOCKER-Z1-010** — `wdd_matcher_*` and `helpdesk_tickets` have RLS enabled but NOT forced, org-scoped only despite live `branch_id` columns — any org member can read/act on another branch's Matcher session or Help Desk ticket. Owner: PILOT Phase D. Severity: MEDIUM-HIGH.
- **BLOCKER-Z1-011** — `organization-rls-integration.test.ts` (the only live-DB RLS integration coverage for org membership/roles) is structurally skipped under the project's own test command; likely also skipped in CI. Owner: PILOT Phase G. Severity: MEDIUM (masks confidence, not itself a runtime vulnerability).
- **BLOCKER-Z1-012** — No shared unsaved-work/navigation-guard mechanism; a dirty Movement Editor or RepairOrder creation form can silently lose data on a branch switch. Owner: PILOT Phase F. Severity: LOW-MEDIUM (data-loss risk, not a security hole).
- **BLOCKER-Z1-013** — No administrative auditability for sensitive admin actions (role change, branch reassignment, invitation creation, owner grant/revoke). Owner: PILOT Phase H. Severity: MEDIUM.

### Accepted deferred technical debt (not security-critical, tracked so it isn't lost)

- **BLOCKER-Z1-014** — `warehouse_locations`/`app_attachments` migrations missing from the authoritative target tree (live-correct, paper-trail-only gap). Owner: PILOT Phase E.
- **BLOCKER-Z1-015** — `qr_codes`/`qr_assignments` have no committed migration source in either tree at all; live schema was applied out-of-band. Owner: PILOT Phase E.
- **BLOCKER-Z1-016** — `apps/web/CLAUDE.md` line 19 instructs use of the stale legacy project ref (`zlcnlalwfmmtusigeuyk`) instead of the live target (`rjeraydumwechpjjzrus`). Owner: PILOT Phase E.
- **BLOCKER-Z1-017** — 3 Zone-1-relevant client test suites (`roles-client`, `invitations-client`, `members-client`) crash on load due to an unrelated `nuqs`/`parseAsJson` version mismatch in the shared `data-view-url-state.ts` module — masks their own coverage. Owner: none assigned (explicitly out of Zone 1 scope; flagged for whoever owns the shared `data-view` component).
- **BLOCKER-Z1-018** — `QrTargetDescriptor.validate()`'s JSDoc incorrectly claims `resolvePublicQrToken` runs with an authenticated, RLS-enforced client — it does not (service-role, zero auth check, by design). Stale comment, not a live security issue. Owner: Phase 6 (fixed as part of that phase's own QR work).

### No-longer-blocking findings

None yet — no phase has completed re-verification work since the baseline.

---

## Change log / discoveries

Zone 3 discipline: date, phase, finding, evidence, classification, resolution, whether architecture changed, whether a product-owner decision was needed. Starts with the discoveries already made by the completed pre-implementation verification; does not rewrite that history.

### 2026-09-23 — Pre-implementation verification (Phase 0)

- **Finding:** `apps/web/CLAUDE.md` instructs the wrong Supabase project ref (legacy `zlcnlalwfmmtusigeuyk` instead of live target `rjeraydumwechpjjzrus`). Evidence: `environment-verification.md`. Classification: documentation debt, not a runtime bug. Resolution: assigned to PILOT Phase E (not fixed in Phase 0's own verification pass, per explicit scope instruction). Architecture unaffected. No product-owner decision needed.
- **Finding:** Inventory Products (`inventory-products-client.tsx:42,324`) has the identical branch-agnostic query-key bug as the 3 previously-known instances — a 4th, newly-confirmed instance, found only because the audit re-applied a systematic sweep rather than checking only the already-suspected surfaces. Evidence: `branch-state-cache-inventory.md`. Classification: CONFIRMED BUG, PITCH-relevant. Resolution: assigned to Phase 3. Architecture unaffected (fits the already-accepted branch-keyed query pattern). No product-owner decision needed.
- **Finding:** `qr_codes`/`qr_assignments` have no committed migration source in EITHER migration tree — worse than previously documented (prior belief was "missing from target, present in legacy"). Live `list_migrations` shows 3 applied entries whose filenames exist nowhere in the repository, implying out-of-band schema application. Evidence: `environment-verification.md`. Classification: PILOT schema-integrity gap, not itself a runtime vulnerability (the live tables are RLS-enabled). Resolution: assigned to PILOT Phase E, explicitly requiring from-scratch `information_schema`/`pg_catalog` reconstruction rather than any tree lookup. Architecture unaffected. No product-owner decision needed yet (a decision may be needed later if reconstruction proves impossible for some object — not yet reached).
- **Finding:** `resolvePublicQrToken` performs zero authentication and zero permission check by design (a public, anonymous-safe resolver) — but `QrTargetDescriptor.validate()`'s own JSDoc incorrectly claims it runs with an authenticated, RLS-enforced client. Evidence: `deep-link-qr-verification.md`. Classification: stale/misleading doc comment, not a live security issue (verified: no metadata leak, no unsafe silent switch, cross-org check present). Resolution: assigned to Phase 6 as a small doc-comment correction alongside that phase's own QR work. Architecture unaffected. No product-owner decision needed.
- **Finding:** `organization-rls-integration.test.ts` — the ONLY live-DB RLS integration coverage that exists for org membership/roles — never actually runs under the project's documented `pnpm vitest run` command, because `.env.local` values are never loaded into `process.env` (no dotenv, no `vitest.config.ts` env loading, no CI injection found). Evidence: `test-results.md`. Classification: PILOT test-infrastructure gap; likely also silently skipped in CI. Resolution: assigned to PILOT Phase G. Architecture unaffected. No product-owner decision needed.
- **Finding:** Help Desk's own action layer never references `activeBranchId` at all today, despite `helpdesk_tickets` having a live `branch_id` column and RLS-enabled-but-not-forced org-scoped policies. Evidence: `branch-state-cache-inventory.md`, `environment-verification.md`. Classification: ambiguous — may be intentional (Help Desk deliberately org-wide with optional manual branch filter) or may be an oversight. **Product-owner decision needed before PILOT Phase D can proceed on the Help Desk half of its scope** — explicitly flagged as an open question in that phase's own task list and blocker rule, not resolved here.

### 2026-09-23 — Zone 1 implementation planning pass (this task)

- **Decision:** Re-evaluated `recommended-implementation-pass.md`'s 3-change recommendation and expanded it into 9 DEMO-READY phases (0-8) plus 9 PILOT-READY phases (A-I), per the required A-H topic separation and the "one coherent concern per phase" discipline modeled on Zone 3's 22-phase pattern. Rationale recorded in the phase-boundary analysis (`docs/mvp/reviews/zone1-implementation-planning-2026-09-23/zone1-phase-boundary-analysis.md`). Not a redesign of the underlying fixes themselves — the 3 recommended code changes map onto Phases 1 (branch transition), 2+3+4 (query-key foundation + 4 DataView consumers + Matcher, split from one change into 3 phases because DataView and Matcher are architecturally distinct modules and the 4 DataView consumers share one mechanical fix pattern), and 6 (QR confirm-then-switch). Architecture (the product decisions in `01-auth-org-branch-access.md`) is unaffected — this is purely an execution-sequencing decision. No product-owner decision was needed for this split itself.
- **Decision:** Phase 0 is marked DONE immediately, citing the pre-implementation verification bundle as its own acceptance evidence, following the exact precedent Zone 3's own Phase 0A set (a baseline/reconciliation phase can close on verification evidence alone, without a corresponding code change).

---

## DEMO READY gate

Not yet reached. Requires Phases 1-8 all DONE, with Phase 8's manual UAT evidence recorded (date, build/commit SHA, environment, accounts, PASS/FAIL per scenario step) directly in this section once it happens. Placeholder — to be filled in when Phase 8 executes:

```
Manual DEMO READY UAT — NOT YET RUN
Date: —
Build/commit: —
Environment: —
Accounts used: —
Result: —
```

## PILOT READY gate

Not yet reached. Requires Phases A-I all DONE, with Phase I's manual verification evidence recorded here once it happens. Placeholder:

```
Manual PILOT READY verification — NOT YET RUN
Date: —
Build/commit: —
Environment: —
Accounts used: —
Result: —
```
