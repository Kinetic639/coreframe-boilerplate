# Event System Visibility Refactor Report

## 1. Scope of Refactor

Replaced the `visibleTo: EventVisibilityScope[]` array model in the event registry with a structured, permission-based visibility model. The new model is evaluated by a central `canViewerSeeEvent()` function in `src/server/audit/visibility.ts`. The `projection.ts` layer delegates entirely to this evaluator instead of performing inline `visibleTo`-qualifier matching.

Scope boundaries:

- **In scope**: visibility model, permission constants, projection layer, test coverage
- **Out of scope**: DB schema (platform_events table unchanged), action keys, Mode B, warehouse/teams events

---

## 2. Old Model vs New Model

### Old model (`visibleTo` array)

```typescript
// event-registry.ts
"org.member.invited": {
  visibleTo: ["self", "org_admin", "auditor"],
  // ...
}

// projection.ts
const SCOPE_QUALIFIERS = {
  personal: ["self"],
  org: ["self", "org_member", "org_admin"],
  audit: ["self", "org_member", "org_admin", "auditor"],
};
const isVisible = entry.visibleTo.some(s => qualifiers.includes(s));
```

**Problems with old model:**

- Tied visibility to hardcoded role-like strings (`"org_admin"`) rather than permission slugs
- `ProjectionScope` ("personal"/"org"/"audit") was overloaded as a proxy for permission level
- No way to express scope (platform/organization/branch) separately from visibility
- Expansion of granularity required changing the `SCOPE_QUALIFIERS` table

### New model (permission-based)

```typescript
// types.ts — new types
export type EventScope = "platform" | "organization" | "branch";
export type EventVisibilityClass = "org_activity" | "org_sensitive" | "audit";
export const VISIBILITY_CLASS_PERMISSIONS = {
  org_activity: "events.org_activity.read",
  org_sensitive: "events.org_sensitive.read",
  audit: "audit.events.read",
};

// event-registry.ts — new fields on every entry
"org.member.invited": {
  scope: "organization",
  actorVisible: true,      // actor always sees their own events
  selfVisible: false,      // target not intrinsically visible here
  visibilityClass: "org_sensitive",
  // ...legacy visibleTo retained for backward compat
}

// visibility.ts — central evaluator
canViewerSeeEvent({ viewer, event, entry }): boolean
```

**Evaluation order in `canViewerSeeEvent()`:**

1. Unknown entry → deny
2. `actorVisible=true` AND `viewer.userId === event.actor_user_id` → allow
3. `selfVisible=true` AND `entity_id/target_id === viewer.userId` (type=user) → allow
4. `viewer.permissions.includes("audit.events.read")` → allow (audit superpower — full access)
5. `entry.visibilityClass` required permission → allow if present
6. → deny

---

## 3. Files Changed

