# Next.js To Turborepo Migration Plan

## Purpose

This document describes the agreed migration strategy for turning the existing Next.js app into a stable Turborepo monorepo without breaking production.

The goal is not to "monorepo-ify everything at once".

The goal is:

- keep `apps/web` working as the production source of truth
- build `apps/mobile` in parallel
- extract only the parts that are truly ready to be shared
- centralize tooling and shared infrastructure gradually

This file is also intended to be used as context for Claude or other coding agents when asking for incremental migration work.

---

## Current Repo Shape

- `apps/web`
  The production Next.js app. This remains the source of truth for existing product behavior.
- `apps/mobile`
  The Expo mobile app. This can evolve in parallel with web.
- `apps/docs`
  Secondary docs/demo app.
- `packages/*`
  Shared packages area for extracted tooling, utilities, schemas, and later selected shared logic.

---

## Core Migration Principle

Do not move code just because it could be shared.

Move code only when:

- both web and mobile need it, or will need it very soon
- it is framework-agnostic enough to survive extraction
- its API is stable enough that moving it will reduce duplication instead of creating churn

For now:

- `apps/web` should stay operational and deployable
- `apps/mobile` should grow independently
- `packages/*` should only receive low-risk, high-confidence extractions

---

## Migration Phases

## Phase 0: Monorepo Foundation

Status: completed

What was done:

- the repo was converted into a real monorepo root
- Vercel was updated to build from `apps/web`
- Turbo now recognizes the web app as a workspace package
- production builds and deploys work
- mail sending with Resend works in production
- root-level `.mcp.json` and monorepo-safe `.gitignore` handling were set up

Why this phase mattered:

- without this, any further extraction work would have happened on unstable ground

---

## Phase 1: Tooling Consolidation

Status: completed

Goal:

- one repo-level quality/tooling setup
- no product logic moved yet

What was done:

- Husky moved to the monorepo root
- `lint-staged` moved to the monorepo root
- `apps/web` was switched to use shared ESLint config from `packages/eslint-config`
- `apps/web` was switched to use shared TS config from `packages/typescript-config`
- web-local hook ownership was removed

Important outcome:

- `apps/web` no longer owns Git hook behavior
- the repo root now owns pre-commit behavior

Notes:

- mobile still has Expo-specific lint/TS setup, which is acceptable for now
- root-level hook ownership is the important part

---

## Phase 2: Extract Pure Shared Code

Status: next

Goal:

- extract code that is safe, framework-agnostic, and low-risk

Best candidates:

- Zod schemas
- constants
- utility functions
- formatting helpers
- domain types
- validation logic

Good package destinations:

- `packages/lib`
- `packages/validation`
- optionally `packages/types`

Rules:

- if a file imports `next/*`, keep it in `apps/web`
- if a file depends on server actions, keep it in `apps/web`
- if a file is still changing heavily, leave it in `apps/web`

Examples of good first moves:

- shared form schema definitions
- shared enum-like domain constants
- reusable helper functions like date/formatting/parsing utilities
- DTO and data validation helpers

Examples of things not to move yet:

- page components
- route handlers
- App Router logic
- middleware
- server-only Next integrations

---

## Phase 3: Extract Shared Domain Logic

Status: later

Goal:

- separate business logic from framework delivery logic

Good candidates:

- permission evaluation logic
- inventory calculations
- state derivation helpers
- service-layer logic that can accept dependencies as inputs
- query input shaping and output mapping

Keep these inside `apps/web` for now:

- Next route handlers
- server actions
- request/cookie/session wiring
- web-only auth/session behavior

Pattern to prefer:

- shared package exports pure functions or service classes
- web and mobile provide platform-specific clients and environment wiring

---

## Phase 4: Shared Backend Contracts And Supabase Strategy

Status: later

Goal:

- use one backend foundation for both web and mobile, without forcing one identical client implementation

What should be shared:

- database schema
- SQL migrations
- RLS policies
- generated database types
- shared domain types
- shared validation and business rules

What should remain app-specific:

- web Supabase client wiring
- mobile Supabase client wiring
- cookie/session handling for web
- token persistence/deep linking for mobile
- SSR-specific auth behavior

Recommended mental model:

- one Supabase backend
- two platform-specific app integrations
- shared domain and type layer around that backend where useful

Recommended structure later:

- shared types and database contracts in `packages/supabase` or a similar package
- web client helpers in `apps/web`
- mobile client helpers in `apps/mobile`

Do not:

- make mobile import Supabase helpers directly from `apps/web`

---

## Phase 5: Shared UI, Carefully

Status: much later

Goal:

- share only the UI that is truly stable and reusable

Good candidates:

- design tokens
- icons
- primitive components
- brand colors and spacing conventions

