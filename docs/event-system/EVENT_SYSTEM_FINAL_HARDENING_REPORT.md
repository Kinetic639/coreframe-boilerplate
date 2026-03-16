# Event System Final Hardening Report

**Date**: 2026-03-16
**Branch**: `event-system`
**Pass scope**: Correctness fixes, documentation accuracy, safety improvements, test coverage

---

## 1. Scope of Hardening Pass

This pass covered:

- **Correctness fixes** (2): project ID in extraction doc; actor type bug in `declineInvitationAction`
- **Documentation additions** (3): project ID replacements; module coverage section; append-only guarantee clarification section
- **Code improvements** (4): actor display enrichment; branch-aware filtering for org and audit feeds; new wiring test coverage; metadata normalization in event service
- **Pre-existing test fix** (1): event-system-phase6 correlation test used `auth.password.reset_requested` (auditor-only) in a personal-scope assertion — replaced with `auth.password.reset_completed` (self+auditor)

---

## 2. Files Changed

| File                                                                   | Change type                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION_VERIFIED.md` | Fix project ID (2 occurrences); add 2 new sections                             |
| `src/app/actions/organization/invitations.ts`                          | Fix `declineInvitationAction` actor bug                                        |
| `src/server/services/event.service.ts`                                 | Add `normalizeMetadata()` helper; apply after validation                       |
| `src/server/audit/actor-enrichment.ts`                                 | **New file** — batch actor UUID enrichment utility                             |
| `src/app/actions/audit/_query.ts`                                      | Add `validateBranchId()` helper; add `branchId` param to `fetchPlatformEvents` |
| `src/app/actions/audit/get-audit-feed.ts`                              | Wire enrichment + branch filter                                                |
| `src/app/actions/audit/get-org-activity.ts`                            | Wire enrichment + branch filter                                                |
| `src/app/actions/audit/get-personal-activity.ts`                       | Wire enrichment                                                                |
| `src/app/actions/__tests__/event-wiring.test.ts`                       | Add 3 new test cases                                                           |
| `src/server/audit/__tests__/event-system-phase6.test.ts`               | Fix pre-existing test bug                                                      |

---

## 3. Implemented Fixes

### Fix 1 — Project ID in extraction doc

`docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION_VERIFIED.md` referenced `zlcnlalwfmmtusigeuyk` (incorrect) in 2 places. Both replaced with `rjeraydumwechpjjzrus` (the authoritative TARGET project).

### Fix 2 — `declineInvitationAction` actor bug

**Before**: the action always emitted `actorType: "user"` regardless of whether the decliner was authenticated. This violated the architectural invariant that `actorType="user"` must never be emitted with `actorUserId=null`.

**After**: the action checks `decliningUser?.id`:

- Authenticated decline → `actorType: "user"`, `actorUserId: decliningUser.id`
- Unauthenticated token-based decline → `actorType: "system"`, `actorUserId: null`

### Fix 3 — Module coverage section

Added `## Current Module Coverage` section to extraction doc listing which modules are wired (auth, org-management) and which are explicitly out of scope for this phase (warehouse, teams, tools, home, support). This prevents the gap from being misread as a defect.

### Fix 4 — Append-only clarification

Added `## Append-Only Guarantee Clarification` section to extraction doc clarifying that the guarantee applies at the application layer (authenticated/anon roles have SELECT only), and that `service_role` retaining write access is standard Supabase behavior, not a weakness.

---

## 4. Implemented Improvements

### Improvement 1 — Actor display enrichment

**New file**: `src/server/audit/actor-enrichment.ts`

The projection layer previously returned raw UUIDs as `actor_display` for user actors. The enrichment utility resolves UUIDs to human-readable names after projection, before returning data to the caller.

Design:

- Single batched `SELECT id, first_name, last_name, email FROM public.users WHERE id IN (...)` — no N+1
- UUID detection via regex: only values matching UUID pattern are resolved
- Display priority: "First Last" > email > "User `<first-8-chars-of-uuid>`"
- Non-fatal: if enrichment fails for any reason, original projected events are returned unchanged
- Server-only (`import "server-only"`)
- Applied in all three feed actions after `projectEvents()` and before returning to caller

### Improvement 2 — Branch-aware filtering

