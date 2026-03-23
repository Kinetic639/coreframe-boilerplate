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

## Mismatch Severity and Escalation Policy

Finding a mismatch during verification requires a decision about how urgently to act.
This section defines severity levels and release-gate rules so that every mismatch
has a consistent, documented disposition.

### Severity Levels

| Severity                   | Definition                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 — Blocker**           | A TypeScript constant references a slug that exists in neither the target DB nor the legacy DB. Any code using it will silently fail or produce wrong behavior at runtime.                |
| **S2 — High**              | A slug exists in the target DB but has no corresponding TypeScript constant. Code must use a raw string as a workaround, losing type-safety and refactorability.                          |
| **S3 — Medium**            | A slug exists in the legacy DB but not in the target DB. The TypeScript constant is correct for legacy but will produce silent failures on the target project until it is migrated.       |
| **S4 — Low / Intentional** | Grouping arrays (e.g., `FREE_PLAN_MODULES`) diverge from live plan data. Runtime entitlements are the authoritative source, so this is not a behavioral bug — just misleading TypeScript. |

### Release Gate Rules

**S1 — Must be resolved before any release.**
Do not commit or ship code that uses a constant with no DB backing.
Action: either remove the constant, or add a migration that seeds the slug.

**S2 — Should be resolved in the next extraction cycle.**
The gap is in the DB (which is correct) but absent from TypeScript. No runtime bug exists today
for code that doesn't reference the missing constant. If in-flight feature code requires the
missing constant, promote to S1 and resolve immediately.
Action: open a task. Document in `MISMATCHES.md` until resolved.

**S3 — Must be resolved before the target DB becomes the sole production environment.**
The code references something that only exists in legacy. Until the target migration is applied,
this is a latent bug in the target project.
Action: document in `MISMATCHES.md` with a note tying it to the legacy→target migration timeline.
Do not block the current release unless the target project is already live for affected users.

**S4 — Does not gate any release.**
Grouping arrays are used for display logic or documentation, not authorization. Runtime
entitlements from the DB are the authoritative source of module access.
Action: document in `MISMATCHES.md` and revisit when plan data stabilizes.

### Classification of Current Open Mismatches

| Mismatch(es)                                   | Category                                    | Severity |
| ---------------------------------------------- | ------------------------------------------- | -------- |
| M-6 to M-11 (missing wildcard constants)       | In target DB; absent from TypeScript        | **S2**   |
| M-12 to M-15 (missing module-access constants) | In target DB; absent from TypeScript        | **S2**   |
| M-16 to M-18 (legacy-only permissions)         | In legacy DB only; absent from target       | **S3**   |
| M-1 to M-5 (module grouping drift)             | Grouping arrays diverge from live plan data | **S4**   |

No S1 mismatches currently exist. If a new verification pass finds a slug in TypeScript with
no DB backing, treat it as S1 and act before the next release.

### Escalation Path

1. During a verification pass, classify each new finding using the table above.
2. S1: block the current branch immediately; do not merge until resolved.
3. S2/S3: add to `MISMATCHES.md` under the correct category; open a follow-up task with the severity label.
4. S4: add to `MISMATCHES.md`; no task required unless the divergence causes visible product confusion.
5. After `MISMATCHES.md` is updated, re-check internal consistency (Step 5 in the verification process above).

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
