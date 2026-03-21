# @repo/contracts — Known Mismatches vs. Target Database

This file documents discrepancies between the TypeScript constants in this package
and the authoritative target Supabase database state (as of 2026-03-21).

**These mismatches are intentional — they are preserved as-is from `apps/web`.**
Reconciling them requires coordinated DB + code changes and is out of scope for this extraction.

---

## Permissions Mismatches

### M-6 — `branches.*` wildcard not in TypeScript constants

- **DB** (`supabase-target/.../20260323000010_target_harden_p1_permission_seeds.sql`): has `branches.*` wildcard row in `permissions` table
- **Code**: No `BRANCHES_WILDCARD` constant. Only individual slugs (`branches.create`, etc.) are defined.
- **Impact**: Wildcard cannot be referenced type-safely. Wildcards assigned via DB seed work at runtime.

### M-7 — `invites.*` wildcard not in TypeScript constants

- **DB**: has `invites.*` wildcard row in `permissions` table
- **Code**: No `INVITES_WILDCARD` constant.
- **Impact**: Same as M-6.

### M-8 — `members.*` wildcard not in TypeScript constants

- **DB**: has `members.*` wildcard row in `permissions` table
- **Code**: No `MEMBERS_WILDCARD` constant.
- **Impact**: Same as M-6.

### M-9 — `org.*` wildcard not in TypeScript constants

- **DB**: has `org.*` wildcard row in `permissions` table
- **Code**: No `ORG_WILDCARD` constant.
- **Impact**: Same as M-6.

### M-10 — `self.*` wildcard not in TypeScript constants

- **DB**: has `self.*` wildcard row in `permissions` table
- **Code**: No `SELF_WILDCARD` constant.
- **Impact**: Same as M-6.

### M-11 — `tools.*` wildcard not in TypeScript constants

- **DB**: has `tools.*` wildcard row in `permissions` table
- **Code**: No `TOOLS_WILDCARD` constant.
- **Impact**: Same as M-6.

---

## Modules Mismatches

### M-1 — `FREE_PLAN_MODULES` does not match target free plan seed

- **DB** (`20260320000011_target_p3_b3_seed.sql`): free plan `enabled_modules = ["organization-management", "home", "support", "tools"]`
- **Code** (`FREE_PLAN_MODULES`): `[home, warehouse, teams, organization-management, support, user-account, contacts, documentation]`
- **Impact**: `entitlements.hasModule()` checks using `FREE_PLAN_MODULES` as a reference set will diverge from live plan data. Live entitlements are the authoritative source at runtime.

### M-2 — `MODULE_WAREHOUSE` not in target free plan

- **DB**: `warehouse` is a paid-tier module in target; not in free plan.
- **Code**: Listed in `FREE_PLAN_MODULES` and `CORE_MODULES`.
- **Impact**: Code treats warehouse as universally available; target DB restricts it.

### M-3 — `MODULE_TEAMS` not in target free plan

- **DB**: `teams` is paid-tier in target.
- **Code**: Listed in `FREE_PLAN_MODULES` and `CORE_MODULES`.
- **Impact**: Same as M-2.

### M-4 — `MODULE_CONTACTS` and `MODULE_DOCUMENTATION` have no DB counterpart

- **DB**: Neither `contacts` nor `documentation` appears in any target subscription plan seed.
- **Code**: Both listed in `FREE_PLAN_MODULES`.
- **Impact**: These modules may be legacy or unreleased. `entitlements.hasModule()` for these will always return false on target.

### M-5 — `MODULE_USER_ACCOUNT` not in target plan data

- **DB**: `user-account` does not appear in target plan `enabled_modules`.
- **Code**: Listed in `FREE_PLAN_MODULES` and `CORE_MODULES`.
- **Impact**: Module access will not be granted through entitlements on target. May rely on a different access mechanism.

---

## Notes

- Mismatches M-1 through M-5 were present in `apps/web/src/lib/constants/modules.ts` before extraction.
- Mismatches M-6 through M-11 were present in `apps/web/src/lib/constants/permissions.ts` before extraction.
- No constants were added, removed, or modified during extraction — content is verbatim from source.
- The RLS contract test (`apps/web/src/lib/constants/__tests__/rls-permission-invariants.test.ts`) validates
  that `ALL_PERMISSION_SLUGS` contains exactly three wildcards (`account.*`, `module.*`, `superadmin.*`).
  This invariant holds with the extracted constants.
