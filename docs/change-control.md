# Change-Control Checklist for Shared Backend Contracts

This document defines the required steps before making changes that cross the
shared package / app boundary. These checks exist to prevent contract drift
between the codebase and the live Supabase backend.

---

## 1. Adding a Permission Slug Constant to `@repo/contracts`

- [ ] Confirm the slug exists in `apps/web/supabase-target/supabase/migrations/` (grep for it)
- [ ] Confirm it is NOT already documented in `packages/contracts/MISMATCHES.md` as an intentional gap
- [ ] Add the constant to `packages/contracts/src/permissions.ts`
- [ ] Add the type to the `PermissionSlug` union
- [ ] Add it to `ALL_PERMISSION_SLUGS`
- [ ] Update the count comment at the top of `permissions.ts`
- [ ] Run `pnpm --filter contracts run check-types`
- [ ] Run `pnpm --filter web run check-types` and `pnpm --filter mobile run check-types`
- [ ] If the slug was previously listed in `MISMATCHES.md`, remove that entry

---

## 2. Changing a Shared Type Signature

Types in `@repo/contracts`, `@repo/auth`, `@repo/domain`, or `@repo/supabase` are
consumed by both `apps/web` and `apps/mobile`. Changes must not silently break consumers.

- [ ] Identify all consumers (search for the type name across `apps/` and `packages/`)
- [ ] If it is a breaking change (field removed, field type narrowed), update all consumers first
- [ ] If it is an additive change (new optional field), verify consumers compile before and after
- [ ] Run `check-types` on all affected packages:
  ```
  pnpm --filter contracts run check-types
  pnpm --filter auth run check-types
  pnpm --filter domain run check-types
  pnpm --filter supabase run check-types
  pnpm --filter web run check-types
  pnpm --filter mobile run check-types
  ```
- [ ] If the change affects `TokenRole` or JWT claims structure, confirm with the backend
      team that the access token hook produces this shape

---

## 3. Adding a New Shared Package

- [ ] Verify it has no `next/*` or `expo-*` imports
- [ ] Verify at least two concrete consumers exist (or a clear near-term plan for both)
- [ ] Add a `package.json` with `"name": "@repo/<name>"` and the workspace `exports` map
- [ ] Add a `CLAUDE.md` in the package root with boundary rules (see existing packages as templates)
- [ ] Add a `tsconfig.json` extending `@repo/typescript-config/base.json`
- [ ] Register the package in the root `pnpm-workspace.yaml` if not already covered by `packages/*`
- [ ] Add the package to `docs/package-ownership.md` under Package Inventory
- [ ] Run `pnpm install` to link the workspace package
- [ ] Run `check-types` on all consumers

---

## 4. Regenerating `@repo/supabase` Database Types

The `packages/supabase/src/database.types.ts` file is generated from the live Supabase schema.
It must be kept in sync when tables, columns, RPCs, or enum values change.

- [ ] Authenticate the Supabase CLI against the target project
- [ ] Run:
  ```bash
  cd apps/web
  supabase gen types typescript --project-id <target-ref> \
    > ../../packages/supabase/src/database.types.ts
  ```
- [ ] Review the diff — confirm the change reflects the intended schema modification only
- [ ] Run `check-types` on all consumers:
  ```
  pnpm --filter supabase run check-types
  pnpm --filter domain run check-types
  pnpm --filter web run check-types
  pnpm --filter mobile run check-types
  ```
- [ ] If new tables or RPCs are added that imply new permission slugs, follow checklist 1

---

## 5. Adding a Supabase RPC or Table That Shared Packages Reference

When a backend migration adds an RPC or table that needs to be called from `@repo/domain`
or referenced in `@repo/contracts`:

- [ ] Write and apply the migration first (in `apps/web/supabase-target/supabase/migrations/`)
- [ ] Regenerate types (checklist 4 above)
- [ ] If the RPC/table implies new permission slugs, seed those in the migration and follow checklist 1
- [ ] Update `packages/contracts/MISMATCHES.md` if the migration introduces constants that are
      not yet reflected in TypeScript (mark as a known gap with migration reference)
- [ ] Always create the local migration file before applying via Supabase MCP

---

## 6. Retiring a Shared Package Dependency

Before removing a package dependency from an app:

- [ ] Confirm no remaining imports of that package in the app
- [ ] Run `check-types` to confirm no residual type usage
- [ ] Remove from `package.json` and run `pnpm install`
- [ ] If the package itself is being deprecated, update `docs/package-ownership.md`
