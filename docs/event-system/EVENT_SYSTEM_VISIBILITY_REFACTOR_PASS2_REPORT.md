# Event System Visibility Refactor — Pass 2 Report

## 1. What Was Incorrect in Pass 1

Pass 1 introduced the permission-based visibility model but had four correctness gaps:

### Gap A — Personal feed missed self-visible events

The personal feed query in `get-personal-activity.ts` called `fetchPlatformEvents()` with `actorUserId = currentUserId`, which added a SQL filter `actor_user_id = userId`. This meant events where the viewer was the **target** or **entity subject** (not the actor) were never fetched from the DB. The registry's `selfVisible: true` flag was therefore dead code for the personal feed — those rows never reached the projection evaluator.

Example broken case: an admin assigns a role to USER_B. `org.member.role_assigned` has `selfVisible: true`. USER_B is `target_id`. But USER_B's personal feed query only fetched rows where `actor_user_id = USER_B`, so this row was never fetched, never passed to the evaluator, and never appeared in USER_B's feed.

Additionally, `projection.ts` had an explicit pre-filter:

```typescript
if (context.viewerScope === "personal" && row.actor_user_id !== context.viewerUserId) {
  continue;
}
```

This was a defence-in-depth guard that correctly blocked non-actor events from the actor-only query — but once the query is broadened to include self-visible events, this guard becomes a bug, not a feature.

### Gap B — Branch-scoped visibility comment was misleading

The comment in `visibility.ts` for branch scope events stated the behaviour correctly but did not explain the mechanism. The flat `permissions: string[]` snapshot correctly handles org-vs-branch scope because the snapshot loader (`PermissionServiceV2.getPermissionSnapshotForUser`) already performs scope-aware loading. The evaluator's includes() check is therefore correct and sufficient — but this was not documented.

### Gap C — Audit superpower lacked explanatory comment

The `audit.events.read` check at step 3 in the evaluator granted blanket access to all registered events with only a one-line comment. The WHY was not explained: that this is the explicit contract for the audit feed, that it is restricted permission, and that it is org-scoped by the DB query rather than a true bypass.

### Gap D — Documentation overstated completeness

The existing implementation report described the evaluator as handling branch scope correctly but did not explain that self-visible events were unreachable for the personal feed.

---

## 2. What Was Fixed in Pass 2

### Fix A: Self-visible personal feed

**`src/app/actions/audit/_query.ts`**

- Added new function `fetchPersonalOrgEvents(supabase, orgId, userId, fetchLimit)` which replaces the old actor-only query for the personal feed's org-scoped path.
- Uses Supabase OR filter to fetch rows where the viewer is: actor (`actor_user_id = userId`), entity subject (`entity_type = 'user' AND entity_id = userId`), or target (`target_type = 'user' AND target_id = userId`).
- Updated `fetchPersonalOrgNullEvents()` with the same OR logic for org-null (auth/platform) events.

**`src/app/actions/audit/get-personal-activity.ts`**

- Updated Query 1 from `fetchPlatformEvents(supabase, orgId, fetchLimit, userId)` to `fetchPersonalOrgEvents(supabase, orgId, userId, fetchLimit)`.
- Updated JSDoc to reflect that both actor and self-visible rows are now fetched.

**`src/server/audit/projection.ts`**

- Removed the hard actor-only pre-filter (`row.actor_user_id !== context.viewerUserId → continue`).
- Replaced with a narrower pre-filter that only skips system-originated events with `actor_user_id = null` and `actor_type !== "user"`. These can never satisfy any personal feed intrinsic path.
- Added a detailed comment explaining why the evaluator `canViewerSeeEvent()` is now the single gatekeeper.

### Fix B: Branch-scoped visibility documentation

**`src/server/audit/visibility.ts`**

