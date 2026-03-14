# Event System — Implementation Plan

> **Status:** Working Roadmap
> **Architecture source of truth:** [docs/event-system/README.md](./README.md)
> **Branch:** `event-system`
> **Last updated:** 2026-03-14

This document translates the canonical Event System architecture into a practical, phase-by-phase execution roadmap. The README remains the authoritative design reference. This plan defines implementation order, safety rules, and verification gates.

---

## Progress Tracker

### Phase 0 — Planning and validation

- [x] Review canonical architecture README
- [x] Confirm initial scope (core platform events, not deep forensic modules)
- [ ] Confirm first event set with team
- [ ] Confirm RLS and projected-read strategy
- [ ] Confirm Mode A / Mode B emission split for initial event set (see Section 6)

### Phase 1 — Core database foundation

- [x] Create `platform_events` migration file
- [x] Create required indexes migration (separate or combined)
- [x] Add append-only protections (`REVOKE INSERT, UPDATE, DELETE FROM public/authenticated/anon`)
- [x] Add RLS policies (org isolation, no INSERT/UPDATE/DELETE policies)
- [x] Validate raw DB access model (service-role only for inserts via event.service.ts or security-definer RPC)

**Notes (2026-03-21):**

- Migration file: `supabase/migrations/20260321000001_platform_events.sql`
- Applied to project `rjeraydumwechpjjzrus` via Supabase MCP — success
- Verified: `authenticated` and `anon` roles have only SELECT privilege; INSERT/UPDATE/DELETE absent
- Verified: `service_role` retains full privileges (bypasses RLS — correct for Mode A backend emission)
- Verified: all 5 named indexes present (`pe_org_created_idx`, `pe_actor_user_idx`, `pe_action_key_idx`, `pe_entity_idx`, `pe_request_id_idx`)
- Verified: RLS enabled, single SELECT-only policy `platform_events_org_members_read` — requires `organization_id IS NOT NULL AND is_org_member(organization_id)`
- Verified: both check constraints present — `actor_type` (6 values) and `event_tier` (3 values)
- Verified: both FK constraints present — `organization_id → organizations(id) ON DELETE SET NULL`, `actor_user_id → users(id) ON DELETE SET NULL`
- Confirmed: `organizations.id` and `users.id` are both `uuid NOT NULL` — FK chain is correct
- Confirmed: `is_org_member()` function exists in `public` schema
- No `summary`, `visibility`, or `sensitivity` columns present

### Phase 2 — Backend infrastructure

- [x] Create `src/server/audit/types.ts`
- [x] Create `src/server/audit/event-registry.ts` with initial entries
- [x] Create `src/server/services/event.service.ts`
- [x] Implement Zod metadata validation per action key
- [x] Implement actor normalization helper
- [x] Implement request_id propagation pattern
- [x] Verify central emission invariant (no direct table inserts)

**Notes (2026-03-21):**

- Service-role client used: `createServiceClient()` from `@supabase/service` (`src/utils/supabase/service.ts`) — matches existing codebase pattern
- `platform_events` not yet in generated DB types (migration applied after last type gen); used `client as any` for the `.from('platform_events')` call only — all application-level types remain strongly typed
- `import "server-only"` added to both `event-registry.ts` and `event.service.ts` — `types.ts` deliberately has no runtime guard so it can be imported for type-checking in tests
- `event_tier` in the insert always comes from the registry entry, never the caller-supplied `input.eventTier` — prevents callers from misusing tier classification
- Actor normalization: any `actorType !== 'user'` forces `actorUserId = null` before insert
- `validateMetadata()` exported separately for Mode B pre-validation use at action layer
- TS discriminated union narrowing note: `EventServiceResult<T>` across different `T` does not narrow cleanly with `if (!result.success)` in this TypeScript config; used `(result as { success: false; error: string })` cast pattern in service and tests (consistent with existing codebase convention — see MEMORY.md)
- `request_id` propagation: service accepts `requestId` as input, never generates it; generation is caller responsibility at workflow entry point
- Tests: 239 tests pass (24 event service, 215 registry contract); all type errors resolved
  - Test files: `src/server/audit/__tests__/event-registry.test.ts`, `src/server/services/__tests__/event.service.test.ts`
  - Test suites: `T-REGISTRY-CONTRACT`, `T-REGISTRY-LOOKUP`, `T-REGISTRY-SCHEMA`, `T-REGISTRY-COVERAGE`, `T-EVENT-SERVICE`, `T-EVENT-VALIDATE`, `T-EVENT-INVARIANT`

### Phase 3 — Projection/read layer

- [x] Create `src/server/audit/projection.ts`
- [x] Implement event visibility filtering (per registry)
- [x] Implement field sensitivity filtering (per registry)
- [x] Implement summary generation (template interpolation)
- [x] Implement pagination support (limit/offset or cursor) in all projection queries
- [x] Define and test personal activity projection
- [x] Define and test organization activity projection
- [x] Define and test admin/audit projection

**Notes (2026-03-21):**

- `projectEvents(input: ProjectionInput): ProjectionResult` — single entry point for all three scopes
- Scope qualifiers: `personal` → `['self']`, `org` → `['self','org_member','org_admin']`, `audit` → all four
- Personal scope applies additional actor guard: `event.actor_user_id === viewerUserId`
- Sensitive fields stripped for personal + org scopes; audit scope always receives full metadata
- `ip_address` / `user_agent` only included in result for audit scope; absent (not null) for personal/org
- Summary generated by `{{actor}}`, `{{entity}}`, `{{target}}` interpolation against `summaryTemplate`
- Unknown action keys: skipped with `console.warn` — no crash; allows registry gaps without service failure
- Pagination: default limit=50; `total` reflects filtered count before pagination
- Tests: 34 tests in `src/server/audit/__tests__/projection.test.ts`
  - Suites: `T-PROJECTION-VISIBILITY`, `T-PROJECTION-PERSONAL`, `T-PROJECTION-SENSITIVITY`,
    `T-PROJECTION-SUMMARY`, `T-PROJECTION-IPUA`, `T-PROJECTION-PAGINATION`, `T-PROJECTION-UNKNOWN`,
    `T-PROJECTION-SHAPE`

### Phase 4 — First platform event integrations

