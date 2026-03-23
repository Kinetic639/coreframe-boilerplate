# @repo/contracts — Known Mismatches vs. Target Database

This file documents discrepancies between the TypeScript constants in this package
and the authoritative target Supabase database state (as of 2026-03-21).

**These mismatches are intentional — they are preserved as-is from `apps/web`.**
Reconciling them requires coordinated DB + code changes and is out of scope for this extraction.

**Scope of this report:**

- Source of truth for target DB: `apps/web/supabase-target/supabase/migrations/`
  (specifically `20260320000011_target_p3_b3_seed.sql` and `20260323000010_target_harden_p1_permission_seeds.sql`)
- Source of truth for legacy DB: `apps/web/supabase/migrations/`
- All 35 TypeScript constants were compared individually against both sources.

---

## Confirmed Matches (no action needed)

The following items were flagged as uncertain during the audit. They are confirmed present
in both the target DB seeds and TypeScript constants — they are NOT mismatches:

- `superadmin.*` — confirmed in `20260320000011_target_p3_b3_seed.sql`
- `superadmin.admin.read` — confirmed in `20260323000010_target_harden_p1_permission_seeds.sql`
- `superadmin.plans.read` — confirmed in `20260323000010_target_harden_p1_permission_seeds.sql`
- `superadmin.pricing.read` — confirmed in `20260323000010_target_harden_p1_permission_seeds.sql`

---

## Category 1 — In target DB, missing from TypeScript constants

These slugs are seeded in the target DB but have no corresponding constant in this package.

### M-6 — `branches.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `BRANCHES_WILDCARD` constant; only individual `branches.*` slugs are defined
- **Impact**: wildcard cannot be referenced type-safely from shared code

### M-7 — `invites.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `INVITES_WILDCARD` constant
- **Impact**: same as M-6

### M-8 — `members.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `MEMBERS_WILDCARD` constant
- **Impact**: same as M-6

### M-9 — `org.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `ORG_WILDCARD` constant
- **Impact**: same as M-6

### M-10 — `self.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `SELF_WILDCARD` constant
- **Impact**: same as M-6

### M-11 — `tools.*` wildcard

- **Target DB**: seeded in `20260323000010_target_harden_p1_permission_seeds.sql`
- **Code**: no `TOOLS_WILDCARD` constant
- **Impact**: same as M-6

### M-12 — `module.tools.access`

- **Target DB**: seeded in `20260320000011_target_p3_b3_seed.sql`
- **Code**: no constant; only `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` is defined for module-access slugs
- **Impact**: cannot reference `module.tools.access` type-safely; must use raw string

### M-13 — `module.warehouse.access`

- **Target DB**: seeded in `20260320000011_target_p3_b3_seed.sql`
- **Code**: no constant
- **Impact**: same as M-12

### M-14 — `module.teams.access`

- **Target DB**: seeded in `20260320000011_target_p3_b3_seed.sql`
- **Code**: no constant
- **Impact**: same as M-12

### M-15 — `module.home.access`

- **Target DB**: seeded in `20260320000011_target_p3_b3_seed.sql`
- **Code**: no constant
- **Impact**: same as M-12

---

## Category 2 — In TypeScript constants, absent from target DB

These slugs have TypeScript constants and active code usage, but are NOT present in
any target migration seed. They exist only in legacy migrations (`apps/web/supabase/`).

### M-16 — `audit.events.read` (legacy-only)

- **Code**: `AUDIT_EVENTS_READ = "audit.events.read"`, actively used in `src/server/audit/visibility.ts`
- **Legacy DB**: seeded in `apps/web/supabase/migrations/20260313000001_audit_events_read_permission.sql`
- **Target DB**: absent — not seeded in any target migration file
- **Impact**: this permission exists in the legacy project but has not been migrated to the target schema.
  Code using `AUDIT_EVENTS_READ` will not behave as expected on the target project until the slug is seeded.

### M-17 — `events.org_activity.read` (legacy-only)

- **Code**: `EVENTS_ORG_ACTIVITY_READ`, actively used in `src/server/audit/visibility.ts`
- **Legacy DB**: seeded in `apps/web/supabase/migrations/20260316120000_add_event_visibility_permissions.sql`
- **Target DB**: absent — not seeded in any target migration file
- **Impact**: same as M-16

### M-18 — `events.org_sensitive.read` (legacy-only)

- **Code**: `EVENTS_ORG_SENSITIVE_READ`, actively used in `src/server/audit/visibility.ts`
- **Legacy DB**: seeded in `apps/web/supabase/migrations/20260316120000_add_event_visibility_permissions.sql`
- **Target DB**: absent — not seeded in any target migration file
- **Impact**: same as M-16

---

## Category 3 — Module grouping mismatches

These mismatches are in the module constants, where the code's grouping arrays do not
reflect the live target subscription plan data.

### M-1 — `FREE_PLAN_MODULES` does not match target free plan

- **Target DB** (`20260320000011_target_p3_b3_seed.sql`): free plan `enabled_modules = ["organization-management", "home", "support", "tools"]`
- **Code**: `FREE_PLAN_MODULES = [home, warehouse, teams, organization-management, support, user-account, contacts, documentation]`
- **Impact**: any code that uses `FREE_PLAN_MODULES` as a reference set will diverge from live plan data. Live entitlements are the authoritative source at runtime.

### M-2 — `MODULE_WAREHOUSE` treated as free-tier in code

- **Target DB**: `warehouse` is paid-tier; not in free plan
- **Code**: listed in `FREE_PLAN_MODULES` and `CORE_MODULES`

### M-3 — `MODULE_TEAMS` treated as free-tier in code

- **Target DB**: `teams` is paid-tier; not in free plan
- **Code**: listed in `FREE_PLAN_MODULES` and `CORE_MODULES`

### M-4 — `MODULE_CONTACTS` and `MODULE_DOCUMENTATION` have no target DB counterpart

- **Target DB**: neither slug appears in any target plan `enabled_modules` seed
- **Code**: both listed in `FREE_PLAN_MODULES`
- **Impact**: these may be legacy or unreleased modules. `entitlements.hasModule()` will always return false on target.

### M-5 — `MODULE_USER_ACCOUNT` not in target plan data

- **Target DB**: `user-account` does not appear in target plan `enabled_modules`
- **Code**: listed in `FREE_PLAN_MODULES` and `CORE_MODULES`

---

## Notes

- No constants were added, removed, or modified during extraction — all content is verbatim from source.
- The RLS contract test (`apps/web/src/lib/constants/__tests__/rls-permission-invariants.test.ts`) validates
  that `ALL_PERMISSION_SLUGS` contains exactly three wildcards (`account.*`, `module.*`, `superadmin.*`).
  This invariant holds with the extracted constants. The six new target wildcards (M-6 to M-11)
  are not yet in `ALL_PERMISSION_SLUGS`, which is consistent with the current code behavior.
- M-12 to M-15 (module-specific access permissions) and M-16 to M-18 (legacy-only permissions)
  were identified after extraction by cross-referencing all target migration seeds. They were
  pre-existing gaps in `apps/web` before this extraction.