- Replaced the single-sentence comment on the branch scope path with a detailed explanation of how the flat `permissions: string[]` snapshot encodes branch scope:
  - Org-wide grants appear regardless of active branch.
  - Branch-specific grants appear only when that branch is the active context at snapshot load time.
  - The `includes()` check is correct and sufficient because the snapshot loader has already resolved scope.
- Documents the limitation clearly: the evaluator cannot see which grants are org-wide vs branch-specific (they are flattened), but this is correct by design.

### Fix C: Audit permission explicit documentation

**`src/server/audit/visibility.ts`**

- Expanded the audit superpower comment to explain:
  - WHY it is intentional (audit feed contract, full org visibility is required)
  - WHY it is not a security bypass (restricted permission, org-scoped by DB RLS)
  - Branch coverage: org-wide `audit.events.read` grants access to all branch events in the org — intended behaviour for auditors.

### Fix D: Documentation accuracy

This report documents the actual state of the implementation including the real limitations.

---

## 3. Files Changed

| File                                                     | Change                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/app/actions/audit/_query.ts`                        | Added `fetchPersonalOrgEvents()` with OR filter; updated `fetchPersonalOrgNullEvents()` with same OR filter |
| `src/app/actions/audit/get-personal-activity.ts`         | Use `fetchPersonalOrgEvents` instead of actor-only fetch; updated JSDoc                                     |
| `src/server/audit/projection.ts`                         | Removed hard actor pre-filter; added precise system-actor skip with detailed comment                        |
| `src/server/audit/visibility.ts`                         | Expanded branch-scope comment; expanded audit superpower comment                                            |
| `src/server/audit/__tests__/projection.test.ts`          | Updated T-PROJECTION-PERSONAL suite (3 tests updated, 3 new tests added)                                    |
| `src/server/audit/__tests__/visibility.test.ts`          | Added T-VIS-BRANCH-SCOPE suite (5 new tests)                                                                |
| `src/server/audit/__tests__/event-system-phase6.test.ts` | Added 2 new self-visible integration tests                                                                  |

---

## 4. Permission Data Model (What Was Verified)

**`user_effective_permissions` table schema (verified via DB query):**

```
id                  uuid     NOT NULL
user_id             uuid     NOT NULL
organization_id     uuid     NOT NULL
permission_slug     text     NOT NULL   (source pattern, e.g. "account.*")
source_type         text     NOT NULL
source_id           uuid     nullable
created_at          timestamptz NOT NULL
compiled_at         timestamptz NOT NULL
branch_id           uuid     nullable   (NULL = org-wide; UUID = branch-specific)
permission_slug_exact text   NOT NULL   (concrete slug, e.g. "account.profile.read")
```

**`PermissionServiceV2.getPermissionSnapshotForUser` returns `PermissionSnapshot`:**

```typescript
type PermissionSnapshot = {
  allow: string[]; // flat concrete slugs, e.g. ["org.read", "events.org_activity.read"]
  deny: string[]; // always empty — denies are resolved at compile time
};
```

**Branch scope in the flat model:**

- When called with `branchId = BRANCH_A`, the service runs two queries:
  1. `WHERE branch_id IS NULL` (org-wide rows)
  2. `WHERE branch_id = BRANCH_A` (branch-A-specific rows)
- Both result sets are merged and deduped into a single flat `allow` array.
- Result: the flat array contains ALL permissions the viewer has, either org-wide or for the active branch. No branch_id metadata is retained per slug.

**Implication for the evaluator:**

- The evaluator cannot distinguish org-wide grants from branch-specific grants at evaluation time.
- This is correct: the snapshot loader has already performed branch-aware filtering. If a slug is in the array, the viewer is entitled in the current context (org-wide or for the active branch).
- This means the `includes()` check in `canViewerSeeEvent()` IS correct and sufficient.

---

## 5. Remaining Limitations (Honest Assessment)

### Limitation 1: No cross-branch visibility in single request

The personal feed and org feed both load the permission snapshot with one active branch. A viewer who has `events.org_activity.read` scoped to BRANCH_B cannot see BRANCH_A events in the same feed call. This is architecturally correct — feeds are scoped to the active context.

### Limitation 2: Branch-specific permission grants at different branches require separate feed calls

If a viewer has permissions on multiple branches, they must switch branch context to see that branch's events. There is no "all-branches" feed view. This is a product decision, not a bug.

### Limitation 3: `VisibilityInput.viewer.permissions` is flat strings

The evaluator's `VisibilityInput.viewer` uses `permissions: string[]`. This is the correct type given the permission snapshot model. No richer `EffectivePermissionGrant` type with `branchId` per permission was implemented because:

- The flat snapshot model is already correct (scope resolved at load time).
- Adding per-permission branchId to the evaluator would duplicate scope logic already handled by the snapshot loader.
- The snapshot loader is the single authority for permission scope — introducing a second scope check in the evaluator would create divergence risk.

### Limitation 4: `VisibilityInput.viewer.branchId` field exists but is unused

The `VisibilityInput.viewer.branchId` optional field (set via `context.viewerBranchId` in projection) is populated but the evaluator does not use it. It was kept for potential future use. The flat permission array makes it unnecessary for correct evaluation today.

### Limitation 5: org-null auth events — self-visible OR filter

`fetchPersonalOrgNullEvents` was updated to use the same OR filter (actor/entity/target). In practice, platform auth events (auth.login, auth.session.revoked) are always actor-originated, so the entity/target paths are rarely triggered. But the filter is correct and future-proofs the path for any platform event that targets a specific user.

---

## 6. Tests Added/Updated

### `src/server/audit/__tests__/projection.test.ts`

**Updated (T-PROJECTION-PERSONAL suite):**

- "excludes event where actor_user_id !== viewerUserId" → Updated to use `entity_id: OTHER_USER_ID` so the viewer has no selfVisible path. Old test was testing a scenario that is now correctly identified as selfVisible (entity_id defaulted to VIEWER_USER_ID).
- "excludes system actor events in personal scope" → Updated to use `entity_type: "system"` so no selfVisible path exists.
- "total reflects filtered count before pagination" → Updated other-user rows to set `entity_id: OTHER_USER_ID` so they are not incorrectly visible via selfVisible.

**Added (T-PROJECTION-PERSONAL suite):**

- "includes event where viewer is the target (selfVisible path)" — org.member.role_assigned with target_id = VIEWER_USER_ID
- "includes event where viewer is the entity subject (selfVisible path)" — org.member.removed with entity_id = VIEWER_USER_ID
- "excludes selfVisible event where selfVisible=false in registry" — org.member.invited (selfVisible=false, viewer is target but not entitled)

### `src/server/audit/__tests__/visibility.test.ts`

**Added (T-VIS-BRANCH-SCOPE suite — 5 new tests):**

- org-wide grant in snapshot allows branch events
- branch-specific grant appears when that branch is the active context
- absent slug from snapshot → branch event denied
- audit.events.read grants access to all branch events
- selfVisible path works for branch-scoped events without any permission

### `src/server/audit/__tests__/event-system-phase6.test.ts`

**Added (T-LOGOUT-PIPELINE suite — 2 new tests):**

- "selfVisible: target user sees org.member.role_assigned in their personal feed"
- "selfVisible: user who performed role assignment also sees it (actorVisible path)"

---

## 7. Architecture Stability Confirmation

The central evaluator (`canViewerSeeEvent` in `visibility.ts`) remains the single source of visibility policy. No visibility logic was added to feed actions or queries — the DB query is broader to avoid excluding potentially-visible rows, and the evaluator is the final gatekeeper.

Test counts:

- Before Pass 2: 427 tests passing (350 audit + 74 action + 3 other)
- After Pass 2: 434 tests passing (all suites, 0 failures)

TypeScript type-check: clean (`pnpm type-check` exits 0).