| File                                                                      | Change                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/audit/types.ts`                                               | Added `EventScope`, `EventVisibilityClass`, `VISIBILITY_CLASS_PERMISSIONS`, new fields on `EventRegistryEntry`, `viewerBranchId` on `ProjectionContext` |
| `src/server/audit/event-registry.ts`                                      | Added `scope`, `actorVisible`, `selfVisible`, `visibilityClass` to all 22 entries; `visibleTo` retained as legacy                                       |
| `src/server/audit/visibility.ts`                                          | **Created** — central `canViewerSeeEvent()` evaluator                                                                                                   |
| `src/server/audit/projection.ts`                                          | Replaced `SCOPE_QUALIFIERS` + inline `visibleTo` check with `canViewerSeeEvent()` call                                                                  |
| `src/lib/constants/permissions.ts`                                        | Added `EVENTS_ORG_ACTIVITY_READ`, `EVENTS_ORG_SENSITIVE_READ` constants                                                                                 |
| `supabase/migrations/20260316120000_add_event_visibility_permissions.sql` | **Created** — inserts two new permission rows, grants to roles                                                                                          |
| `src/server/audit/__tests__/visibility.test.ts`                           | **Created** — 37 tests for the new evaluator                                                                                                            |
| `src/server/audit/__tests__/projection.test.ts`                           | Updated 7 tests to pass required permissions in contexts                                                                                                |
| `src/app/actions/__tests__/event-wiring.test.ts`                          | Updated `makeOrgContext` / `makeAuditContext` helpers + 2 inline contexts                                                                               |

**Files intentionally NOT changed:**

- `src/app/actions/audit/get-personal-activity.ts` — already passes `context.user.permissionSnapshot.allow`
- `src/app/actions/audit/get-org-activity.ts` — same
- `src/app/actions/audit/get-audit-feed.ts` — same
- `src/app/actions/audit/_query.ts` — DB query layer, no visibility logic

---

## 4. New Permission Slugs

| Slug                        | Constant                    | Granted to                |
| --------------------------- | --------------------------- | ------------------------- |
| `events.org_activity.read`  | `EVENTS_ORG_ACTIVITY_READ`  | `org_owner`, `org_member` |
| `events.org_sensitive.read` | `EVENTS_ORG_SENSITIVE_READ` | `org_owner`               |

`audit.events.read` already existed and was unchanged.

Migration: `supabase/migrations/20260316120000_add_event_visibility_permissions.sql`

---

## 5. Central Visibility Evaluator

File: `src/server/audit/visibility.ts`

```typescript
export function canViewerSeeEvent({ viewer, event, entry }: VisibilityInput): boolean;
```

Input:

```typescript
interface VisibilityInput {
  viewer: { userId: string | null; permissions: string[]; branchId?: string | null };
  event: PlatformEventRow;
  entry: EventRegistryEntry | null | undefined;
}
```

Key design decisions:

- **Audit superpower**: holding `audit.events.read` grants access to all registered events. This preserves the historical "audit scope = full access" contract.
- **Scope-aware evaluation**: platform/organization/branch scope fields exist on entries but the flat permission snapshot (already org/branch-scoped at load time) makes the scope check a no-op in practice — the DB has already enforced the right scope.
- **Null-safe**: `viewer.userId = null` is handled cleanly — intrinsic paths require a non-null userId.

---

## 6. Registry Changes

All 22 entries now have four new fields:

| Field             | Type                    | Purpose                                   |
| ----------------- | ----------------------- | ----------------------------------------- |
| `scope`           | `EventScope`            | Contextual scope of the event             |
| `actorVisible`    | `boolean`               | True → actor always sees their own event  |
| `selfVisible`     | `boolean?`              | True → subject (entity/target) sees event |
| `visibilityClass` | `EventVisibilityClass?` | Permission class required                 |

### Mapping applied

| Event group                                                                                                              | scope        | actorVisible | selfVisible | visibilityClass |
| ------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------ | ----------- | --------------- |
| auth.login, auth.password.reset_completed, auth.session.revoked                                                          | platform     | true         | true        | audit           |
| auth.login.failed, auth.password.reset_requested                                                                         | platform     | false        | false       | audit           |
| org.created, org.updated, org.invitation.accepted, org.onboarding.completed                                              | organization | true         | varies      | org_activity    |
| org.member.invited, org.invitation.cancelled/resent/declined, org.role.\*, org.member.removed/role_assigned/role_removed | organization | true         | varies      | org_sensitive   |
| org.branch.created, org.branch.updated                                                                                   | branch       | true         | false       | org_activity    |
| org.branch.deleted                                                                                                       | branch       | true         | false       | org_sensitive   |

The `visibleTo` array is retained on every entry as a legacy field for backward compatibility with the `event-registry.test.ts` contract suite (which validates `visibleTo` structure). The projection layer no longer reads it.

---

## 7. Projection Changes

File: `src/server/audit/projection.ts`

Removed:

- `SCOPE_QUALIFIERS` constant
- Inline `visibleTo.some(scope => qualifiers.includes(scope))` check

Added:

- Import of `canViewerSeeEvent` from `./visibility`
- `viewer` descriptor built from `context` at loop start
- Delegation to `canViewerSeeEvent({ viewer, event: row, entry })`

The personal-scope actor guard (`row.actor_user_id !== context.viewerUserId`) is retained as a defence-in-depth layer before calling the evaluator. The metadata stripping and ip/ua gating logic are unchanged — still driven by `context.viewerScope === "audit"`.

---

## 8. Feed Action Changes

No changes were required. The three feed actions already:

- Load `context.user.permissionSnapshot.allow` and pass it as `permissions` to `ProjectionContext`
- Gate on the appropriate permission before proceeding (`AUDIT_EVENTS_READ` for audit feed, `ORG_READ` for org feed)

The permission snapshot is org-scoped and already populated at context load time via `loadDashboardContextV2`.

---

## 9. Branch-Scoped Evaluation Behavior

Branch events (`scope: "branch"`) are evaluated identically to org events in practice. The permission snapshot passed to `ProjectionContext` is already computed for the viewer's active org and branch by `loadDashboardContextV2` — it contains both org-wide and branch-scoped grants as concrete slugs. The `includes()` check is therefore sufficient without additional branch-ID comparison in the evaluator.

The `viewerBranchId` field on `ProjectionContext` is defined for future use (e.g. filtering branch-scoped events to only the viewer's active branch) but is not evaluated by the current visibility evaluator.

---

## 10. Tests Added/Updated

### New: `src/server/audit/__tests__/visibility.test.ts`

37 tests across 6 suites:

- `T-VIS-DENY` — null/undefined entry always denied
- `T-VIS-ACTOR` — actor visibility (5 cases)
- `T-VIS-SELF` — self visibility via entity_id and target_id (5 cases)
- `T-VIS-PERMISSION` — permission class gating (7 cases)
- `T-VIS-SCOPE` — platform/org/branch scope (5 cases)
- `T-VIS-REAL` — spot-checks against actual registry entries (10 cases)

### Updated: `src/server/audit/__tests__/projection.test.ts`

7 tests updated to pass required permissions in `ProjectionContext`. Three new tests added:

- `org_activity events visible with events.org_activity.read permission`
- `org_sensitive events visible with events.org_sensitive.read permission`
- `org_sensitive event NOT visible to non-actor without org_sensitive permission`

### Updated: `src/app/actions/__tests__/event-wiring.test.ts`

- `makeOrgContext()` now includes `["events.org_activity.read", "events.org_sensitive.read"]`
- `makeAuditContext()` now includes `["audit.events.read"]`
- Two inline contexts updated: `auth.password.reset_requested` audit test and `org.invitation.declined` org test

**Final test count: 424 passing, 0 failing.**

---

## 11. Compatibility Notes

- **DB schema unchanged** — `platform_events` table not touched
- **Action keys unchanged** — all 22 registry keys identical
- **`visibleTo` retained** — the legacy field is still present on all registry entries so the contract test `event-registry.test.ts` continues to validate it
- **`ProjectionScope` type unchanged** — "personal"/"org"/"audit" still works as before
- **Feed actions unchanged** — all three already passed `permissions` to `ProjectionContext`; no functional changes needed
- **Actor enrichment unchanged** — `enrichActorDisplays()` operates post-projection, unaffected

---

## 12. Intentionally Deferred Items

- **Wildcard expansion in visibility evaluator** — currently the evaluator does a flat `includes()` check. If `org_owner` is granted `events.*` (wildcard), the compiler must expand it first. This is handled by the existing DB compile step, not by the evaluator.
- **`viewerBranchId` enforcement** — the field exists on `ProjectionContext` but is not used by the evaluator. Branch-scoped feed filtering is done at the DB query layer (`_query.ts`), not projection layer.
- **Warehouse/teams events** — not rolled out. The registry only covers auth and organization-management events.
- **Mode B** — not implemented. Mode A emission path unchanged.
