# Mobile & Platform Roadmap (Post Phase 7)

## Context

### Current State

Phase 7 delivered the mobile authorization bootstrap: a state machine that loads backend permissions and entitlements at startup and makes them available to the mobile app before any feature screen renders. This establishes the authorization foundation the rest of the mobile product depends on.

### Why This Roadmap Exists

Phase 7 stabilization marks the transition from infrastructure to product. This document captures the agreed sequence of phases beyond Phase 7 so that future work is grounded in the correct system model and architectural constraints, without requiring those decisions to be re-litigated each time.

### Key Architectural Principles

- **One account, one organization.** There is no multi-org support. An account belongs to exactly one organization.
- **No org switcher.** The organization is stable context. There is no mechanism to switch between organizations.
- **Branch context is the primary future complexity.** Within an organization, branches are the active operational context. Most future authorization and data work centers on branch selection and branch-scoped access.
- **Backend is the source of truth for authorization.** RLS policies and server-side logic determine what a user can do. The mobile client reflects those decisions — it does not make them.

---

## Phase 8 — Mobile Data Layer & Feature Foundations

Establish the typed, verified data access layer that all mobile features will build on.

- Introduce query layer (React Query or equivalent) for data fetching
- Define reusable data hooks with consistent loading and error handling patterns
- Ensure all data access is typed against the DB schema (no untyped queries)
- Implement first real feature data flows (e.g. inventory, workshop, or equivalent domain features)
- Establish loading state and error boundary patterns for feature screens
- No duplication of backend logic — mobile fetches and displays, does not re-implement business rules

---

## Phase 9 — Schema Alignment & Contract Integrity

Eliminate drift between the database, contracts, and application code before it compounds.

- Audit live DB state against migration history and identify any gaps
- Verify `organization_entitlements` and other tables where known mismatches exist
- Regenerate Supabase TypeScript types from the live schema
- Update `@repo/contracts` where types have drifted from the DB
- Remove temporary normalization hacks (e.g. in `normalize-entitlements.ts`) where the underlying data is now correct
- Establish a process for keeping types and contracts in sync going forward

---

## Phase 10 — Branch Context & Branch-Scoped Authorization

Introduce branch selection and branch-aware behavior as the primary operational context layer.

- Implement active branch selection on mobile (persisted, restorable)
- Load branch-aware permission snapshots when active branch changes
- Ensure data queries are scoped to the active branch where relevant
- Drive UI behavior (visible actions, accessible features) from branch-scoped permissions
- Handle branch change events: reload permissions, invalidate branch-scoped cache
- **No org switcher** — branch is the only context that changes at runtime

---

## Phase 11 — Realtime & Invalidation

Keep the mobile client consistent with backend state without requiring manual refresh.

- Integrate Supabase Realtime for relevant tables and events
- Define a cache invalidation strategy tied to Realtime events
- Trigger permission and entitlement refresh when backend authorization state changes
- Ensure mobile and web clients remain consistent in how they respond to state changes
- Handle reconnection and missed-event scenarios gracefully

---

## Phase 12 — Cross-App Platform Consistency

Align mobile and web behavior on shared domain logic and contracts.

- Audit mobile vs. web for behavioral divergence in shared features
- Align permission semantics: same permission slugs, same enforcement logic, same outcomes
- Align error handling patterns so failures surface consistently across platforms
- Identify and consolidate shared domain logic that currently lives only on one platform
- No new shared packages unless clearly justified — prefer alignment over extraction

---

## Phase 13 — Production Hardening & Observability

Prepare the mobile app for production conditions.

- Define and implement a structured logging strategy for mobile
- Integrate error tracking (crash reporting, unhandled rejections)
- Add performance monitoring for critical paths (bootstrap time, query latency, render time)
- Validate audit trails for authorization decisions where required
- Test resilience under degraded conditions (offline, slow network, partial backend failures)
- Establish alerting thresholds and on-call runbooks for mobile-specific failure modes

---

## Core Architectural Rules

These rules apply to all phases and must not be compromised by implementation shortcuts.

- **One account = one organization.** There is no multi-org concept in this system.
- **Organization is stable context.** It does not change at runtime. No org switcher exists or will be added.
- **Branch is the active operational context.** Branch selection drives permissions, queries, and UI behavior.
- **Mobile client is NOT an authorization authority.** The client reflects authorization state; it does not compute or enforce it.
- **Backend (RLS + server logic) is the source of truth.** All permission checks that gate actual data access happen on the server.
- **Client-side permission checks are UI-only.** They control visibility and interaction affordances. They are never a substitute for backend enforcement.
