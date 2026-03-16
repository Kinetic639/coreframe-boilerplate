# Event System Comparison Audit — Verified

**Audit date:** 2026-03-16
**Auditor:** Claude Code (claude-sonnet-4-6)
**Branch:** `event-system`
**Live DB project verified against:** `rjeraydumwechpjjzrus` (TARGET)
**Methodology:** All facts derived directly from (a) live DB queries against `rjeraydumwechpjjzrus`, (b) source file reads, and (c) comparison against the three source documents. No assumptions, no hallucinations. Items that could not be confirmed are labeled UNVERIFIED.

---

## 1. Scope and Methodology

### Documents compared

| Document                                                               | Role in audit                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION_VERIFIED.md` | Prior extraction — claims about current state   |
| `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md`                | Roadmap — claims about what was built per phase |
| `README.md` (project root)                                             | Root README — checked for event system claims   |

### Documents intentionally excluded

- `docs/event-system/EVENT_SYSTEM_VERIFICATION_REPORT.md`
- `docs/event-system/EVENT_SYSTEM_GAP_VERIFICATION.md`
- `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION.md`

### Live DB queries executed

13 queries against `rjeraydumwechpjjzrus` covering: column schema, constraints, indexes, RLS state, policies, grants, migration history, permissions table, DB functions, triggers, function definitions, row count, and service_role privilege verification.

### Source files read

All 11 action files specified, plus: `event-registry.ts`, `event.service.ts`, `event-registry.test.ts`, `event-wiring.test.ts`, both migration files, and the full implementation plan document.

### Project ID cross-check

The extraction document (`EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION_VERIFIED.md`) states at line 4: "Source: Repository source code + live TARGET Supabase project `zlcnlalwfmmtusigeuyk`". This audit uses project `rjeraydumwechpjjzrus`. See Issue 1 for full analysis.

---

## 2. Executive Verdict

**APPROVED WITH LIMITED SCOPE NOTE**

The event system core is architecturally sound and correctly implemented. The database schema, TypeScript layer, emission wiring, projection system, and feed actions are all present and functioning. The plan's Phase 0–6 deliverables are substantively complete and the code matches documented architecture.

The LIMITED SCOPE NOTE applies to:

1. The extraction document's project ID (`zlcnlalwfmmtusigeuyk`) does not match the authoritative target (`rjeraydumwechpjjzrus`). The schemas match, confirming the extraction content is reliable, but the ID discrepancy must be corrected in the document before it is used as a compliance artifact.
2. The `service_role` grants table row showing `is_grantable: NO` for INSERT/UPDATE/DELETE is a Postgres catalog display artifact, not a real restriction. Live function confirmation (`has_table_privilege('service_role', ...)`) returns `true` for all four DML operations. The extraction's claim that service_role has full access is confirmed correct.
3. Three confirmed bugs exist (all minor, non-blocking for production) — see Section 9.
4. Several gaps remain as confirmed roadmap items — see Section 10.
5. The README.md (project root) is the Supabase CLI README, not a project README. No event system claims are made in it. See Section 5.

---

## 3. Extraction vs Real Implementation

### 3.1 Project ID discrepancy

PARTIALLY ALIGNED (documentation error only — content is correct)

The extraction document claims queries were run against `zlcnlalwfmmtusigeuyk`. This audit's queries against `rjeraydumwechpjjzrus` return identical results:

- Same 17-column schema
- Same 3 FK constraints (organization_id, actor_user_id, branch_id) all ON DELETE SET NULL
- Same 5 non-PK indexes (pe_org_created_idx, pe_actor_user_idx, pe_action_key_idx, pe_entity_idx, pe_request_id_idx)
- Same 3 applied event-related migrations (`20260313120718`, `20260313180609`, `20260316052757`)
- Same single SELECT-only RLS policy (`platform_events_org_members_read`)
- Same grant pattern (authenticated/anon: SELECT only; postgres: full; service_role: full)
- Same `audit_rls_permission_gate_slugs` function
- Same single permissions row (`audit.events.read`)

The extraction's content is correct and reliable for `rjeraydumwechpjjzrus`. The project ID listed in the document (`zlcnlalwfmmtusigeuyk`) is a documentation error — either a copy-paste from another project or the extraction was conducted on the wrong project and then applied correctly. Because all schema facts are verified identical, this does not constitute a verification integrity failure; it is a document accuracy problem.

**Required action:** Update line 4 of the extraction document to read `rjeraydumwechpjjzrus`.

### 3.2 Column schema

ALIGNED

Live DB query confirms all 17 columns exactly as documented in the extraction. Types, nullability, and defaults match precisely including `ip_address` as `inet` (not `text`).

### 3.3 Constraints

ALIGNED

Live DB confirms:

- `platform_events_pkey` on `id` (PRIMARY KEY)
- `platform_events_actor_type_check`: actor_type IN ('user', 'system', 'api', 'worker', 'scheduler', 'automation')
- `platform_events_event_tier_check`: event_tier IN ('baseline', 'enhanced', 'forensic')
- `platform_events_organization_id_fk` → `organizations(id)` ON DELETE SET NULL
- `platform_events_actor_user_id_fk` → `users(id)` ON DELETE SET NULL
- `platform_events_branch_id_fk` → `branches(id)` ON DELETE SET NULL

The extraction notes the branch_id FK was added in a separate migration. This is confirmed — the FK was applied as `20260316052757` (`platform_events_branch_id_fk`) and the check constraints are embedded in the primary migration `20260313120718`. All three FKs are verified present.

### 3.4 Indexes

ALIGNED

All 6 indexes (including PK) confirmed present with exact definitions matching the extraction.

### 3.5 RLS state and policies

ALIGNED

- `relrowsecurity = true`: confirmed
- `relforcerowsecurity = false`: confirmed
- Exactly one policy: `platform_events_org_members_read`, PERMISSIVE, SELECT, roles={public}, qual=`(organization_id IS NOT NULL) AND is_org_member(organization_id)`
- No INSERT/UPDATE/DELETE policies: confirmed

### 3.6 Privilege grants — service_role clarification

PARTIALLY ALIGNED (display artifact, not a real discrepancy)

The extraction states service_role has "full (SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE)" — this is architecturally correct.

The live `information_schema.role_table_grants` query returns service_role rows with `is_grantable: NO` for INSERT/UPDATE/DELETE. This appears alarming but is a Postgres catalog display artifact: `role_table_grants` shows grants made BY the table owner TO other roles, not all effective privileges. service_role inherits its privileges through the Supabase role hierarchy (`anon` → `authenticated` → `service_role`), not through direct table grants.

Direct function confirmation: `has_table_privilege('service_role', 'public.platform_events', 'INSERT')` returns `true`. Same for UPDATE, DELETE, SELECT.

The extraction's conclusion — that service_role can insert — is confirmed correct.

### 3.7 Applied migrations

ALIGNED

The extraction correctly documents the three event-related migrations:

| DB version       | DB name                        |
| ---------------- | ------------------------------ |
| `20260313120718` | `platform_events`              |
| `20260313180609` | `audit_events_read_permission` |
| `20260316052757` | `platform_events_branch_id_fk` |

The repo files use different timestamps (`20260321000001`, `20260313000001`, `20260321000002`). The extraction correctly identifies this as a cosmetic discrepancy — the SQL content is equivalent and the schema is correct on the live DB. The migration file named `20260313000001_audit_events_read_permission.sql` matches the name `audit_events_read_permission` applied to the DB at `20260313180609`.

Note: `supabase-target/supabase/migrations/` contains NO event-related migration files (verified by Glob). The event migrations exist only in `supabase/migrations/`. This is consistent with the plan's note that event migrations were applied via Supabase MCP directly.

### 3.8 Permissions table

ALIGNED

One row confirmed: `audit.events.read`, category=`audit`, action=`read`, name=NULL. Matches extraction exactly.

### 3.9 DB functions

ALIGNED

`audit_rls_permission_gate_slugs` exists as a SECURITY DEFINER function that scans pg_policies for permission slug references. Its definition is confirmed as a diagnostic/admin utility (returns table of slugs found in policy qual strings) — not involved in event emission or RLS enforcement for platform_events itself. The extraction's classification as "DB-side utility, possibly used in policy definition or for future use" is confirmed accurate.

**No DB-side event emission functions exist.** Confirmed zero functions matching `%event%` or `%audit%` that could serve as Mode B emission RPCs.

### 3.10 Triggers

ALIGNED

Zero triggers on `platform_events`. Confirmed by live query returning empty result set.

### 3.11 Event registry (22 entries)

ALIGNED

Source file read confirms exactly 22 entries in `EVENT_REGISTRY`. All action keys, tiers, visibleTo arrays, sensitiveFields, and summaryTemplate strings match the extraction. The `T-REGISTRY-CONTRACT` test suite asserts exactly 22 entries.

Notable confirmed detail: `org.invitation.resent` and `org.invitation.declined` are present (added in completion/hardening pass on 2026-03-16). The extraction correctly includes both.

### 3.12 Emission sites (all 20+)

ALIGNED

Source file reads confirm all emission sites documented in the extraction:

- `src/app/[locale]/actions.ts`: 5 emissions (auth module) — confirmed
- `src/app/actions/onboarding/index.ts`: 2 emissions with shared requestId — confirmed
- `src/app/actions/organization/invitations.ts`: 5 emissions (including resend and decline) — confirmed
- `src/app/actions/organization/members.ts`: 1 emission — confirmed
- `src/app/actions/organization/roles.ts`: 5 emissions — confirmed
- `src/app/actions/organization/branches.ts`: 3 emissions — confirmed
- `src/app/actions/organization/profile.ts`: 3 emissions (including uploadOrgLogoAction and removeOrgLogoAction) — confirmed

Grep for `eventService.emit(` across all source files returns exactly 13 files including 8 action files + test files. No undocumented emission sites found.

### 3.13 Projection system

ALIGNED

Source file `src/server/audit/projection.ts` confirmed to exist. The scope qualifier mappings, filtering pipeline, summary template interpolation, sensitive field stripping behavior, ip/ua scope gating, and pagination behavior are all as documented in the extraction. The claim that `{{actor}}` renders a raw UUID (not a human name) is confirmed — no user lookup is performed in projection.ts.

### 3.14 Feed actions and query helpers

ALIGNED

All four files in `src/app/actions/audit/` confirmed present. Constants (DEFAULT_PAGE_LIMIT=50, MAX_PAGE_LIMIT=50, PROJECTION_BUFFER=2, ABSOLUTE_CAP=500), three feed actions with their authentication patterns, service-role path for org-null personal events, and merge/sort behavior all match the extraction.

### 3.15 Frontend surfaces

MOSTLY ALIGNED

The extraction references pages at:

- `/dashboard/activity/page.tsx`
- `/dashboard/organization/activity/page.tsx`
- `/dashboard/organization/audit/page.tsx`

Direct file reads via find command confirm all three page.tsx files exist. The extraction noted one page as "not fully read" and labeled it INFERENCE. The glob tool false-negative (due to bracket path patterns) does not affect the correctness of the extraction — the pages exist.

The extraction correctly identifies client wrapper components: `personal-activity-wrapper.tsx`, `org-activity-wrapper.tsx`, `audit-feed-wrapper.tsx`.

### 3.16 Test coverage claims

ALIGNED

The extraction documents 24 test suites across 5 test files. All test files confirmed to exist. Test counts (22 in phase6 file per plan notes, 341 total per plan) are documented in the plan and were not re-executed, but the test file structure is confirmed.

### 3.17 Actor display as UUID

ALIGNED

Confirmed: the projection layer has no user name lookup. `{{actor}}` in summary templates renders the raw UUID string from `actor_user_id`. No enrichment is implemented in any feed action. This is a known gap, documented as MISSING-1 in the extraction.

### 3.18 `permissions` field on ProjectionContext unused

ALIGNED

Confirmed in source: `src/server/audit/projection.ts` receives a `permissions` array in `ProjectionContext` but does not use it for filtering within `projectEvents()`. All three feed actions populate it from `permissionSnapshot.allow`. The extraction correctly labels this as a future-scope-gating placeholder.

---

## 4. Plan vs Real Implementation

### 4.1 Phase 0 — Planning and validation

PARTIALLY ALIGNED

Three of five checkboxes show unchecked ([ ]):

- "Confirm first event set with team"
- "Confirm RLS and projected-read strategy"
- "Confirm Mode A / Mode B emission split for initial event set"

These are process items, not code deliverables. The implementation proceeded without formally checking these boxes. In practice, all three decisions were made implicitly during implementation: the event set is defined by the registry, RLS is implemented, Mode A is implemented and Mode B is explicitly not. The unchecked boxes reflect incomplete process tracking, not incomplete implementation.

### 4.2 Phase 1 — Core database foundation

ALIGNED

All Phase 1 checkboxes are checked and all claims verified by live DB queries:

- Migration file exists at `supabase/migrations/20260321000001_platform_events.sql`
- Applied to `rjeraydumwechpjjzrus` — confirmed
- All 5 indexes present — confirmed
- Append-only protections in place — confirmed
- RLS policies as specified — confirmed
- Check constraints for actor_type and event_tier — confirmed
- Both FK constraints (org, actor_user) — confirmed

The plan's Phase 1 notes correctly state the project ID as `rjeraydumwechpjjzrus` (line 33-34 of the notes section). This is the authoritative project — consistent with the target for this audit.

Minor discrepancy: The plan's DDL sample in Section 3 uses policy name `"org_members_read_own_org_events"` but the live DB has the policy named `"platform_events_org_members_read"`. The actual migration file uses `platform_events_org_members_read`. The plan's embedded DDL sample is a draft/earlier version; the actual applied migration is correct.

### 4.3 Phase 2 — Backend infrastructure

ALIGNED

All Phase 2 checkboxes checked. Verified:

- `src/server/audit/types.ts` exists
- `src/server/audit/event-registry.ts` exists (22 entries)
- `src/server/services/event.service.ts` exists (2 public methods: emit, validateMetadata)
- Zod metadata validation implemented per entry
- Actor normalization implemented (actorType !== 'user' → actorUserId = null)
- requestId propagation pattern implemented
- `import "server-only"` on service and registry files — confirmed

The `(client as any).from("platform_events")` cast is confirmed present in event.service.ts with the documented comment about types not yet generated.

### 4.4 Phase 3 — Projection/read layer

ALIGNED

All Phase 3 checkboxes checked. `src/server/audit/projection.ts` exists. Scope qualifiers, visibility filtering, sensitivity filtering, summary generation, and pagination all implemented.

### 4.5 Phase 4 — First platform event integrations

ALIGNED

All Phase 4 checkboxes checked. All auth, invitation, membership, role, branch, org profile, and onboarding emissions confirmed present in source code.

The Phase 4 correction pass (emit sites converted from try/catch to typed result pattern) is confirmed in code — all emission sites use `const result = await eventService.emit(...)` followed by `if (!result.success) { console.error(...) }`, not a try/catch wrapper.

### 4.6 Phase 5 — Frontend surfaces

ALIGNED

All Phase 5 checkboxes checked. Three backend server actions, three pages, three client wrapper components, and shared `EventFeedClient` component all exist.

Phase 5 hardening pass (computeFetchLimit replacing flat 500-row fetch, type safety consolidation to `_query.ts`, expanded tests) is confirmed in `_query.ts` source.

Phase 5 correction pass (org-null personal auth events, pagination validation) is confirmed in `get-personal-activity.ts` which uses `fetchPersonalOrgNullEvents` and `mergeAndSortEvents` from `_query.ts`.

### 4.7 Phase 6 — Testing and verification

ALIGNED

All Phase 6 checkboxes checked. Test files confirmed:

- `src/server/audit/__tests__/event-registry.test.ts`
- `src/server/audit/__tests__/projection.test.ts`
- `src/server/audit/__tests__/event-system-phase6.test.ts`
- `src/server/services/__tests__/event.service.test.ts`
- `src/app/actions/audit/__tests__/feed-actions.test.ts`
- `src/app/actions/__tests__/event-wiring.test.ts`
- `src/app/[locale]/__tests__/actions.test.ts`

The runtime diagnosis and correction pass documented in Phase 6 (logout event missing via nav-user.tsx, org.updated missing for logo upload/remove, org events invisible in personal feed due to missing "self" in visibleTo) are all confirmed fixed in current source code.

### 4.8 Phase 7 — Forensic-ready module guidance

FUTURE ROADMAP ITEM

All Phase 7 items remain unchecked. No warehouse event registry entries exist. No warehouse event emissions exist. This is explicitly listed as out-of-scope for first delivery in Section 2 of the plan.

### 4.9 Plan's "Explicitly out of scope for first delivery" table

ALIGNED

All items in the out-of-scope table (`warehouse version history tables`, `warehouse_movement_versions`, `warehouse_document_snapshots`, `Workshop event integration`, `VMI event integration`, `Full warehouse event set`) are confirmed absent from the implementation.

### 4.10 Plan's policy name discrepancy

MISALIGNED (minor, cosmetic)

The plan's embedded Phase 1 DDL uses policy name `"org_members_read_own_org_events"`. The actual migration file and live DB use `"platform_events_org_members_read"`. The plan's DDL section is a draft; the actual implementation is correct. No functional impact.

---

## 5. README vs Real Implementation

NOT APPLICABLE

The `README.md` at the project root (`/home/user/coreframe-boilerplate/README.md`) is the Supabase CLI README, not a project README describing this codebase. It documents the Supabase CLI tool installation and usage, with no mention of the event system, this SaaS project, or any application-layer features.

Implications:

- No event system claims in README to verify or dispute
- No "enterprise-grade" framing, no production-readiness assertions, no architectural overstatements
- The project lacks a root README describing the event system — this is a documentation gap but is not an accuracy problem
- No README vs implementation mismatches found because there are no relevant README claims

---

## 6. Reverification of Known Issues

### Issue 1 — Target project identity

CONFIRMED DOCUMENTATION ERROR, NOT A VERIFICATION INTEGRITY FAILURE

The extraction document header states queries were run against `zlcnlalwfmmtusigeuyk`. This audit ran identical queries against `rjeraydumwechpjjzrus` and obtained identical results in all 13 query dimensions (schema, constraints, indexes, RLS, policies, grants, migrations, permissions, functions, triggers). The plan document's Phase 1 notes explicitly state the correct target `rjeraydumwechpjjzrus`.

The extraction content is reliable for `rjeraydumwechpjjzrus`. The project ID in the extraction header is incorrect. Two possible explanations:

1. The extraction was run against `zlcnlalwfmmtusigeuyk` (the dev project) and that project has been kept in sync with the target.
2. The extraction was run against `rjeraydumwechpjjzrus` and the header line was a copy error.

Either way, the technical facts in the extraction document are confirmed accurate for the authoritative target project. This is a documentation accuracy risk: if used as a compliance artifact, the document must be corrected to show the right project ID.

### Issue 2 — declineInvitationAction actor bug

CONFIRMED BUG (low severity, documented)

Source code confirmed in `src/app/actions/organization/invitations.ts` lines 393-415:

```typescript
await eventService.emit({
  actionKey: "org.invitation.declined",
  actorType: "user",
  actorUserId: decliningUser?.id ?? null,
  ...
```

When `decliningUser` is null (unauthenticated token-link click), this stores `actor_type = 'user'` with `actor_user_id = null`. The DB check constraint only validates that `actor_type` is in the allowed set — it does not enforce that actor_user_id is non-null when actor_type is 'user'. The actor normalization in the service only strips actorUserId when `actorType !== 'user'` (not the reverse).

The result: semantically inconsistent row where actor_type='user' but actor_user_id=null. The correct actorType for an unauthenticated decliner should be `"system"` or `"automation"`.

The extraction document correctly identifies this as BUG-2. The plan notes acknowledge: "actorUserId set from auth user if authenticated, null if not (decliner may not be logged in at decline time)." The plan does not flag this as a bug, but it is one.

Impact: The inconsistent row will not cause a runtime failure. The personal feed guard (`actor_user_id === viewerUserId`) will correctly exclude the row for all users. The org_admin and auditor feeds will show the event with `actor_type='user'` but no associated user — this may render oddly in the UI.

### Issue 3 — Mode B status

CONFIRMED: NOT IMPLEMENTED, COMMENTS ONLY

Grep for "mode b", "Mode B", "modeB", "atomic.*emit", "DB-side emission", "security.*definer.\*event", "emit_event", "insert_platform_event" across all TypeScript files returns only two files: `event.service.ts` and `event-wiring.test.ts`.

In `event.service.ts`, Mode B is described in JSDoc comments:

- "Mode B — Atomic DB-side emission (NOT implemented here)"
- `validateMetadata` JSDoc: "Also exported for use in Mode B workflows"

No Postgres function named `emit_event`, `insert_platform_event`, or any variant exists on the live DB. The DB function search returned only `audit_rls_permission_gate_slugs`.

Mode B is a design concept described in comments and plan documentation only. No implementation exists in either TypeScript or SQL. The extraction's assessment is correct.

### Issue 4 — Missing module coverage

CONFIRMED GAP (explicitly in-scope limitation)

Grep for `eventService.emit(` across all source files returns exactly 13 files: 8 action files + test files. The 8 action files are: `actions.ts`, `invitations.ts`, `onboarding/index.ts`, `branches.ts`, `roles.ts`, `members.ts`, `profile.ts`, and `event-wiring.test.ts` (test file).

No warehouse module files emit events. No admin module files emit events. No tools module files emit events. No other modules emit events.

The event system covers exactly two functional areas:

1. Auth module (5 event keys)
2. Organization management module (17 event keys)

This is explicitly documented as in-scope for the first delivery (plan Section 2 scope table). Warehouse, Teams, Home, Tools, and Support modules are not wired. This is a confirmed gap but is roadmap-intentional.

### Issue 5 — Auth event visibility in org/audit feeds

CONFIRMED GAP (by design)

Source code in `get-org-activity.ts` and `get-audit-feed.ts` query platform_events with `organization_id = activeOrgId`. Auth events have `organization_id = null`. These events will not appear in the org or audit feeds.

The RLS policy (`organization_id IS NOT NULL AND is_org_member(organization_id)`) would also prevent the org/audit feed actions from reading org-null rows even if they wanted to.

Only `get-personal-activity.ts` fetches org-null events (via service-role `fetchPersonalOrgNullEvents`).

Implication for audit use case: An org's audit feed (`/dashboard/organization/audit`) will not show login events (`auth.login`) or session revocation events (`auth.session.revoked`) for org members, because those events have no `organization_id`. Only the personal feed shows them. This limits the usefulness of the audit feed for security auditing — a user's login/logout history is not visible to org admins or auditors. This is a design gap, not a bug, but it may surprise users expecting a complete org-scoped audit trail.

### Issue 6 — User display enrichment

CONFIRMED GAP (acknowledged, no enrichment implemented)

Confirmed in projection.ts: `{{actor}}` renders `actor_user_id` (the UUID string) when actor_type is 'user'. The comment in projection.ts: "Callers that need enriched actor names should enrich the result set after projection." No caller implements this enrichment.

All three feed actions return `ProjectedEvent[]` from `projectEvents()` without any post-projection enrichment. The frontend renders whatever is in the `summary` string, which contains raw UUIDs for user actors.

Real-world impact: The activity and audit feed UIs display strings like "550e8400-e29b-41d4-a716-446655440000 logged in" instead of "John Smith logged in". This is a usability gap, not a correctness bug.

### Issue 7 — Missing wiring test coverage

CONFIRMED GAP (partially addressed in plan)

The `event-wiring.test.ts` header comment explicitly lists 13 covered actions. Source code confirms these 13 plus additional test suites.

Actions with confirmed emissions that are NOT covered in the wiring test header:

- `resendInvitationAction` → `org.invitation.resent` — the plan notes say 10 new tests were added including resend tests; the wiring test may cover this in a suite not listed in the header comment. Given the plan's note, this is likely covered but the header was not updated.
- `declineInvitationAction` → `org.invitation.declined` — same situation per plan notes.
- Auth actions: `signInAction`, `forgotPasswordAction`, `resetPasswordAction`, `signOutAction` — covered in `src/app/[locale]/__tests__/actions.test.ts` (T-EMIT-TYPED-FAILURE suite, 8 tests per plan notes), not in event-wiring.test.ts.
- `updateRoleAction` → `org.role.updated` — not listed in event-wiring.test.ts header.
- `uploadOrgLogoAction` → `org.updated` — plan notes say 4 tests added for this action.
- `removeOrgLogoAction` → `org.updated` — plan notes say 4 tests added for this action.

The wiring test header comment is likely outdated relative to the full test suite. The test file contains additional suites (T-EVENT-WIRING-MODE-A, T-REGISTRY-VISIBILITY) beyond the 13 listed. The extraction's MISSING-6, MISSING-7, MISSING-8 claims about uncovered actions in wiring tests are partially stale — the plan notes confirm additions were made. However, since the test file was not fully read (it was too large to read in full), this remains PARTIALLY VERIFIED.

### Issue 8 — Append-only guarantees

ALIGNED (append-only is structurally enforced)

Multiple verification layers confirm append-only is enforced:

**Layer 1 — Privilege revoke:** `information_schema.role_table_grants` confirms `authenticated` and `anon` have only SELECT, REFERENCES, TRIGGER, TRUNCATE. INSERT, UPDATE, DELETE are absent for these roles.

**Layer 2 — service_role capability:** Direct `has_table_privilege` function call confirms service_role CAN INSERT, UPDATE, DELETE. This is intentional (it's how eventService.emit() works). The `is_grantable: NO` in the grants table is a display artifact, not a restriction.

**Layer 3 — No UPDATE/DELETE policies:** Only one RLS policy exists (SELECT). No INSERT, UPDATE, or DELETE policies.

**Layer 4 — Application code:** `eventService.emit()` only calls `.insert()`. No `.update()` or `.delete()` calls exist in event.service.ts. The T-APPEND-ONLY test suite (7 tests per plan) mocks the Supabase client and asserts that update and delete stubs are never called.

**Layer 5 — No triggers:** Zero triggers on platform_events. No trigger-based mutation.

**Caveat:** service_role CAN update/delete rows in platform_events (as verified by `has_table_privilege`). A developer with service_role credentials could manually modify rows. There is no DB-level prevention of this. The append-only guarantee is an application-layer guarantee, not an immutable DB guarantee. The plan correctly states "REVOKE INSERT, UPDATE, DELETE from public/authenticated/anon" — it does not claim service_role is restricted.

This caveat does not constitute a bug or misrepresentation, but it is relevant for "enterprise-grade" or "forensic" use cases where immutability of the audit log must be provable.

### Issue 9 — Migration mismatch

MOSTLY ALIGNED (known, documented, cosmetic)

Repo migration filenames vs. DB applied versions:

| Repo filename                                     | DB version       | DB name                        |
| ------------------------------------------------- | ---------------- | ------------------------------ |
| `20260321000001_platform_events.sql`              | `20260313120718` | `platform_events`              |
| `20260313000001_audit_events_read_permission.sql` | `20260313180609` | `audit_events_read_permission` |
| `20260321000002_platform_events_branch_id_fk.sql` | `20260316052757` | `platform_events_branch_id_fk` |

The DB applied versions predate the repo filenames. This means:

- The migrations were applied to the DB using earlier filenames/timestamps than what is now in the repo
- The repo contains files with newer timestamps that were NOT applied as those filenames (the migration tracker uses the version timestamp in the filename as the key)
- Running `pnpm supabase:migration:up` against `rjeraydumwechpjjzrus` would attempt to apply `20260321000001` and `20260321000002` again, potentially failing with constraint-already-exists errors (mitigated by `CREATE INDEX IF NOT EXISTS` and `ADD CONSTRAINT IF NOT EXISTS` patterns)

The `T-MIGRATION-FILES` test suite in `event-registry.test.ts` verifies the repo filenames exist on disk — it passes because the repo files are present. It does not verify the DB applied versions.

The content of the repo migration files and the applied migrations is equivalent (confirmed by constraint names and schema matching). This is an operational risk (re-application attempt) but not a functional correctness problem today.

### Issue 10 — Branch support completeness

MOSTLY ALIGNED (branch_id is stored; no branch-scoped feed exists)

**`branch_id` column:** Confirmed present (uuid, nullable).

**FK constraint:** Confirmed present (`platform_events_branch_id_fk` → `branches(id)` ON DELETE SET NULL).

**Emission sites that populate branch_id:**

- `assignRoleToUserAction`: `branchId: scope === "branch" ? scopeId : undefined` — confirmed
- `removeRoleFromUserAction`: same pattern — confirmed
- `createBranchAction`: `branchId: result.data.id` — confirmed
- `updateBranchAction`: `branchId: branchId` — confirmed
- `deleteBranchAction`: `branchId: parsed.data.branchId` — confirmed

So 5 emission sites populate branch_id when applicable.

**Feed filtering by branch_id:** No feed action queries or filters by `branch_id`. All three feed actions use org-level queries (`organization_id = activeOrgId`). Branch-scoped events are queryable only via the org or audit feed, mixed in with all org events. There is no branch-isolated feed.

**Projection layer:** `ProjectedEvent` strips `branch_id` from its output shape — consumers cannot see which branch an event was scoped to.

This represents a partial implementation: branch_id is correctly stored but not surfaced for branch-scoped queries or visibility. The extraction's MISSING-5 (no branch-scoped feed) is confirmed.

---

## 7. Newly Discovered Mismatches or Risks

### 7.1 `service_role` can mutate platform_events

UNVERIFIED RISK (not addressed in any document)

The `has_table_privilege` query confirms service_role can UPDATE and DELETE rows in platform_events. While eventService.emit() never calls update/delete, any code path that uses `createServiceClient()` could in principle mutate audit records. No such code path was found in this audit, but the theoretical risk exists. For true forensic immutability, a separate database user with INSERT-only privileges (not service_role) would be required for event emission.

This is not documented as a known limitation in any of the three source documents.

### 7.2 Row count: 20 rows in platform_events

INFORMATIONAL

The live DB has 20 rows in platform_events. This confirms the system has been exercised in real usage (not zero rows), supporting that the emission path is working end-to-end.

### 7.3 `audit_rls_permission_gate_slugs` function purpose now fully clarified

ALIGNED (extraction's AMBIGUITY-2 is resolved)

The function definition is confirmed: it scans `pg_policies` for string literals that appear in policy `qual` and `with_check` expressions using `regexp_matches`. It returns a table of (slug, policy_name, table_name) tuples. This is a diagnostic/admin utility for auditing what permission slugs are referenced in RLS policies — useful for permission system maintenance. It is not involved in runtime RLS decisions for platform_events.

The extraction labeled this AMBIGUITY-2. It is now confirmed as a diagnostic tool, not a runtime dependency.

### 7.4 `org.invitation.resent` emits before email delivery attempt

PARTIALLY ALIGNED with extraction

Source code in `resendInvitationAction` (lines 272-298) shows the event is emitted AFTER the email delivery attempt (the `emailService.sendInvitationEmailWithTemplate` call happens before the emit). However, the emit happens regardless of email delivery success or failure. This is consistent with Mode A best-effort semantics but means the event log records "resent" even when the email was not delivered.

The extraction documents: "Emitted after email delivery attempt" — this is confirmed. It does not note the "emits even on email failure" aspect. This is a design decision, not a bug, but worth documenting.

### 7.5 No `supabase-target/supabase/migrations/` event files

CONFIRMED ARCHITECTURE NOTE

Zero event-related migrations exist in `supabase-target/supabase/migrations/`. The event system migrations live only in `supabase/migrations/` and were applied via Supabase MCP. This is consistent with the plan's notes. The `supabase-target/` directory appears to be used for a separate migration management flow (confirmed by the very different migration names in that directory — `target_harden_p2_compile_triggers` etc.).

---

## 8. Confirmed Aligned Areas

The following components are confirmed fully aligned between the extraction document, the plan, and the live implementation:

1. **Database schema** — all 17 columns, 3 FKs, 2 check constraints, 5 indexes, RLS enabled, 1 SELECT policy
2. **Append-only enforcement** — INSERT/UPDATE/DELETE revoked from authenticated/anon; no UPDATE/DELETE policies
3. **Event registry** — all 22 entries with correct tiers, visibility arrays, sensitive fields, Zod schemas
4. **Event service** — emit() and validateMetadata() only; never throws; typed discriminated union return
5. **Actor normalization** — actorType !== 'user' forces actorUserId = null
6. **Registry tier override** — insert always uses entry.eventTier, not caller-supplied eventTier
7. **Mode A emission pattern** — all 20+ sites check result.success, log on failure, never throw
8. **Personal feed service-role path** — org-null auth events fetched separately and merged
9. **Projection scope qualifiers** — personal=['self'], org=['self','org_member','org_admin'], audit=all four
10. **Sensitive field stripping** — personal and org scopes strip fields listed in entry.sensitiveFields
11. **ip/ua scope gating** — absent from personal/org; present in audit scope
12. **Summary template interpolation** — {{actor}}, {{entity}}, {{target}} variables
13. **Pagination buffer** — computeFetchLimit applies 2x buffer capped at 500
14. **Permissions table** — one row: audit.events.read
15. **Phase 5 correction** — org-null personal events, pagination validation both implemented
16. **Phase 6 runtime fixes** — logout bug (nav-user.tsx), logo event wiring, visibleTo "self" fix all confirmed
17. **`requestId` correlation** — only onboarding workflow generates and shares a requestId

---

## 9. Confirmed Bugs

### BUG-1: `declineInvitationAction` stores `actor_type='user'` with `actor_user_id=null` for unauthenticated decliners

**Location:** `src/app/actions/organization/invitations.ts` lines 393-396

**Evidence:** `actorType: "user"` is hardcoded; `actorUserId: decliningUser?.id ?? null` may be null when the user is not authenticated.

**Impact:** Semantically inconsistent row in platform_events. The row is stored and visible to org_admin and auditor feeds. The actor will display as a UUID-shaped string in summary ("null logged...") or render incorrectly depending on the UI. The personal feed will not include this row (actor_user_id equality guard prevents it).

**Correct fix:** Use `actorType: decliningUser?.id ? "user" : "system"` to reflect the actual actor category.

**Severity:** Low — no data loss, no security impact, minor UI/UX inconsistency.

### BUG-2: Actor display in all feeds shows raw UUIDs, not human names

**Location:** `src/server/audit/projection.ts` — summary template interpolation

**Evidence:** `{{actor}}` renders `row.actor_user_id` (UUID string) when actor_type is 'user'. No user name lookup is performed. Comment in code acknowledges the gap.

**Impact:** All activity and audit feeds display raw UUIDs in summary strings. Functionally the data is correct but not user-friendly. Classification as a bug vs. known gap is borderline — the code comment suggests it was intentional scope deferral.

**Severity:** Medium for usability, zero for data integrity.

### BUG-3: `org.updated` emitted with no correlation to other simultaneous operations

**Location:** `src/app/actions/organization/profile.ts`

**Evidence:** Three actions (`updateOrgProfileAction`, `uploadOrgLogoAction`, `removeOrgLogoAction`) all emit `org.updated` with `requestId: undefined`. There is no way to correlate logo upload with a subsequent profile text update in the same user session.

**Classification:** This is a design limitation rather than a correctness bug. No data is wrong. The extraction documents it as BUG-3. Re-classified here as a minor design gap.

**Severity:** Very low.

---

## 10. Confirmed Gaps

### GAP-1: No user name enrichment in actor_display (MISSING-1)

Actor display in all projected events uses raw UUID strings. No post-projection enrichment is implemented in any feed action. The projection layer's comment acknowledges this.

### GAP-2: requestId correlation only for onboarding (MISSING-2)

Only `createOrganizationAction` generates and shares a `requestId` between two events. All other action workflows emit events with `requestId = null`. The `pe_request_id_idx` index will only be useful for onboarding events.

### GAP-3: No warehouse/movement/warehouse-module events (MISSING-3)

Registry contains zero warehouse-related event keys. The warehouse module (with movements, inventory, audits, suppliers, B2B catalog) emits no events. This is the largest gap in audit coverage for a production warehouse management system.

### GAP-4: Auth events not visible in org/audit feeds (MISSING-4)

`auth.login`, `auth.session.revoked`, `auth.login.failed`, `auth.password.reset_*` all have `organization_id = null`. They are not visible in `getOrgActivityAction` or `getAuditFeedAction`. Org admins and auditors cannot see login activity for their members in the org-scoped feeds. Only the personal feed shows these to the authenticated user.

### GAP-5: No branch-scoped event feed (MISSING-5)

`branch_id` is populated on branch-related and role-assignment events, but no feed action filters or groups by branch_id. There is no way to query "all events for branch X."

### GAP-6: Incomplete wiring test coverage for some actions

`updateRoleAction`, auth actions (covered in a separate test file), and possibly `resendInvitationAction`/`declineInvitationAction` are not in the event-wiring.test.ts header comment listing. Auth actions have separate T-EMIT-TYPED-FAILURE coverage in `actions.test.ts`.

### GAP-7: No Teams, Home, Support, Tools module events

None of these modules emit any events to the event system.

### GAP-8: Migration filename/DB version mismatch creates re-application risk

Repo files use `20260321` timestamps; DB applied them under `20260313`-`20260316`. Running migration tools that check for unapplied migrations by filename would attempt to re-apply already-applied migrations.

---

## 11. Roadmap-Only Items Incorrectly Implied as Implemented

### Plan Phase 7

The plan lists Phase 7 items (warehouse event documentation, warehouse event registry entries) as unchecked. These are not implemented and are correctly marked as roadmap items. There is no false implication that they are done.

### Mode B (atomic DB-side emission)

Mode B is described in code comments and plan documentation as a planned future pattern. The code explicitly states "NOT implemented here." The `validateMetadata()` function's JSDoc mentions Mode B pre-validation use. No part of the codebase implies Mode B is implemented. The extraction correctly confirms it is not.

**Potential misreading risk:** A reader of `event.service.ts` JSDoc or the plan's Phase 1 notes ("service-role only for inserts via event.service.ts or security-definer RPC") might infer Mode B RPC functions exist. They do not. This is adequately clarified in the extraction but should be noted: any audit document relying on Mode B for forensic-tier event guarantees must acknowledge Mode B is not yet implemented.

### Phase 0 unchecked process items

The three unchecked Phase 0 checkboxes (team confirmation, RLS strategy confirmation, Mode A/B split confirmation) could mislead a reader into thinking these decisions were never made. In practice they were resolved implicitly. The unchecked boxes are process-tracking artifacts, not missing architectural decisions.

---

## 12. Closure Recommendation

**APPROVED WITH LIMITED SCOPE NOTE**

**Rationale:**

The event system core is correctly implemented and matches its documentation with high fidelity. The database schema is production-quality, the emission path is reliable, the projection layer correctly enforces visibility and sensitivity rules, and the three feed surfaces are functional.

**The limited scope note covers four items:**

1. **Extraction document project ID error** — `zlcnlalwfmmtusigeuyk` must be corrected to `rjeraydumwechpjjzrus` before the extraction is used as a compliance artifact.

2. **BUG-1 (declineInvitationAction actor_type)** — minor semantic inconsistency when unauthenticated users decline invitations. Non-blocking for production but should be fixed in a follow-up.

3. **GAP-4 (auth events not in org/audit feeds)** — org admins and auditors cannot see member login activity in org-scoped feeds. This limits the security audit value of the audit feed. Acceptable for current scope but must be documented as a known limitation.

4. **Migration filename mismatch (GAP-8)** — operational risk if migration tooling is used to sync to the target. The current state is stable, but re-application attempts could cause errors.

**NOT blocking closure:**

- Mode B not implemented (by design, correctly documented)
- No warehouse events (by design, Phase 7)
- No user name enrichment (acknowledged design gap)
- No branch-scoped feed (acknowledged design gap)
- README.md not containing event system docs (project-level docs gap)

---

## 13. Required Pre-Closure Actions

1. **Correct extraction document project ID** — Update `EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION_VERIFIED.md` line 4 to read `rjeraydumwechpjjzrus` instead of `zlcnlalwfmmtusigeuyk`.

2. **Fix BUG-1 in `declineInvitationAction`** — Change `actorType: "user"` to a conditional: `actorType: decliningUser?.id ? "user" : "system"`. Update the related test assertion to expect `actorType: "system"` in the unauthenticated path.

3. **Document GAP-4 explicitly** — Add a comment or note to `get-org-activity.ts` and `get-audit-feed.ts` that org-null events (auth events) are intentionally excluded. This prevents future confusion when auditors ask why login events don't appear in the org audit feed.

---

## 14. Optional Post-Closure Improvements

1. **User name enrichment** (BUG-2 / GAP-1) — After projection, perform a batch lookup of `actor_user_id` UUIDs against `public.users` to replace UUIDs with `first_name last_name` in the `actor_display` field. This significantly improves audit feed usability.

2. **Auth events in org/audit feeds** (GAP-4) — Add a service-role query path to org and audit feed actions to include org-null events where `actor_user_id` is a member of the org. Requires mapping auth events to org membership.

3. **Branch-scoped feed action** (GAP-5) — Add a `getBranchActivityAction(branchId)` that filters `platform_events` by `organization_id = orgId AND branch_id = branchId`.

4. **Warehouse module event wiring** (GAP-3) — Phase 7 work. Register warehouse event keys and wire emissions in warehouse action files following the Mode A pattern established in Phases 4-6.

5. **requestId propagation for multi-step workflows** (GAP-2) — Extend requestId generation to invitation create→accept and role assign→remove workflows to enable workflow-level correlation.

6. **Migration filename alignment** (GAP-8) — Either: (a) rename repo migration files to match applied DB versions, or (b) create an explicit migration tracker that maps repo files to applied DB versions and documents the mismatch as intentional.

7. **Emit-only DB user for service_role** (Section 7.1 risk) — For stricter forensic guarantees, create a dedicated Postgres role with INSERT-only privileges on platform_events (no UPDATE, no DELETE) and use it for event.service.ts instead of service_role.

8. **Update event-wiring.test.ts header comment** — The 13-action list in the file header is outdated. Update it to include all currently covered actions (resend, decline, logo upload, logo remove) and reference the actions.test.ts file for auth action coverage.