Bad early candidates:

- page-level web components
- complex dashboard-specific components
- components tightly coupled to web routing or web state

Important principle:

- share design systems and primitives before sharing feature-level UI

---

## Phase 6: Mobile Product Expansion

Status: ongoing in parallel

Goal:

- build mobile intentionally while web remains the live product

Good first mobile areas:

- signed-out landing experience
- auth shell
- branch overview
- stock checks
- approvals and lightweight actions
- scanning-oriented workflows

Use shared packages for:

- validation
- domain types
- reusable business logic

Do not use `apps/web` as a dependency target for mobile.

---

## Extraction Rules

Before moving any file, ask:

1. Will mobile need this in the next few weeks?
2. Is it framework-agnostic?
3. Is the API stable enough?
4. Will extraction reduce duplication right now?

If the answer to any of these is "no", leave the file where it is.

---

## What Should Stay In `apps/web` For Now

- routes
- layouts
- page components
- server actions
- API route handlers
- Next middleware
- web-specific auth/session code
- web-specific Supabase SSR wiring
- email delivery wiring
- any code tightly coupled to `next/navigation`, `next/headers`, `next-intl`, or App Router

---

## Good Early Extraction Targets

These are the safest categories to move first:

1. `packages/lib`
   Generic utilities, helpers, formatting, parsing, non-framework logic

2. `packages/validation`
   Zod schemas, form validation, shared request/response validation

3. `packages/types`
   Optional package for domain types or DTOs if needed

4. `packages/supabase`
   Later, for generated DB types and shared contracts, not for app-specific client setup

5. `packages/ui`
   Later, for true primitives only

---

## Suggested Work Order

Recommended order of execution:

1. Finish and stabilize repo-level tooling
2. Extract a very small number of pure utility/schema files
3. Make sure web still builds and deploys
4. Start using those extracted packages from mobile
5. Expand extraction only after the pattern proves itself

The first extraction should be small.

Do not start with a massive folder move.

---

## Success Criteria

The migration is going well if:

- `apps/web` keeps deploying cleanly
- `apps/mobile` can progress without importing from `apps/web`
- shared packages stay small and intentional
- build/tooling complexity does not spike
- extraction reduces duplication instead of increasing confusion

The migration is going badly if:

- shared packages become dumping grounds
- mobile starts importing web internals
- production web behavior becomes unstable
- every file move requires framework-specific exceptions

---

## Prompting Guidance For Claude

When asking Claude to help, keep tasks narrow and phase-aware.

Good prompt structure:

- name the phase
- name the specific target package or folder
- state what must not change
- require verification after the change

Recommended constraints to include:

- do not break `apps/web` production behavior
- do not move framework-coupled code unless explicitly requested
- prefer the smallest safe extraction
- verify imports, config, and build impact after changes

---

## Example Prompts

### Prompt: Small Utility Extraction

```md
We are in Phase 2 of a gradual Next.js to Turborepo migration.

Please extract only pure utility functions from `apps/web` that are safe to share with mobile.

Rules:

- Do not move any file that imports `next/*`, server actions, or App Router APIs.
- Target `packages/lib`.
- Keep `apps/web` working exactly as before.
- Update imports after extraction.
- Verify TypeScript and lint config still resolve.

Make the smallest safe extraction possible.
```

### Prompt: Schema Extraction

```md
We are in Phase 2 of a gradual monorepo migration.

Please identify a small set of Zod schemas in `apps/web` that are likely to be needed by both web and mobile and extract them to `packages/validation`.

Rules:

- Do not move business logic that depends on Next.js runtime features.
- Keep all existing web behavior unchanged.
- Update imports carefully.
- Verify the extracted package has clean exports and that `apps/web` still compiles.
```

### Prompt: Shared Supabase Types

```md
We are in the shared backend contracts phase of a gradual migration.

Please extract only shared Supabase database types and contracts into a shared package, but keep app-specific Supabase client setup inside `apps/web`.

Rules:

- Do not move web SSR auth/session helpers.
- Do not make mobile depend on anything inside `apps/web`.
- Keep the extraction focused on types/contracts only.
- Verify imports and workspace package wiring.
```

### Prompt: Root Tooling Cleanup

```md
We are in Phase 1 of a gradual Turborepo migration.

Please clean up any remaining duplicated tooling config after root Husky/lint-staged and shared ESLint/TypeScript config were introduced.

Rules:

- Do not touch product logic.
- Remove only duplicates that are proven unnecessary.
- Keep app-specific config where required by framework differences.
- Verify the repo-level tooling still works after cleanup.
```

---

## Final Guidance

The safest path is:

- stabilize first
- extract second
- share only what proves it deserves to be shared

This migration should feel incremental, boring, and reliable.

That is a success.