- [x] Auth events (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`)
- [x] Invitation events (`org.member.invited`, `org.invitation.cancelled`, `org.invitation.accepted`)
- [x] Membership events (`org.member.removed`, `org.member.role_assigned`, `org.member.role_removed`)
- [x] Organization events (`org.created`, `org.updated`, `org.branch.created`, `org.branch.updated`, `org.branch.deleted`)
- [x] Role/permission events (`org.role.created`, `org.role.deleted`, `org.member.role_assigned`, `org.member.role_removed`)
- [x] Onboarding events (`org.created`, `org.onboarding.completed`)

**Notes (2026-03-13):**

- All events emitted via `eventService.emit()` — no direct table inserts
- Emit happens AFTER successful domain write in all cases; emit failure is best-effort (logged, does not rollback)
- **Auth events** wired in `src/app/[locale]/actions.ts`:
  - `auth.login.failed` emitted before redirect on sign-in error
  - `auth.login` emitted before org/invite routing after successful sign-in
  - `auth.password.reset_requested` emitted in `forgotPasswordAction`
  - `auth.password.reset_completed` emitted after `updateUser()` succeeds; user fetched before `signOut()`
  - `auth.session.revoked` emitted in `signOutAction`; user fetched BEFORE `signOut()` to capture ID
  - All emits placed before `redirect()` calls (which throw exceptions in Next.js)
- **Org events** wired in `src/app/actions/organization/profile.ts`:
  - `org.updated` emitted with `updated_fields` computed from input keys
- **Invitation events** wired in `src/app/actions/organization/invitations.ts`:
  - `org.member.invited` emitted using `result.data.id` (invitation id) and `result.data.email`
  - `org.invitation.cancelled`: invitation email pre-fetched before cancel (service returns void)
  - `org.invitation.accepted`: user and invitation id fetched before `acceptInvitation()` call
- **Member events** wired in `src/app/actions/organization/members.ts`:
  - `org.member.removed` emitted with `removed_user_id`
- **Role events** wired in `src/app/actions/organization/roles.ts`:
  - `org.role.created`: uses `result.data.id` and `result.data.name`
  - `org.role.deleted`: role name pre-fetched before deletion (service returns void)
  - `org.member.role_assigned` / `org.member.role_removed`: role name pre-fetched before operation
  - IIFE pattern used in `updateRoleAction` for conditional name fetch
- **Branch events** wired in `src/app/actions/organization/branches.ts`:
  - `org.branch.created`, `org.branch.updated` (with `updated_fields`), `org.branch.deleted`
- **Onboarding events** wired in `src/app/actions/onboarding/index.ts`:
  - `org.created` and `org.onboarding.completed` share a `requestId` (single `crypto.randomUUID()`)
  - User fetched via `supabase.auth.getUser()` before RPC call
- **requestId propagation**: `org.created` + `org.onboarding.completed` share one UUID; single-event actions do not set `requestId`
- **Tests**: 26 tests in `src/app/actions/__tests__/event-wiring.test.ts`
  - Covers all wired action/event pairs + negative cases (no emit on failure)
  - Verifies `org.created` and `org.onboarding.completed` share the same non-null `requestId`
  - Metadata schema validation for 8 action keys via `validateMetadata()`
  - Uses `vi.hoisted()` for constants and mock helpers to avoid TDZ errors with hoisted `vi.mock()` factories

**Phase 4 correction pass applied (2026-03-13):**

- **Problem**: All `await eventService.emit()` calls were bare inside `if (result.success)` blocks. The outer `try/catch` in each action would convert an emit failure into `{ success: false, error: "Unexpected error" }`, incorrectly failing a successful domain operation. Auth actions had no outer try/catch — an emit throw would break the redirect flow.
- **Fix**: Every Mode A emit site is now wrapped in its own isolated `try/catch`. Domain write succeeds → business result is confirmed → emit is attempted → any emit failure is logged and swallowed, the action returns its original success result unchanged.
- **Logging**: Emit failures log with `console.error("[actionName] Failed to emit <actionKey>:", { actionKey, organizationId, actorUserId, entityType, entityId, error })`. Auth actions include `entityId` instead of org fields since those events have no org context.
- **requestId**: Onboarding `requestId` propagation is fully preserved. The two emits share a single try/catch block so one UUID covers both — if `org.created` emits but `org.onboarding.completed` throws, the catch handles the partial failure without failing the action.
- **Tests**: 7 Mode A resilience tests added in `T-EVENT-WIRING-MODE-A` suite (total 33 tests, all passing):
  - Covers: `removeMemberAction`, `createRoleAction`, `createBranchAction`, `updateOrgProfileAction`, `cancelInvitationAction`, `createOrganizationAction` — all return `success: true` when emit throws
  - Verifies `console.error` is called with structured context including `actionKey` and `error`
  - Verifies requestId propagation still correct when emits succeed normally

### Phase 5 — Frontend surfaces

- [x] Backend projected event API route / server action for My Activity (with pagination)
- [x] Backend projected event API route / server action for Organization Activity (with pagination)
- [x] Backend projected event API route / server action for Admin / Audit View (with pagination, `audit.events.read` gated)
- [x] My Activity UI page (paginated)
- [x] Organization Activity UI page (paginated)
- [x] Admin / Audit UI page (privileged, paginated)

**Notes (2026-03-13):**

- `audit.events.read` permission added via `supabase/migrations/20260313000001_audit_events_read_permission.sql`, applied to target project. Granted to `org_owner` by default.
- `AUDIT_EVENTS_READ` constant added to `src/lib/constants/permissions.ts`; `PermissionSlug` union and `ALL_PERMISSION_SLUGS` array updated.
- Three backend server actions under `src/app/actions/audit/`:
  - `get-personal-activity.ts` — personal scope; fetches events where `actor_user_id = current user`; no permission check beyond org membership
  - `get-org-activity.ts` — org scope; all org events; requires `org.read`
  - `get-audit-feed.ts` — audit scope; all org events with ip/ua; requires `audit.events.read`
  - All cap DB fetch at 500 rows (`MAX_FETCH`); pagination via `projectEvents` limit/offset
  - `platform_events` table queried via regular `createClient()` (RLS enforces org isolation)
- Shared client component `EventFeedClient` at `src/app/[locale]/dashboard/activity/_components/event-feed-client.tsx` — renders event list + pagination controls for all three scopes
- Pages use server component → client wrapper pattern (SSR initial load, client-side pagination via `useTransition`):
  - `src/app/[locale]/dashboard/activity/page.tsx` → `PersonalActivityWrapper`
  - `src/app/[locale]/dashboard/organization/activity/page.tsx` → `OrgActivityWrapper`
  - `src/app/[locale]/dashboard/organization/audit/page.tsx` → `AuditFeedWrapper`
- i18n routes added to `src/i18n/routing.ts`: `/dashboard/activity`, `/dashboard/organization/activity`, `/dashboard/organization/audit`
- Polish localized paths: `/dashboard/aktywnosc`, `/dashboard/organizacja/aktywnosc`, `/dashboard/organizacja/audyt`
- `activityFeed` namespace added to both `messages/en.json` and `messages/pl.json`
- Sidebar entries:
  - `activity` (top-level, no permission gate) → `/dashboard/activity`
  - `organization.activity` (under org section, requires `org.read`) → `/dashboard/organization/activity`
  - `organization.audit` (under org section, requires `audit.events.read`) → `/dashboard/organization/audit`
- **Tests**: 15 tests in `src/app/actions/audit/__tests__/feed-actions.test.ts`
  - Suites: `T-FEED-ACTIONS-PERSONAL` (5 tests), `T-FEED-ACTIONS-ORG` (4 tests), `T-FEED-ACTIONS-AUDIT` (6 tests)
  - Covers: happy path, empty result, DB error, missing org context, permission denial, pagination offset/limit

**Phase 5 hardening pass applied (2026-03-14):**

- **What was improved**: Query efficiency, type safety isolation, and test coverage for architectural boundary/security guarantees.
- **Why improved**: Review found the initial implementation always fetched a flat 500 rows regardless of page size, spread `as any` casts across three files, and lacked tests proving the projection layer strips raw row fields.
- **Query strategy changed**: Flat `MAX_FETCH=500` replaced with bounded fetch `(offset + limit) * 2` capped at 500 (`computeFetchLimit`). The 2x buffer absorbs projection filtering (e.g. auditor-only rows removed from org scope) without an unbounded window. Personal scope adds a SQL `actor_user_id` filter so projection waste is minimal. Audit scope projects all rows, making the buffer conservative. Documented in `src/app/actions/audit/_query.ts`.
- **Type safety tightened**: `as any` consolidated to one backend-only helper `_query.ts` — isolated following the `event.service.ts` pattern ("platform_events not yet in generated DB types"). All three action files import typed helpers; zero `as any` in callers.
- **Tests expanded**: 30 tests total (up from 15).
  - New suite: `T-FEED-QUERY-HELPER` (5 tests) — `computeFetchLimit` buffer, cap, minimum guarantees
  - New boundary/security tests per scope (marked `[BOUNDARY]`):
    - Personal: `ip_address` absent, `user_agent` absent, sensitive `email` stripped, output is `ProjectedEvent` not raw row
    - Org: `ip_address` absent, `user_agent` absent, auditor-only event not leaked, mixed visibility filtered correctly
    - Audit: sensitive metadata preserved, all visibility levels visible, ip/ua present, raw row fields absent
- **Feed architecture**: unchanged — server page → action → `fetchPlatformEvents` → `projectEvents` → client wrapper
- **Projection boundary**: unchanged — `PlatformEventRow` never crosses to frontend; only `ProjectedEvent[]` returned

**Phase 5 correction pass applied (2026-03-14):**

- **Org-null personal auth events**: Personal feed now includes two query sources merged before projection:
  1. Org-scoped: `organization_id = activeOrgId AND actor_user_id = userId` via authenticated RLS client (unchanged).
  2. Org-null: `organization_id IS NULL AND actor_user_id = userId` via service-role client. This path is necessary because the RLS policy on `platform_events` requires `organization_id IS NOT NULL`, so org-null rows (e.g. `auth.login`, `auth.login.failed`, `auth.session.revoked`) are inaccessible through the regular client. The service-role query is tightly restricted to the current user's actor_user_id — no other org-null data is exposed. The projection layer provides a second line of defence: the personal-scope actor guard (`actor_user_id === viewerUserId`) filters any row not belonging to the viewer.
  - Org-null query failure is non-fatal: logged as a warning, org-scoped rows are still returned.
  - Both result sets are merged by `mergeAndSortEvents()` (sorted by `created_at` desc) and passed to `projectEvents()` with `viewerScope: "personal"`.
  - New helpers in `_query.ts`: `fetchPersonalOrgNullEvents(userId, fetchLimit)`, `mergeAndSortEvents(a, b)`.
- **Server-side pagination validation**: All three feed actions now call `validatePagination(rawLimit, rawOffset)` before use. Policy: `limit` clamped to [1, 50], `offset` clamped to [0, ∞). Fractional values are floor-truncated. Prevents callers from requesting unbounded pages or negative offsets.
- **Tests expanded**: 46 tests total (up from 30).
  - New suite `T-FEED-PAGINATION-VALIDATION` (6 tests): covers negative offset, overlimit, undercount, fractional truncation.
  - Personal feed additions (8 new tests): org-null inclusion, merge sort order, other-user org-null not leaked (projection actor guard), service-client failure non-fatal, pagination clamping for personal action.
  - Org and audit feed additions (2 new tests each): pagination clamping confirmed.
  - Test mock extended: `mockServiceFromChain` / `mockServiceFromError` helpers added for `@supabase/service` mock.
- **Projection boundary**: unchanged — `projectEvents()` is still the only output path.

### Phase 6 — Testing and verification

- [x] Event service unit tests (emit, validation, actor normalization)
- [x] Registry contract tests (all registered events have valid schemas)
- [x] Projection unit tests (visibility, field filtering, summary generation)
- [x] Integration tests (emit → store → project → UI cycle)
- [x] Permission/visibility tests (viewer scope isolation)
- [x] Request correlation tests (multi-event workflows)
- [x] Transaction rollback consistency tests
- [x] Append-only enforcement tests (UPDATE/DELETE rejected)

**Notes (2026-03-14):**

- Test files: `event.service.test.ts` (24), `event-registry.test.ts` (215), `projection.test.ts` (34), `feed-actions.test.ts` (46), `event-system-phase6.test.ts` (22) — **341 tests total, all passing**
- Phase 6 test file: `src/server/audit/__tests__/event-system-phase6.test.ts`
- Suites: `T-INTEGRATION` (5), `T-REQUEST-CORRELATION` (5), `T-ROLLBACK-CONSISTENCY` (5), `T-APPEND-ONLY` (7)
- Build fix applied: removed `"use server"` from `src/app/actions/audit/_query.ts` (was blocking Turbopack — only async functions may be exported from "use server" files)
- Vitest alias added: `@supabase/service` → `src/utils/supabase/service.ts` (enables `vi.mock("@supabase/service")` in tests)

**Hardening pass (2026-03-14):**

- **Emission failure logging improved**: both `[event.emit.failure]` and `[event.emit.unexpected]` log payloads now include `organizationId`, `actorUserId`, `entityType`, `entityId`, `requestId` in addition to `actionKey` and `error` — full diagnostic context for production log search
- **Standardized log identifiers**: `[eventService.emit] DB insert failed` → `[event.emit.failure]`; `[eventService.emit] Unexpected error` → `[event.emit.unexpected]` — consistent, searchable, parseable in structured log systems
- **Logout event bug fixed**: `signOutAction` now guards emit behind `if (signingOutUser?.id)` — root cause: when `supabase.auth.getUser()` returns null (expired access token before middleware refresh), the event was stored with `actor_user_id = null`; `fetchPersonalOrgNullEvents` filters by `actor_user_id = userId` (equality, not IS NULL), so null-actor events were permanently invisible in personal feeds; the guard prevents storing unfindable events
- **Logout event tests added** (`T-LOGOUT-PIPELINE` suite, 10 tests): registry contract, metadata schema, emit insert payload, personal feed visibility, other-user isolation, audit scope fields, sensitive-field passthrough (no sensitive fields on `auth.session.revoked`), null-actor behaviour documentation, null-actor personal feed guard, and full emit→project cycle
- Updated test totals: `event-system-phase6.test.ts` now has 33 tests

**Hardening pass 2 (2026-03-14) — emit result-handling correction:**

- **Root problem**: all action-layer emit call sites used `try { await eventService.emit(...) } catch (emitError) { ... }`. `eventService.emit()` never throws — it catches all exceptions internally and returns a typed discriminated union `{ success: true, data } | { success: false, error }`. The outer `catch` was therefore dead code for typed failures: DB-level insert failures were invisible at the action layer (only logged inside the service).
- **Fix applied** (`src/app/[locale]/actions.ts`): all 5 emit call sites converted to typed result pattern — `const result = await eventService.emit({...}); if (!result.success) { console.error(..., { error: result.error }) }`. Mode A best-effort semantics preserved (business flow continues on failure).
- **Actions updated**: `signInAction` (auth.login.failed), `signInAction` (auth.login), `forgotPasswordAction` (auth.password.reset_requested), `resetPasswordAction` (auth.password.reset_completed), `signOutAction` (auth.session.revoked — already had null-actor guard, now also typed result).
- **Tests added** (`T-EMIT-TYPED-FAILURE` suite, 8 tests in `src/app/[locale]/__tests__/actions.test.ts`): `forgotPasswordAction` continues on typed failure; `forgotPasswordAction` logs typed error; `forgotPasswordAction` does not log on success; `signInAction` continues on typed failure (failed-login path); `signInAction` logs typed error string; `signOutAction` redirect still fires on typed failure; `signOutAction` logs typed error; `signOutAction` skips emit when `getUser` returns null (null-actor guard).

**Runtime diagnosis and correction pass (2026-03-14):**

Three classes of runtime bugs were identified and fixed. No DB migration was required — all fixes are code-only.

**Bug 1 — Logout events missing in personal feed (`nav-user.tsx`)**

- **Root cause**: `src/components/nav-user.tsx` (used in the main dashboard sidebar) called `supabase.auth.signOut()` directly from the client, bypassing `signOutAction` entirely. The server action that emits `auth.session.revoked` was never invoked on the most common logout path. `header-user-menu.tsx` and `DashboardHeader.tsx` were already correct.
- **Fix**: Removed the `createClient` / `handleLogout` click-handler pattern; replaced with `<form action={signOutAction}>` matching the pattern used in other nav components.

**Bug 2 — `org.updated` events missing (logo upload/remove paths)**

- **Root cause**: `uploadOrgLogoAction` and `removeOrgLogoAction` in `src/app/actions/organization/profile.ts` had no event emission at all — only `updateOrgProfileAction` was wired. Logo operations are a substantial subset of org profile changes.
- **Fix**: Added `eventService.emit({ actionKey: "org.updated", ..., metadata: { updated_fields: ["logo_url"] } })` with typed result logging after successful upload and after successful logo removal. Pattern is identical to `updateOrgProfileAction`.

**Bug 3 — All org events invisible in personal (`/dashboard/activity`) feed**

- **Root cause**: All 15 org-module events in `event-registry.ts` had `visibleTo` arrays that omitted `"self"`. The personal scope uses only the `["self"]` qualifier set (`SCOPE_QUALIFIERS.personal`). With no overlap, every org event was filtered out for the actor's own personal feed even when the actor had performed the action.
- **Fix**: Added `"self"` to `visibleTo` in all 15 org-module registry entries: `org.created`, `org.updated`, `org.member.invited`, `org.member.removed`, `org.invitation.accepted`, `org.invitation.cancelled`, `org.role.created`, `org.role.updated`, `org.role.deleted`, `org.member.role_assigned`, `org.member.role_removed`, `org.branch.created`, `org.branch.updated`, `org.branch.deleted`, `org.onboarding.completed`.
- **Scope preservation**: org scope and audit scope are unaffected — both already matched through `org_member`, `org_admin`, `auditor` qualifiers.

**Tests added:**

- `T-EVENT-WIRING: org.updated` suite (4 new tests in `src/app/actions/__tests__/event-wiring.test.ts`): `uploadOrgLogoAction` emits `org.updated` on success; `uploadOrgLogoAction` does not emit on upload failure; `removeOrgLogoAction` emits `org.updated` on success; `removeOrgLogoAction` does not emit on profile-update failure. Existing `updateOrgProfileAction` Mode A test updated: changed from `mockRejectedValue` to `mockResolvedValue({ success: false, error: "..." })` to match the typed result pattern (the action no longer has a try/catch around emit).
- `T-REGISTRY-VISIBILITY` suite (11 new tests in `src/app/actions/__tests__/event-wiring.test.ts`): all 15 org event keys have `"self"` in `visibleTo`; personal scope shows actor-owned `org.updated`; personal scope hides `org.updated` for a different actor; personal scope shows actor-owned `org.member.invited`; personal scope shows actor-owned `org.branch.created`; org scope shows `org.updated` for any viewer; org scope shows `org.created` for any viewer; audit scope shows all 3 test org events; audit scope preserves sensitive fields in metadata; personal scope strips sensitive fields from `org.member.invited` metadata; personal scope excludes `ip_address`/`user_agent`; audit scope includes `ip_address`/`user_agent`.
- `projection.test.ts` updated: the test that asserted `org.member.invited` was not visible in personal scope was corrected to use `auth.login.failed` (which genuinely has `visibleTo: ["auditor"]` only) to document the no-self case.

### Phase 7 — Forensic-ready module guidance

- [ ] Document warehouse event integration rules (wiring, not deep version history)
- [ ] Document version-history table boundary (what the event system is not responsible for)
- [ ] Document document snapshot boundary
- [ ] Create warehouse event registry entries (movements, corrections, approvals)

---

## 1. Purpose of This Implementation Plan

This document exists to translate the canonical Event System architecture into an ordered, safe, practical execution plan.

**The README (`docs/event-system/README.md`) remains the architecture source of truth.** This plan does not redefine architecture. It defines:

- The implementation order across phases
- What is in scope for the first delivery vs. later iterations
- The file and folder structure to be created
- Migration strategy and ordering
- Safety rules that must be respected throughout implementation
- Verification gates that must pass before rollout

Any implementation question about **what** to build should be resolved by reading the README. Any question about **in what order** or **what is safe to skip for now** should be resolved by reading this plan.

---

## 2. Scope of First Implementation

The first delivery targets the **core platform event infrastructure** only. It must be production-safe and correct, but it intentionally excludes deep forensic module concerns that are planned for later iterations.

### In scope for first delivery

| Component                         | Notes                                                                  |
| --------------------------------- | ---------------------------------------------------------------------- |
| `platform_events` canonical table | Full DDL, indexes, append-only enforcement, RLS                        |
| Event Registry                    | Defined in code, covering the initial platform action set              |
| Event Service                     | Central emission path with validation, actor normalization, request_id |
| Projection layer                  | Visibility filtering, field sensitivity filtering, summary generation  |
| Initial platform events           | Auth, org management, invitations, membership, roles, onboarding       |
| Frontend surfaces                 | My Activity, Organization Activity, Admin/Audit View                   |
| Tests                             | Service, projection, integration, permission, transaction              |

### Explicitly out of scope for first delivery

| Component                        | Reason                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| Warehouse version history tables | Deep forensic concern — separate implementation phase       |
| `warehouse_movement_versions`    | Module-level forensic layer — not part of core event system |
| `warehouse_document_snapshots`   | Module-level forensic layer — not part of core event system |
| Workshop event integration       | Later — follow same pattern once core is stable             |
| VMI event integration            | Later — follow same pattern once core is stable             |
| Full warehouse event set         | Can be wired in Phase 4/7 once infrastructure is ready      |

The event system infrastructure will be ready to support warehouse/workshop/VMI events. The forensic version history layer that **complements** those events is a separate concern and is not required for core rollout.

---

## 3. Implementation Phases

### Phase 0 — Planning and Validation

**Goal:** Confirm all design decisions before any code is written.

**Deliverables:**

- Confirmed first event set (auth, org, invitation, membership, role, onboarding)
- Confirmed RLS and projection strategy
- Confirmed Mode A (best-effort) vs Mode B (atomic RPC) split for first event set

**Decisions to resolve before Phase 1:**

1. Will `organization_id` be enforced as NOT NULL for non-auth events at the application layer only, or also via DB constraint? _(Architecture says nullable — confirm that stays as-is)_
2. Will `event_tier` be enforced as a `check` constraint on the DB column? _(Recommended: yes)_
3. Will `actor_type` be enforced as a `check` constraint on the DB column? _(Recommended: yes)_
4. Will request*id generation live in middleware, server actions, or be manually threaded? *(Recommended: server action or service boundary — see Section D)\_
5. Confirm `audit.events.read` as the permission slug for Admin/Audit View access and create the corresponding `permissions` table row before Phase 5 begins.

**Dependencies:** Architecture README reviewed and understood.

**Risks:** Starting Phase 1 with unresolved decisions causes migration rework.

**Success criteria:** All design decisions confirmed. No open questions that block Phase 1.

---

### Phase 1 — Core Database Foundation

**Goal:** Create the canonical `platform_events` table with full integrity guarantees in place from day one.

**Deliverables:**

- Migration file: `supabase/migrations/YYYYMMDD_platform_events.sql`
- Table created with all columns per README spec
- All five required indexes created
- Append-only enforcement via `REVOKE INSERT, UPDATE, DELETE` from public/authenticated/anon
- RLS policies: org-scoped read isolation, no INSERT/UPDATE/DELETE policies

#### Table design decisions (already resolved in README — must be preserved)

| Decision                      | Value                                 | Rationale                                                      |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `organization_id` nullability | `NULL` allowed                        | Auth/global events have no org context                         |
| `entity_id` type              | `text`                                | Supports UUIDs, document numbers, external IDs, composite keys |
| `target_id` type              | `text`                                | Same rationale as entity_id                                    |
| `summary` column              | Not present                           | Generated at read time, not stored                             |
| `visibility` column           | Not present                           | Registry concern, not DB concern                               |
| `sensitivity` column          | Not present                           | Registry concern, not DB concern                               |
| `event_tier`                  | `text not null` with check constraint | Enforces `baseline \| enhanced \| forensic`                    |
| `actor_type`                  | `text not null` with check constraint | Enforces valid actor categories                                |

#### Full migration DDL

```sql
-- Migration: platform_events core table
-- Must be applied to remote project only (rjeraydumwechpjjzrus)

create table if not exists public.platform_events (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  organization_id  uuid        null,
  branch_id        uuid        null,
  actor_user_id    uuid        null,
  actor_type       text        not null,
  module_slug      text        not null,
  action_key       text        not null,
  entity_type      text        not null,
  entity_id        text        not null,
  target_type      text        null,
  target_id        text        null,
  metadata         jsonb       not null default '{}',
  event_tier       text        not null,
  request_id       uuid        null,
  ip_address       inet        null,
  user_agent       text        null,

  constraint platform_events_actor_type_check
    check (actor_type in ('user', 'system', 'api', 'worker', 'scheduler', 'automation')),

  constraint platform_events_event_tier_check
    check (event_tier in ('baseline', 'enhanced', 'forensic'))
);

-- Foreign key constraints (soft — do not cascade delete)
alter table public.platform_events
  add constraint platform_events_organization_id_fk
  foreign key (organization_id) references public.organizations(id) on delete set null;

-- actor_user_id references public.users, not auth.users.
-- Reason: the platform FK chain is auth.users → public.users → organization_members.
-- public.users is the application-layer identity table and is the correct anchor for
-- cross-table joins and RLS functions. auth.users is the auth provider's internal table
-- and should not be the target of application-layer FKs.
alter table public.platform_events
  add constraint platform_events_actor_user_id_fk
  foreign key (actor_user_id) references public.users(id) on delete set null;

-- Required indexes
create index if not exists pe_org_created_idx
  on public.platform_events (organization_id, created_at desc)
  where organization_id is not null;

create index if not exists pe_actor_user_idx
  on public.platform_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists pe_action_key_idx
  on public.platform_events (action_key, created_at desc);

create index if not exists pe_entity_idx
  on public.platform_events (entity_type, entity_id, created_at desc);

create index if not exists pe_request_id_idx
  on public.platform_events (request_id)
  where request_id is not null;

-- Append-only enforcement: revoke mutation rights from all roles
revoke update, delete on public.platform_events from public;
revoke update, delete on public.platform_events from authenticated;
revoke update, delete on public.platform_events from anon;

-- Defense in depth: also revoke direct INSERT from non-privileged roles.
-- Inserts must only occur via service-role (event.service.ts) or
-- security definer DB functions (Mode B atomic RPCs).
revoke insert on public.platform_events from public;
revoke insert on public.platform_events from authenticated;
revoke insert on public.platform_events from anon;

-- RLS: enable row-level security
alter table public.platform_events enable row level security;

-- RLS: org members may read events scoped to their own org only.
-- Events with organization_id IS NULL (auth/global/platform events) are NOT
-- exposed through this raw-table policy. They are handled via backend projection only.
create policy "org_members_read_own_org_events"
  on public.platform_events
  for select
  using (
    organization_id is not null
    and is_org_member(organization_id)
  );

-- Note: INSERT is explicitly revoked from public/authenticated/anon (defense in depth).
-- Inserts must only occur via the service-role client (event.service.ts, Mode A) or
-- via security-definer DB functions (Mode B atomic RPCs). No RLS INSERT policy is defined.
-- No UPDATE or DELETE policies exist — these operations are also revoked at the DB level.
-- Note: org-null events (auth, global, platform) are intentionally excluded from
-- all raw SELECT policies. They must only be surfaced via tightly controlled
-- backend projection paths, never through broad authenticated-role table access.
```

**Migration note:** `REVOKE INSERT, UPDATE, DELETE` applies to all standard roles including `authenticated` and `anon`. The service role bypasses RLS entirely and is the only application path for inserts (via `event.service.ts` in Mode A, or via `security definer` DB functions in Mode B). This is intentional and is defense in depth beyond RLS.

**Dependencies:** Organizations table must exist.

**Risks:**

- FK on `organization_id` with `on delete set null` — confirm `organizations` table column name matches
- `is_org_member` function must exist (verified per memory — it does)
- The RLS SELECT policy intentionally excludes `organization_id IS NULL` rows from raw authenticated reads — verify this does not accidentally block any legitimate org-scoped read that was previously relying on a null-pass-through

**Success criteria:**

- Table created with all columns
- All 5 indexes present
- `INSERT`, `UPDATE`, and `DELETE` on `public.platform_events` rejected for `authenticated` role (verified by test)
- Org-scoped read policy returns only rows where `organization_id` matches the caller's org
- Rows where `organization_id IS NULL` are NOT returned to ordinary authenticated callers via raw SELECT
- No `summary`, `visibility`, or `sensitivity` columns present

---

### Phase 2 — Backend Infrastructure

**Goal:** Create the TypeScript backbone that all platform event emission will flow through.

**Deliverables:**

- `src/server/audit/types.ts`
- `src/server/audit/event-registry.ts`
- `src/server/services/event.service.ts`
- Zod schema integration per action key
- Actor normalization utility
- Request correlation pattern documented and demonstrated

#### File: `src/server/audit/types.ts`

Defines all shared TypeScript types used across the event system.

Must include:

- `PlatformEventRow` — raw DB row type (matches DDL exactly)
- `EmitEventInput` — input type for `eventService.emit()`
- `EventRegistryEntry` — type for registry entries
- `ActorType` union type
- `EventTier` union type
- `ProjectedEvent` — type returned by projection layer to callers
- `ProjectionContext` — viewer identity + scope + permissions used during projection

```ts
// src/server/audit/types.ts — structure reference (not final code)

export type ActorType = "user" | "system" | "api" | "worker" | "scheduler" | "automation";
export type EventTier = "baseline" | "enhanced" | "forensic";

export interface PlatformEventRow {
  id: string;
  created_at: string;
  organization_id: string | null;
  branch_id: string | null;
  actor_user_id: string | null;
  actor_type: ActorType;
  module_slug: string;
  action_key: string;
  entity_type: string;
  entity_id: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  event_tier: EventTier;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface EmitEventInput {
  actionKey: string;
  actorUserId?: string | null;
  actorType: ActorType;
  organizationId?: string | null;
  branchId?: string | null;
  entityType: string;
  entityId: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  eventTier: EventTier;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface EventRegistryEntry {
  actionKey: string;
  moduleSlug: string;
  eventTier: EventTier;
  description: string;
  metadataSchema: ZodSchema; // validated at emit time by event.service.ts
  // summaryTemplate: named-interpolation string, e.g. '{{actor}} invited {{target}} to the organization'
  // Supported variables: {{actor}}, {{entity}}, {{target}}
  // Resolved at projection/read time by projection.ts — never stored in DB
  summaryTemplate: string;
  visibleTo: ("self" | "org_member" | "org_admin" | "auditor" | "public")[];
  sensitiveFields: string[]; // metadata fields stripped for personal/org projections
}

export type ProjectionScope = "personal" | "org" | "audit";

export interface ProjectionContext {
  viewerUserId: string;
  viewerScope: ProjectionScope;
  organizationId: string | null;
  permissions: string[]; // permission snapshot slugs
}

export interface ProjectedEvent {
  id: string;
  created_at: string;
  action_key: string;
  actor_display: string; // derived from actor_type + actor_user_id
  entity_type: string;
  entity_id: string;
  summary: string; // generated from template
  metadata: Record<string, unknown>; // sensitive fields already stripped
  event_tier: EventTier;
  request_id: string | null;
  // ip_address and user_agent NOT included unless auditor scope
}
```

#### File: `src/server/audit/event-registry.ts`

Defines the `EVENT_REGISTRY` map from `action_key` to `EventRegistryEntry`.

**Initial registry entries to implement (Phase 4 targets):**

| Action Key                      | Module                  | Tier     | Summary Template                                     |
| ------------------------------- | ----------------------- | -------- | ---------------------------------------------------- |
| `auth.login`                    | auth                    | baseline | `{{actor}} logged in`                                |
| `auth.login.failed`             | auth                    | baseline | `Failed login attempt`                               |
| `auth.password.reset_requested` | auth                    | baseline | `{{actor}} requested password reset`                 |
| `auth.password.reset_completed` | auth                    | baseline | `{{actor}} completed password reset`                 |
| `auth.session.revoked`          | auth                    | enhanced | `{{actor}} session revoked`                          |
| `org.created`                   | organization-management | baseline | `Organization created`                               |
| `org.updated`                   | organization-management | baseline | `Organization profile updated by {{actor}}`          |
| `org.member.invited`            | organization-management | enhanced | `{{actor}} invited {{target}} to the organization`   |
| `org.member.removed`            | organization-management | enhanced | `{{actor}} removed {{target}} from the organization` |
| `org.invitation.accepted`       | organization-management | baseline | `{{target}} accepted invitation and joined`          |
| `org.invitation.cancelled`      | organization-management | enhanced | `{{actor}} cancelled invitation for {{target}}`      |
| `org.role.created`              | organization-management | enhanced | `{{actor}} created role {{entity}}`                  |
| `org.role.updated`              | organization-management | enhanced | `{{actor}} updated role {{entity}}`                  |
| `org.role.deleted`              | organization-management | enhanced | `{{actor}} deleted role {{entity}}`                  |
| `org.member.role_assigned`      | organization-management | enhanced | `{{actor}} assigned role to {{target}}`              |
| `org.member.role_removed`       | organization-management | enhanced | `{{actor}} removed role from {{target}}`             |
| `org.branch.created`            | organization-management | baseline | `{{actor}} created branch {{entity}}`                |
| `org.branch.updated`            | organization-management | baseline | `{{actor}} updated branch {{entity}}`                |
| `org.branch.deleted`            | organization-management | enhanced | `{{actor}} deleted branch {{entity}}`                |
| `org.onboarding.completed`      | organization-management | baseline | `Organization onboarding completed`                  |

**Registry policy:**

- Only emit events that have a registry entry
- `event.service.ts` must reject emission for unregistered `action_key` values
- Registry must never be read from the database — it is always a code-defined module

#### File: `src/server/services/event.service.ts`

The single, central path for all event emission.

**Responsibilities:**

1. Receive `EmitEventInput`
2. Look up registry entry for `actionKey` — reject if not found
3. Validate `metadata` against the registered Zod schema — reject on failure
4. Normalize actor (enforce `actor_user_id = null` when `actor_type !== 'user'`)
5. Insert into `public.platform_events` using the service-role client
6. Return the inserted row ID or a typed error

**Execution model — best-effort app-side emission:**

`event.service.ts` is the central validation and emission abstraction for **Mode A (best-effort)** flows. The caller writes its domain state, confirms success, then calls `eventService.emit()` as a follow-on step. If the emit fails after a successful domain write, the domain change is not rolled back — this is an accepted trade-off for baseline-tier non-forensic events.

For **Mode B (atomic DB-side)** forensic workflows, `eventService.emit()` is called at the server action layer to perform validation and registry lookup, but the final `INSERT INTO public.platform_events` is performed inside the DB-side RPC function. See Section 6 for the full two-mode model.

```ts
// Signature reference (not final code)
async function emit(input: EmitEventInput): Promise<{ id: string } | { error: string }>;
```

**Central emission invariant:** No caller may insert directly into `public.platform_events` from application code. For Mode A flows, all paths must go through `eventService.emit()`. For Mode B atomic flows, the final insert lives inside a DB function — but metadata is pre-validated at the service layer before the RPC is called. See README Architectural Invariant section for the full rationale.

**Dependencies:** `types.ts`, `event-registry.ts`, Supabase service-role client utility.

**Risks:**

- Misconfigured Zod schemas will silently allow bad metadata through if not tested
- Mode A emits that follow a domain write are best-effort — a service crash between the write and the emit produces a missed event. This is acceptable for baseline-tier events only.
- Mode B atomic DB functions that bypass `eventService.emit()` for validation entirely would be an architectural violation — pre-validation at the action layer is mandatory

**Success criteria:**

- Unregistered `action_key` causes an error, not a silent pass
- Invalid metadata is rejected before any insert attempt
- `actor_user_id` is null when `actor_type` is not `user`
- Mode A: emit succeeds after domain write
- Mode B: metadata validated at action layer before RPC call
- No application code inserts directly into `public.platform_events`

---

### Phase 3 — Projection / Read Layer

**Goal:** Create the backend layer that translates raw `platform_events` rows into viewer-scoped projected results. This layer is the only thing the frontend should ever consume.

**Deliverables:**

- `src/server/audit/projection.ts`
- Summary generation logic
- Visibility filtering logic
- Field sensitivity filtering logic
- Three projection views defined: personal, org, audit

#### File: `src/server/audit/projection.ts`

**Responsibilities:**

1. Accept a list of raw `PlatformEventRow` + a `ProjectionContext`
2. Filter rows to only those visible to this viewer (per registry `visibleTo`)
3. Strip sensitive metadata fields (per registry `sensitiveFields`) unless viewer has auditor scope
4. Generate `summary` string for each event from registry template
5. Return `ProjectedEvent[]` — never raw rows

**The three projection views:**

| View                      | Viewer              | Scope      | What they see                                                                                              |
| ------------------------- | ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| **Personal Activity**     | Authenticated user  | `personal` | Only events where `actor_user_id = viewerUserId`. Sensitive fields stripped. No `ip_address`/`user_agent`. |
| **Organization Activity** | Org admin / manager | `org`      | All org-scoped events visible to org members per registry `visibleTo`. Sensitive fields stripped.          |
| **Admin / Audit View**    | Auditor / admin     | `audit`    | All events without field stripping. `ip_address` and `user_agent` included. Raw metadata visible.          |

**Summary generation:**

Summary strings are generated at read time from `EventRegistryEntry.summaryTemplate`. Templates support named interpolation:

- `{{actor}}` — resolved from `actor_user_id` (display name lookup) or `actor_type` for system actors
- `{{entity}}` — resolved from `entity_type` + `entity_id` where meaningful
- `{{target}}` — resolved from `target_type` + `target_id` where meaningful

Summary strings are **never stored in the database**.

**Key rule:** The projection layer is a backend concern. The frontend receives `ProjectedEvent[]` — not `PlatformEventRow[]`. Frontend code must never implement visibility or sensitivity logic.

**Pagination requirement:**

All projection queries must support cursor-based or offset pagination. Returning unbounded event history is not permitted. The projection function signature must accept `limit` and `offset` (or `cursor`) parameters, and callers must always provide them. A default page size of 50 events must be enforced if the caller does not specify a limit. The frontend must never request or receive the full event history in a single call.

**Dependencies:** `types.ts`, `event-registry.ts`.

**Risks:**

- Missing registry entry for a stored event causes projection to fail or silently drop the event — emit guard must prevent this from happening at write time
- Auditor scope must be enforced server-side — never accept scope claim from client
- Unbounded queries against large event tables will cause slow responses and timeouts — pagination is mandatory, not optional

**Success criteria:**

- Personal view contains only caller's own events
- Org view does not expose events marked not visible to org members
- Audit view includes all events with all fields
- `ip_address` and `user_agent` absent from personal and org projections
- Sensitive metadata fields absent from personal and org projections
- Summary strings generated correctly from templates
- All three projection views support pagination — no unbounded result sets

---

### Phase 4 — First Platform Event Integrations

**Goal:** Wire the initial set of real platform events through the event service. This is the first point where the system produces actual event data.

**Deliverables:**

- Registry entries for all events listed below
- Zod metadata schemas for all events listed below
- `eventService.emit()` calls wired into existing server actions at the correct transaction boundaries

#### Auth events

These events come from the auth layer. Most Supabase auth events happen outside direct server action calls (login, password reset). Consider:

- Supabase Auth hook → Edge Function → call internal API to emit event
- Or: `POST /api/events/auth` server-side route protected by service-role key

| Action Key                      | Emission point                                         |
| ------------------------------- | ------------------------------------------------------ |
| `auth.login`                    | Post-sign-in success callback or auth hook             |
| `auth.login.failed`             | Auth hook on failed attempt                            |
| `auth.password.reset_requested` | After `supabase.auth.resetPasswordForEmail()` succeeds |
| `auth.password.reset_completed` | After password change confirmed                        |

**Note:** Auth events do not have an `organization_id` at emission time in all cases — this is expected. `organization_id` is nullable in the schema for this reason.

#### Organization management events

These wire into existing server actions in `src/app/actions/organization/`.

| Action Key                 | Server action                    |
| -------------------------- | -------------------------------- |
| `org.created`              | Org creation action              |
| `org.updated`              | Org update action                |
| `org.branch.created`       | Branch creation action           |
| `org.branch.updated`       | Branch update action             |
| `org.branch.deleted`       | Branch delete action             |
| `org.member.invited`       | Invitation creation action       |
| `org.invitation.accepted`  | `accept_invitation_and_join_org` |
| `org.invitation.cancelled` | Invitation cancel action         |
| `org.member.removed`       | Member remove action             |
| `org.member.role_assigned` | Role assignment action           |
| `org.member.role_removed`  | Role removal action              |
| `org.role.created`         | Role CRUD action                 |
| `org.role.updated`         | Role CRUD action                 |
| `org.role.deleted`         | Role CRUD action                 |

**Emission model for Phase 4 org management events:**

The org management events in this phase are **baseline or enhanced tier** — they do not require forensic-grade version snapshots. For these events, **Mode A (best-effort app-side emission)** is the correct approach:

1. Server action performs domain write (e.g. insert invitation row)
2. Server action confirms write succeeded
3. Server action calls `eventService.emit()` with the correct fields
4. If emit fails in isolation, the domain write is not rolled back — an isolated emit failure is logged but does not surface to the user as a hard error

For any org event that involves a version snapshot or a chain of dependent state changes that must all succeed together, use **Mode B (atomic DB-side RPC)**. The initial Phase 4 set does not require Mode B.

**Risks:**

- Best-effort emit means a crash between a write and the emit produces a missed event record — acceptable for baseline/enhanced tier, not acceptable for forensic tier
- Auth events (login, password reset) have no natural server action entry point in this platform — the emission strategy for these must be confirmed before implementation (Edge Function hook or internal API route)

**Success criteria:**

- Each listed action produces a corresponding event on success
- Metadata validated by Zod schema before insert
- `request_id` propagated through the full action call stack
- Auth event emission strategy confirmed and implemented

---

### Phase 5 — Frontend Surfaces

**Goal:** Expose event data to users through three projection-backed views. Backend correctness comes first. UI polish is secondary.

**Deliverables:**

- Server action / API route for Personal Activity feed
- Server action / API route for Organization Activity feed
- Server action / API route for Admin / Audit feed (permission-gated)
- My Activity page
- Organization Activity page
- Admin / Audit page

#### Backend-first delivery

Each surface must be a server-side projected call. The call chain:

```
UI request
  → server action (validates viewer identity + permissions)
    → projection.ts (filters, strips, generates summaries)
      → returns ProjectedEvent[]
        → UI renders
```

Raw `PlatformEventRow[]` must never be returned to the client.

#### Permission gates

| Surface               | Required permission                                                       | Projection scope |
| --------------------- | ------------------------------------------------------------------------- | ---------------- |
| My Activity           | Authenticated (any)                                                       | `personal`       |
| Organization Activity | `org_admin` role or equivalent                                            | `org`            |
| Admin / Audit View    | `audit.events.read` (must be created in permissions table before Phase 5) | `audit`          |

#### UI requirements

- Default sort: `created_at ASC` for timelines, `created_at DESC` for activity feeds
- No client-side filtering of event visibility or field sensitivity
- My Activity must display only the viewer's own events (enforced server-side)
- Organization Activity must not expose `ip_address`, `user_agent`, or sensitive metadata
- Admin Audit view may expose all fields — access must require explicit `audit.events.read` permission check (server-side only)
- All three feeds must implement pagination — UI must not load unbounded event history
- Default page size is 50 events; the UI must expose a "Load more" or page navigation control

**Risks:**

- `audit.events.read` permission must be created in the `permissions` table and assigned to the appropriate org role before Phase 5 begins. The projection scope `audit` must only be granted after a server-side check confirms this permission slug. Use `PermissionService.hasPermission()` — do not accept scope claims from the client.
- Event feeds without pagination will produce increasingly slow responses as the `platform_events` table grows — do not defer pagination to a "later optimization"

**Success criteria:**

- My Activity shows only caller's own events
- Organization Activity does not expose security-sensitive fields
- Admin/Audit view works only for users with the `audit.events.read` permission
- No raw `platform_events` data returned to any client path
- All three feeds use pagination — no single API response returns unbounded event history

---

### Phase 6 — Testing and Verification

**Goal:** Verify correctness, security, and integrity across all layers before first rollout.

#### Event service tests (`event.service.test.ts`)

- Valid emit with all required fields → success, row inserted
- Emit with unregistered `action_key` → rejected, no insert
- Emit with invalid metadata (schema mismatch) → rejected, no insert
- Emit with `actor_type = 'system'` and non-null `actor_user_id` → normalized to null or rejected
- Mode A emit after successful domain write → row inserted in `platform_events`
- Mode A emit after domain write with subsequent isolated emit failure → domain state preserved, emit error logged (no crash, no rollback of domain write)
- Mode B: atomic RPC called with validated payload → domain write + event insert succeed together
- Mode B: atomic RPC with a failing domain write step → entire transaction rolls back, no row in `platform_events`

#### Registry contract tests (`event-registry.test.ts`)

- Every registered entry has a valid Zod schema
- Every registered entry has a non-empty `summaryTemplate`
- Every registered `visibleTo` array contains only valid scope values
- Every registered `sensitiveFields` is a string array (may be empty)

#### Projection tests (`projection.test.ts`)

- Personal scope: only viewer's own events returned
- Personal scope: `ip_address` and `user_agent` absent from output
- Personal scope: sensitive metadata fields absent
- Org scope: events marked not visible to org members excluded
- Org scope: sensitive metadata fields absent
- Audit scope: all events returned, all fields present
- Summary generation: templates interpolated correctly for user, system, and target actors
- Unknown `action_key` in event row: handled gracefully (log + skip, not crash)

#### Integration tests

- Org member invited (Mode A) → event in `platform_events` with correct fields after successful action write
- Mode B atomic RPC failure (domain write fails) → no row in `platform_events` (transaction rolled back)
- Auth login → event in `platform_events`
- Full emit → projection cycle for each of the three views

#### Append-only enforcement tests

- `UPDATE` on `public.platform_events` as `authenticated` → rejected
- `DELETE` on `public.platform_events` as `authenticated` → rejected
- Direct `INSERT` on `public.platform_events` as `authenticated` → rejected
- `INSERT` via `eventService.emit()` (service-role path) → succeeds

#### Request correlation tests

- Two emits in same request with same `request_id` → both rows have matching `request_id`
- Query by `request_id` → returns all events for that workflow boundary

**Testing gates — must all pass before rollout:**

- [ ] Append-only enforcement verified (UPDATE/DELETE rejected for authenticated role)
- [ ] No direct inserts outside `event.service.ts` in the codebase
- [ ] Invalid metadata rejected by Zod validation
- [ ] Unregistered `action_key` rejected at emit time
- [ ] Summary generation produces non-empty strings for all registered events
- [ ] Visibility filtering: org member cannot see events marked not visible to them
- [ ] Security-sensitive fields (`ip_address`, `user_agent`) not present in personal/org projections
- [ ] Transaction rollback consistency: rolled-back domain change produces no orphaned event
- [ ] Projection scope is enforced server-side, not asserted from client input

---

### Phase 7 — Forensic Module Integration Guidance

**Goal:** Prepare the event system to support warehouse, workshop, and VMI modules correctly, without allowing those modules to misuse the event system as a version store.

#### What the event system IS for in forensic modules

Forensic modules (warehouse, workshop, VMI) use the same `platform_events` table and the same `event.service.ts` emission path. There is no separate table or separate service for forensic modules.

Forensic modules emit:

- `warehouse.movement.created`
- `warehouse.movement.approved`
- `warehouse.movement.reversed`
- `warehouse.movement.locked`
- `warehouse.document.generated`
- `warehouse.stock.correction_applied`
- `warehouse.audit.started` / `warehouse.audit.completed`

All of these are emitted through `eventService.emit()` like all other events.

#### What the event system is NOT for in forensic modules

The event system records what happened, who did it, and when. It does not store the full historical state of business entities. Specifically:

- `metadata` must NOT contain full document snapshots or full movement row states
- `metadata` must NOT be used as a substitute for a proper version table
- The event system is not a replacement for `warehouse_movement_versions` or `warehouse_document_snapshots`

#### Metadata size and misuse guardrail

This rule applies to **all modules**, not only forensic ones:

- `metadata` must remain structured and reasonably small — it records the relevant context of an action, not the full state of an entity
- Full entity rows, rendered document content, binary blobs, and large nested arrays must not be stored in `metadata`
- A good `metadata` payload contains key identifiers, a status transition, and a small number of scalar context fields (amount changed, quantity corrected, role assigned, etc.)
- If you find yourself copying an entire entity row into `metadata`, that is a version table requirement, not an event metadata requirement
- The Zod schema for each action key is the enforcement mechanism — schemas should be narrow and reject unexpectedly large payloads

#### Forensic version history boundary

This is a module-level concern, not a platform concern. When warehouse implements the version history layer, it will create:

- `warehouse_movement_versions` — append-only version log per movement
- `warehouse_document_snapshots` — immutable document records

These tables are the responsibility of the warehouse module. They are not part of the core event system implementation. They are added in a separate migration, in a separate implementation phase, by the warehouse module.

#### Atomic transaction boundary for forensic modules

When a forensic event must be emitted alongside a domain write and version snapshot atomically, use **Mode B (atomic DB-side RPC)** as defined in Section 6. The server action layer must not attempt to manage transaction scope through client-side JS calls.

**The correct forensic workflow boundary:**

```
Server action:
  1. Validate metadata via event registry (TypeScript, Zod)
  2. Call DB-side RPC with validated payload

DB-side RPC (single atomic transaction):
  UPDATE warehouse_movements          ← domain change
  INSERT INTO warehouse_movement_versions ← version capture
  INSERT INTO public.platform_events  ← event emission

If any step fails: entire transaction rolls back
```

Application code does not manage `BEGIN`/`COMMIT`. The database function owns the transaction boundary.

#### Safe integration checklist for future forensic modules

- [ ] Emit events through the DB-side atomic RPC for forensic-tier workflows — no best-effort app-side emit for state transitions that require version snapshot atomicity
- [ ] Pre-validate metadata at the server action layer (Zod schema from registry) before calling the RPC
- [ ] Register all warehouse action keys in the event registry before emitting
- [ ] Define Zod metadata schemas for each warehouse action key
- [ ] Use `event_tier: 'forensic'` for movement approvals, corrections, reversals
- [ ] Do NOT store full entity state in event metadata — use version tables for that
- [ ] Do NOT generate documents from current row state — use version snapshot at generation time
- [ ] Define separate `warehouse_movement_versions` migration (not part of core event system migration)

**Success criteria:**

- Warehouse events appear in `platform_events` correctly
- Warehouse events are visible in audit projection
- No full entity state stored in event metadata
- Version history tables implemented separately (separate migration, separate phase)

---

## 4. File and Folder Structure

The following files must be created during implementation. No files should be created before their phase begins.

```
supabase/
  migrations/
    YYYYMMDDHHMMSS_platform_events.sql         ← Phase 1: table + indexes + RLS + REVOKE

src/
  server/
    audit/
      types.ts                                 ← Phase 2: all shared types
      event-registry.ts                        ← Phase 2: registry map + initial entries
      projection.ts                            ← Phase 3: projection layer
    services/
      event.service.ts                         ← Phase 2: central emission service

  app/
    actions/
      audit/
        get-personal-activity.ts               ← Phase 5: personal activity server action
        get-org-activity.ts                    ← Phase 5: org activity server action
        get-audit-feed.ts                      ← Phase 5: admin/audit server action

    [locale]/
      dashboard/
        activity/
          page.tsx                             ← Phase 5: My Activity page
        organization/
          activity/
            page.tsx                           ← Phase 5: Org Activity page
          audit/
            page.tsx                           ← Phase 5: Admin/Audit page
```

**Notes:**

- `src/server/audit/` is a new folder — do not add event system types into existing service folders
- `event-registry.ts` must be backend-only — never imported by client-side components
- `projection.ts` must be backend-only — never used client-side
- The three server actions in `src/app/actions/audit/` follow the existing action pattern

---

## 5. Migration Strategy

Apply migrations in this order. Each migration should be idempotent where possible.

| Step | Migration                                                          | Depends on                   |
| ---- | ------------------------------------------------------------------ | ---------------------------- |
| 1    | Create `platform_events` table                                     | `organizations` table exists |
| 2    | Create required indexes                                            | Step 1                       |
| 3    | Add `REVOKE INSERT, UPDATE, DELETE` from public/authenticated/anon | Step 1                       |
| 4    | Add RLS policies                                                   | Step 1                       |
| 5    | Verify with test insert (dev only)                                 | Steps 1–4                    |

**Migration file convention:** Follow existing pattern `YYYYMMDDHHMMSS_description.sql` and place in `supabase/migrations/`.

**Never apply migrations locally.** Always target the remote project `rjeraydumwechpjjzrus` via Supabase MCP or CLI.

**Incremental approach:** Do not combine steps 1–4 into a single migration unless you are confident in the DDL. Separate migrations are easier to diagnose if one fails.

---

## 6. Transaction Strategy

Event emission integrity must be matched to the risk tier of the workflow. This section defines the two supported emission modes and when each must be used.

### Two Supported Emission Modes

#### Mode A — Best-effort app-side emission

**Used for:**

- Baseline and enhanced tier events
- Simple non-forensic workflows (org profile updates, invitations, role assignments)
- Any workflow where an isolated missed event is an acceptable, loggable failure

**How it works:**

```
Server action:
  1. Perform domain write
  2. Confirm write succeeded
  3. Call eventService.emit() ← registry lookup, Zod validation, INSERT
```

If the domain write succeeds but the emit fails in isolation, the state change is preserved and the missed event is logged. This is the accepted trade-off for non-forensic flows. The emit is not retried automatically — a missed event is surfaced as a service error for monitoring.

**Does not require a DB-side function.** Validation happens in TypeScript via `eventService.emit()`. The service-role client performs the `INSERT` directly.

---

#### Mode B — Atomic DB-side emission

**Used for:**

- Forensic tier events (`event_tier: 'forensic'`)
- Any workflow where the event record + domain state change + optional version snapshot must succeed or fail as a single unit
- Approval/reversal chains, document-generation workflows, version-critical state transitions

**How it works:**

```
Server action:
  1. Validate metadata at the TypeScript layer (registry lookup, Zod schema)
  2. Call DB-side Postgres function (RPC) with the validated payload

DB-side function (single atomic transaction):
  UPDATE/INSERT domain record
  INSERT version snapshot (if applicable)
  INSERT INTO public.platform_events
```

If any step inside the DB function fails, the entire transaction rolls back. The server action receives an error and surfaces it to the caller.

**Requires a dedicated DB-side function per forensic workflow.** Validation still happens at the TypeScript/service layer before the RPC is called — the DB function trusts the pre-validated payload.

---

**Summary:**

| Property             | Mode A                           | Mode B                                 |
| -------------------- | -------------------------------- | -------------------------------------- |
| Atomicity            | Best-effort (app-layer)          | Guaranteed (DB transaction)            |
| Validation           | `eventService.emit()` TypeScript | TypeScript pre-validation + RPC        |
| DB function required | No                               | Yes                                    |
| Use for tier         | `baseline`, `enhanced`           | `forensic`                             |
| Missed event risk    | Possible (loggable)              | Not possible if RPC rolls back cleanly |

---

### Why client-managed transactions are not reliable

The Supabase JavaScript client does not support opening arbitrary SQL transactions via `BEGIN` / `COMMIT` RPCs in a way that is safe or predictable across connection poolers. Patterns like `supabase.rpc('begin')` followed by separate client calls are **not a safe implementation approach** for multi-step atomic workflows. Connection pool routing can direct sequential calls to different connections, and explicit transaction control of this kind is not designed for pooled application use.

**Do not use:** `supabase.rpc('begin')` / `supabase.rpc('commit')` as a transaction wrapper in application server actions.

### Correct implementation pattern for atomic workflows

When a workflow requires that a domain write, version snapshot, and event emission all succeed or fail together, the correct approach in this platform is a **Postgres database function (RPC)** that performs all three operations in a single atomic server-side transaction.

**Conceptual RPC pattern:**

```sql
-- Postgres function: approve_movement (illustrative, not production code)
create or replace function public.approve_movement(
  p_movement_id  uuid,
  p_actor_id     uuid,
  p_request_id   uuid,
  p_snapshot     jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  -- 1. Domain write
  update public.warehouse_movements
    set status = 'approved', approved_by = p_actor_id
    where id = p_movement_id;

  -- 2. Version snapshot
  insert into public.warehouse_movement_versions
    (movement_id, captured_by, snapshot)
    values (p_movement_id, p_actor_id, p_snapshot);

  -- 3. Event emission — insert directly within the same transaction
  insert into public.platform_events
    (actor_user_id, actor_type, module_slug, action_key, entity_type, entity_id,
     metadata, event_tier, request_id)
    values
    (p_actor_id, 'user', 'warehouse', 'warehouse.movement.approved', 'movement',
     p_movement_id::text, jsonb_build_object('movement_id', p_movement_id),
     'forensic', p_request_id)
    returning id into v_event_id;

  return v_event_id;
end;
$$;
```

The server action calls this RPC with a single `supabase.rpc('approve_movement', { ... })` call. The entire operation is atomic — all three writes succeed together or the transaction rolls back.

### Role of `event.service.ts` in atomic workflows

`event.service.ts` remains the **conceptual central emission path** — it defines the validation, registry lookup, and metadata schema enforcement that must be applied before any event is stored.

However, in workflows that require atomicity, the final `INSERT INTO public.platform_events` happens inside the database function, not from application JavaScript. The implementation must ensure:

1. The database function uses the same validation rules that the TypeScript service enforces (the Zod schema validation may happen at the server action layer before the RPC call, not inside the DB function itself)
2. No application code bypasses the registry or metadata validation by calling atomic RPCs with arbitrary unvalidated data
3. The server action pre-validates metadata using the same Zod schema as the registry, then passes the validated payload to the RPC

**For non-forensic, non-atomic event flows** (e.g. a simple org update with no version snapshot requirement), the server action can call `eventService.emit()` directly after confirming the domain write succeeded, accepting that the event emission is best-effort rather than transactionally guaranteed.

### Failure modes without atomic emission

| Failure scenario                                          | Result                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Domain write succeeds, event emit fails (non-atomic path) | State changed — no audit record ← forensic gap                    |
| Event emitted, domain write fails (non-atomic path)       | Phantom event — records action that never happened                |
| RPC rolls back (atomic path)                              | Both domain write and event insert rolled back — consistent state |

The atomic RPC pattern eliminates both failure modes for forensic-grade workflows. The best-effort direct emit pattern is acceptable only for baseline-tier, non-forensic events where the cost of an occasional missed record is tolerable.

---

## 7. Request Correlation Strategy

`request_id` groups all events emitted within a single logical workflow boundary.

**Generation rule:**

`request_id` is generated **once** at the workflow entry point — the server action or service that initiates the workflow. It must be:

```ts
const requestId = crypto.randomUUID();
```

It is then propagated to every `eventService.emit()` call made within that workflow. It must not be regenerated inside nested calls.

**Where NOT to generate `request_id`:**

- Inside `event.service.ts` itself — the service never generates `request_id`
- Inside utility helpers called from the action
- Per-emit inside a loop

**Example — multi-event workflow:**

```ts
// Server action: accept invitation (Mode A — best-effort, all three are baseline/enhanced tier)
const requestId = crypto.randomUUID();

await eventService.emit({ actionKey: 'org.invitation.accepted', requestId, ... });
await eventService.emit({ actionKey: 'org.member.role_assigned', requestId, ... });
await eventService.emit({ actionKey: 'user.onboarding.started', requestId, ... });

// All three events share the same request_id — queryable as one workflow
// Note: requestId is propagated as a plain value, not as a transaction handle
```

**Propagation path:**

```
Server action entry point → generates requestId = crypto.randomUUID()
  → calls service A with requestId as parameter
    → service A calls eventService.emit({ ..., requestId })
  → calls service B with requestId as parameter
    → service B calls eventService.emit({ ..., requestId })
```

**Risk — fragmentation:** If any service in the chain generates its own `requestId` or omits it, the workflow chain breaks. Establish a convention: `requestId` is always a parameter on service methods that emit events.

---

## 8. Projected Read Strategy

Raw reads against `public.platform_events` are not the normal application read pattern. The following rules apply:

| Caller                        | May use raw `public.platform_events`?  | Expected path                                 |
| ----------------------------- | -------------------------------------- | --------------------------------------------- |
| Frontend UI                   | Never                                  | Consume `ProjectedEvent[]` from server action |
| Server action (personal feed) | Via `projection.ts` only               | Projection layer enforces filtering           |
| Server action (org feed)      | Via `projection.ts` only               | Projection layer enforces filtering           |
| Server action (admin audit)   | Via `projection.ts` with `audit` scope | Full fields but still through projection      |
| Background worker             | Yes, if needed for analytics           | Service role, not user-facing                 |
| Migration / admin script      | Yes                                    | Not user-facing                               |

**Frontend rule:** The frontend must never query `public.platform_events` directly, must never receive `PlatformEventRow[]`, and must never make visibility or sensitivity decisions locally.

### Special rule: org-null events are not broadly readable

Events where `organization_id IS NULL` (auth events, global platform events, pre-org-resolution events) are especially sensitive. They must not be returned to ordinary authenticated users through any raw SELECT path.

The RLS policy on `public.platform_events` is intentionally scoped to `organization_id IS NOT NULL AND is_org_member(organization_id)`. This means:

- Ordinary authenticated users cannot read any org-null event through the raw table
- If a personal activity view needs to surface auth events (e.g. "you logged in from a new device"), this must happen through a **tightly controlled backend projection path** that explicitly queries with service-role privileges and applies visibility rules before returning data to the caller
- No broad raw-table SELECT policy may be created that exposes all org-null events to all authenticated users

---

## 9. Initial Event Registry Policy

The first event registry must be limited and deliberate. Do not register hypothetical future events.

**Starting principles:**

1. Register only events you will wire in Phase 4
2. Define Zod schemas only for events you can test immediately
3. Do not create placeholder registry entries without implementation
4. Do not create registry entries for warehouse/workshop/VMI until those modules are being wired (Phase 7+)
5. Unregistered events cannot be emitted — this is a feature, not a limitation

The initial registry set is the 20 platform events listed in the Phase 4 table above. Add more only as modules are wired.

---

## 10. Pre-Rollout Safety Gates

All of the following must be true before the event system is considered ready for production rollout:

### Database integrity

- [ ] `platform_events` table exists with all correct columns
- [ ] All 5 required indexes present
- [ ] `INSERT`, `UPDATE`, and `DELETE` on `public.platform_events` rejected for `authenticated` role (verified by test)
- [ ] RLS policies in place — org-scoped read isolation working; `organization_id IS NULL` rows not readable by ordinary authenticated users
- [ ] No `summary`, `visibility`, or `sensitivity` columns in the table

### Emission integrity

- [ ] All emits flow through `event.service.ts` — no direct inserts anywhere in codebase
- [ ] Unregistered `action_key` causes emit to return an error, not silently succeed
- [ ] Invalid metadata (Zod failure) causes emit to return an error, not silently insert
- [ ] `actor_user_id` is null for all non-user actor types
- [ ] Transaction rollback test: rolled-back domain change leaves no orphaned event
- [ ] Mode A emit failures are logged with action_key + org context — never silently swallowed
- [ ] Emit error logging confirmed observable in application logs or error monitoring service

### Projection integrity

- [ ] Personal projection returns only caller's own events (enforced server-side)
- [ ] `ip_address` and `user_agent` absent from personal and org projections
- [ ] Sensitive metadata fields absent from personal and org projections
- [ ] Audit projection accessible only to users with the required permission
- [ ] No raw `PlatformEventRow` data returned to any client-side path

### Request correlation

- [ ] `request_id` propagated correctly in at least one multi-event workflow
- [ ] Query by `request_id` returns correct grouped events

### Summary generation

- [ ] All registered events produce a non-empty summary string
- [ ] Unknown `action_key` in stored row handled gracefully (no crash)

### Observability for Mode A emit failures

- [ ] Mode A emit failures (isolated emit error after a successful domain write) are logged with sufficient context: `action_key`, `organization_id`, `actor_user_id`, error message
- [ ] Emit failures must not be silently swallowed — the server action must log the error and return a non-null error indicator that can be observed in application logs or an error monitoring service
- [ ] A missed emit (logged error) must not surface to the end user as a hard failure on a successful domain operation — but it must be visible to the platform operator

---

## 11. Architecture Alignment Checklist

Use this checklist when reviewing any implementation PR against the canonical architecture.

- [ ] Does not introduce a second event table (separate activity log, separate audit table, etc.)
- [ ] Does not store `summary`, `visibility`, or `sensitivity` in the DB
- [ ] Does not implement visibility or field filtering logic in the frontend
- [ ] Does not weaken the append-only model (no UPDATE/DELETE policies added)
- [ ] Does not use `platform_events` as a full entity state store (no full snapshots in metadata)
- [ ] `metadata` Zod schemas are narrow — full entity rows or large blobs are not valid metadata payloads
- [ ] Does not emit events outside transaction scope in forensic contexts
- [ ] Does not regenerate `request_id` inside nested service calls
- [ ] Does not allow direct inserts into `platform_events` from anywhere except `event.service.ts`
- [ ] Does not expose raw `PlatformEventRow` data to client-side code
- [ ] Does not make forensic version history a responsibility of the event system

---

_This plan is a living document. Update the Progress Tracker as phases complete. Update individual sections if implementation decisions change — but record why the change was made. The README remains the architectural source of truth; this document tracks execution against it._