`fetchPlatformEvents()` in `_query.ts` now accepts an optional `branchId?: string` parameter. When provided, a `WHERE branch_id = $branchId` filter is added to the query.

`validateBranchId()` helper (also exported from `_query.ts`) validates the value as a UUID before it is used as a filter, silently ignoring invalid strings. This prevents injection of arbitrary strings into query chains.

`getAuditFeedAction` and `getOrgActivityAction` now accept an optional `rawBranchId?: string` third parameter, validated server-side before use. Personal feed (`getPersonalActivityAction`) is intentionally excluded — user's own events are already actor-filtered and branch-narrowing is not needed.

Existing callers without `branchId` are unaffected: all new parameters are optional with no defaults that change existing behavior.

### Improvement 3 — New wiring test coverage

Three new test cases added to `src/app/actions/__tests__/event-wiring.test.ts`:

1. **`declineInvitationAction` (authenticated path)** — verifies `actorType: "user"` and `actorUserId: USER_ID` are emitted when `auth.getUser()` returns a user.
2. **`declineInvitationAction` (unauthenticated path)** — verifies `actorType: "system"` and `actorUserId: null` are emitted when `auth.getUser()` returns null (token-based link click).
3. **`resendInvitationAction` event key and actor attribution** — verifies `actionKey: "org.invitation.resent"`, `actorType: "user"`, `actorUserId: USER_ID`, correct entity/metadata shape.

All three follow the exact same mock/spy pattern established by the existing tests.

### Improvement 4 — Metadata normalization in event service

`normalizeMetadata()` private function added to `event.service.ts`. Applied after Zod validation passes, before the DB insert row is built.

Behavior:

- `JSON.parse(JSON.stringify(raw))` — strips `undefined` values (which JSON serialization drops silently), preserves `null`
- Returns `{}` if input is not an object
- Does not alter semantically valid payloads — validated data passes through unchanged

---

## 5. Verification Performed

| Verification                                                            | Result                                      |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| `pnpm vitest run src/app/actions/__tests__/event-wiring.test.ts`        | 74/74 passed                                |
| `pnpm vitest run src/server/audit/__tests__/`                           | 312/312 passed                              |
| `pnpm vitest run src/app/actions/audit/__tests__/`                      | 46/46 passed                                |
| `pnpm vitest run` (full suite)                                          | 1635/1635 passed, 8 skipped (live DB tests) |
| `pnpm type-check`                                                       | 0 errors                                    |
| Pre-existing phase6 test failure confirmed pre-existing (via git stash) | Fixed                                       |

---

## 6. Architecture Stability Confirmation

All changes were made within existing architectural boundaries:

- **SSR-first flow preserved**: enrichment and branch filtering are in server actions only
- **Server-only boundaries intact**: `actor-enrichment.ts` uses `import "server-only"`; no client code paths touched
- **Event projection remains server-side**: enrichment is a post-projection step in server actions, not in the projection layer itself
- **No N+1 queries**: actor enrichment uses a single batched IN query per feed call
- **No schema changes**: no DB migrations, no RLS changes, no table modifications
- **No registry changes**: event-registry.ts unchanged
- **No action key changes**: all 22 action keys unchanged
- **No permission changes**: permission checks unchanged
- **Typing preserved or strengthened**: all new parameters are typed; no `any` broadening added
- **Mode B untouched**: no forensic DB-side emission code added or removed

---

## 7. Remaining Roadmap Items

The following items were explicitly kept out of scope for this pass:

| Item                                                      | Status                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Warehouse module event wiring                             | Future phase — not started                                                                                                                   |
| Teams module event wiring                                 | Future phase — not started                                                                                                                   |
| Tools module event wiring                                 | Future phase — not started                                                                                                                   |
| Home / Support module event wiring                        | Future phase — not started                                                                                                                   |
| Mode B (atomic DB-side emission via security-definer RPC) | Not implemented — design exists in README                                                                                                    |
| Branch filter for personal feed                           | Not added — actor-filtered personal feed has no branch-narrowing use case at this time                                                       |
| Actor enrichment in summary template generation           | Not added — enrichment is post-projection; summary templates use raw UUID placeholder from projection layer (acceptable for current UX tier) |
| Pagination cursor strategy (replace offset/limit)         | Not changed — offset/limit is sufficient for current event volumes                                                                           |
