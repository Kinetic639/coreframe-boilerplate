# Release and Rollback Guidance for Shared Package Extractions

This document defines the checklist for safely introducing new shared package extractions,
the triggers that should cause a rollback, and how to execute one.

---

## Before Extracting a New Shared Package

### 1. Confirm the extraction is justified

- [ ] The code is used (or will imminently be used) by more than one app
- [ ] The code is platform-neutral — no `next/*`, `expo-*`, or Supabase runtime client imports
- [ ] The code performs no I/O (no DB queries, HTTP calls, cookie access, storage reads)
- [ ] There is no simpler way to share the code (e.g., a single type or constant belongs in `@repo/contracts`, not a new package)

### 2. Pre-extraction verification

- [ ] Run `check-types` on `apps/web` before touching anything (establishes a clean baseline)
- [ ] Run `check-types` on `apps/mobile` before touching anything
- [ ] Confirm the code to extract has no hidden dependency on app runtime (check all imports transitively)
- [ ] If the code references backend contracts (permission slugs, module slugs, DB types), verify them against `MISMATCHES.md` and the migration files before extracting

### 3. Extraction steps

- [ ] Create the package with a `package.json`, `tsconfig.json`, `src/index.ts`, and `CLAUDE.md`
- [ ] Move (do not copy) the code — delete the original after confirming consumers compile
- [ ] Update all import paths in all consumers
- [ ] Run `pnpm install` to link the workspace package
- [ ] Run `check-types` on the new package and all consumers
- [ ] Run lint on the new package
- [ ] Add the package to `docs/package-ownership.md`

### 4. Post-extraction validation

- [ ] `apps/web` check-types passes with no new errors
- [ ] `apps/mobile` check-types passes with no new errors (if it consumes the package)
- [ ] Web app still builds (`pnpm --filter web run build` or equivalent)
- [ ] No behavioral changes to the web app — extraction must be pure structural refactoring

---

## Rollback Triggers

Roll back a package extraction immediately if any of the following occur:

| Trigger                                                                         | Why                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/web` check-types fails after extraction                                   | Import paths or type exports broken               |
| `apps/web` build fails                                                          | Hidden runtime dependency was extracted           |
| `apps/mobile` check-types fails                                                 | Package exports incompatible with mobile tsconfig |
| Metro bundler fails to resolve the package                                      | Export map or module resolution issue             |
| Web runtime behavior changes (e.g., server action fails at runtime)             | Extraction introduced a side effect               |
| `SUPABASE_SERVICE_ROLE_KEY` or `createServiceClient` appears in the new package | Security boundary violation                       |

---

## How to Roll Back a Package Extraction

1. **Revert the package creation** — remove the new `packages/<name>/` directory
2. **Restore the original import paths** in all consumers — revert to `@/` or app-local paths
3. **Run `pnpm install`** — cleans up the workspace symlink
4. **Run `check-types` on all apps** — confirm the baseline is restored
5. **Run the web app build** — confirm no residual import errors
6. **Document why the extraction failed** — add a note to `docs/package-ownership.md` under
   the section for that code, so future attempts have context

---

## Schema Change Propagation

When a Supabase migration adds or changes tables, columns, RPCs, or enums:

1. **Apply the migration** to the target project (via Supabase MCP or CLI)
2. **Always create the local migration file** in `apps/web/supabase-target/supabase/migrations/`
   before applying. Never apply without a local file.
3. **Regenerate types** — follow checklist 4 in `docs/change-control.md`
4. **Run `check-types`** on `@repo/supabase`, `@repo/domain`, `apps/web`, `apps/mobile`
5. **If new permission slugs were added**, re-run the verification workflow (`docs/verification-workflow.md`)
   and update `MISMATCHES.md` if needed
6. **If existing column types changed**, audit all server services and server actions in `apps/web`
   that query those columns

---

## Phased Extraction Principle

Each extraction should be a single PR that can be reviewed, merged, and if necessary
reverted independently. Avoid bundling an extraction with a feature change.

Rule: **Structure changes and behavior changes are separate commits.**

If you cannot separate the extraction from the behavior change without breaking something,
the code is not ready to be extracted yet.

---

## Known Deferred Functional Follow-Ons (from Phase 5)

The following items were deferred from Phase 5 and remain outstanding.
They are not blockers for the Phase 6 hardening pass, but must be addressed in a
subsequent mobile feature phase:

- `PermissionSnapshot` loading from the backend in `apps/mobile` (currently a null stub)
- `OrganizationEntitlements` loading in `apps/mobile`
- Org display name and org switcher in `apps/mobile`
- Branch context in `apps/mobile`
- Mobile test suite (`apps/mobile` has no test infrastructure yet)
- Product feature screens: inventory, workshop, VMI

These were recorded in Phase 5 as "deferred to Phase 6" informally, meaning deferred to
a later phase. They are not part of the Phase 6 hardening/governance slice but are
documented here as known follow-ons so they are not lost.
