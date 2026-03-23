# Verification Workflow: Permission and Module Constants vs. Supabase

This document defines when and how to verify that the TypeScript constants in
`@repo/contracts` are consistent with the live Supabase target database.

The authoritative record of known mismatches is `packages/contracts/MISMATCHES.md`.

---

## When to Re-Verify

Re-run this workflow when any of the following occur:

- A Supabase migration is applied that adds or modifies `permissions` rows
- A Supabase migration changes `enabled_modules` in `subscription_plans` or `organization_entitlements`
- A constant is added or modified in `@repo/contracts`
- `MISMATCHES.md` is referenced in a PR review and you want to confirm it is current
- Before a production release involving permission-gated features

---

## Sources of Truth

| Source                           | Location                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| Target DB permission seeds       | `apps/web/supabase-target/supabase/migrations/*permission*` |
| Target DB plan/entitlement seeds | `apps/web/supabase-target/supabase/migrations/*seed*`       |
| Target DB hardening migrations   | `apps/web/supabase-target/supabase/migrations/*harden*`     |
| TypeScript permission constants  | `packages/contracts/src/permissions.ts`                     |
| TypeScript module constants      | `packages/contracts/src/modules.ts`                         |
| Known mismatches                 | `packages/contracts/MISMATCHES.md`                          |

The legacy DB (`apps/web/supabase/migrations/`) is secondary — mismatches that exist only
in legacy and not in target are documented in `MISMATCHES.md` Category 2.

---

## Step-by-Step Verification Process

### 1. Extract all permission slugs from target migrations

```bash
grep -rh "slug" apps/web/supabase-target/supabase/migrations/ \
  | grep -oP "'[a-z][a-z_./*-]*\.[a-z][a-z_./*-]*'" \
  | sort -u
```

For a more focused search, look at permission-specific migrations:

```bash
grep -h "INSERT INTO.*permissions\|'[a-z][a-z_./*-]*'" \
  apps/web/supabase-target/supabase/migrations/*permission* \
  apps/web/supabase-target/supabase/migrations/*seed* \
  apps/web/supabase-target/supabase/migrations/*harden* \
  2>/dev/null | grep -oP "'\w[\w.*-]*\.\w[\w.*-]*'" | sort -u
```

### 2. Compare against TypeScript constants

Open `packages/contracts/src/permissions.ts` and manually cross-reference each slug
from step 1 against the constants defined there.

For each DB slug:

- **Found in TypeScript** → no action needed
- **Not found in TypeScript** → check if already documented in `MISMATCHES.md`
  - Already there → no action (known gap)
  - Not there → add a new mismatch entry (see format below)

For each TypeScript constant:

- **Found in target DB** → no action needed
- **Found only in legacy DB** → should be documented as Category 2 in `MISMATCHES.md`
- **Found in neither DB** → serious gap; flag for immediate investigation

### 3. Verify module constants

```bash
grep -h "enabled_modules" \
  apps/web/supabase-target/supabase/migrations/*seed* \
  apps/web/supabase-target/supabase/migrations/*plan* \
  2>/dev/null | grep -oP '"[a-z][a-z-]*"' | sort -u
```

Compare against `packages/contracts/src/modules.ts`. Check:

- Are `FREE_PLAN_MODULES`, `CORE_MODULES`, `PREMIUM_MODULES` arrays still accurate?
- Do any DB module slugs lack a TypeScript constant?

### 4. Update `MISMATCHES.md`

When a new mismatch is found, add it to the appropriate category:

```markdown
### M-<next-number> — `<slug>`

- **Target DB**: seeded in `<migration-filename>`
- **Code**: no `<CONSTANT_NAME>` constant
- **Impact**: <description of what code cannot do without this constant>
```

When an existing mismatch is resolved (constant added to TypeScript), remove the entry.

### 5. Confirm internal consistency

After updating `MISMATCHES.md`:

- Verify the document still accurately references migration filenames
- Confirm the count in `permissions.ts` header comment is still correct
- Confirm the RLS invariants test (`src/lib/constants/__tests__/rls-permission-invariants.test.ts`)
  still reflects the correct number of wildcards in `ALL_PERMISSION_SLUGS`

---

## Current Known State (as of 2026-03-23)

Last full verification: 2026-03-21 (Phase 1 extraction) + re-verified 2026-03-23 (Phase 6 hardening).

**Re-verification finding (2026-03-23):** The corrective migrations
(`20260323000016` through `20260323000018`) added no new permission slugs.
`MISMATCHES.md` is current and accurate as of this date.

**Open mismatches:** M-6 through M-18. See `MISMATCHES.md` for detail.

**Corrective migrations confirmed as no new slugs:**

- `20260323000016_target_corrective_p7_compile_trigger_fix.sql`
- `20260323000017_target_corrective_p8_plan_update_cascade.sql`
- `20260323000018_target_corrective_p9_trigger_dedup.sql`

---

## No Automation in This Phase

Automating the comparison would require parsing both SQL migration files and TypeScript
at the same time. This is feasible as a CI check but is out of scope for the current phase.

The manual process above is precise enough to be followed consistently without judgment calls.
When automation is introduced, this document should be updated to reference the script.
