# Coreframe Rebuild Documentation

This directory contains all documentation related to the Coreframe rebuild project - a comprehensive refactoring of the application to follow SSR-first architecture with TDD methodology.

## Quick Navigation

### Planning & Progress

- **[COREFRAME_REBUILD.md](./COREFRAME_REBUILD.md)** - Master rebuild plan with phases 0-6
- **[PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)** - Live progress tracking for all phases
- **[PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)** - Detailed TDD implementation guide for Phase 1

### Phase Documentation

Each phase will have detailed implementation documentation:

- Phase 0: Testing Infrastructure (Complete)
- Phase 1: Auth + SSR Context + Permissions (In Progress)
- Phase 2: RLS Baseline (Planned)
- Phase 3: First Feature Slice (Planned)
- Phase 4: UI Rebuild Foundation (Planned)
- Phase 5: Migrate Warehouse Features (Planned)

## What is the Coreframe Rebuild?

The Coreframe rebuild is a systematic refactoring of the entire application following these principles:

### Core Principles

1. **"Working app always"**
   - Every step ends with all tests passing
   - App boots without errors
   - At least one happy path works

2. **TDD at migration level**
   - Write tests first (RED)
   - Implement (GREEN)
   - Switch usage
   - Verify and commit

3. **Separate Domain from UI**
   - Services testable in Node.js without React
   - Business logic isolated from presentation
   - Single source of truth for data operations

4. **RLS-first security**
   - Defense in depth: RLS + Permissions + Server actions
   - Policies designed before features
   - Multi-tenant by default

## Architecture Overview

The rebuild follows a 6-layer stack:

```
┌─────────────────────────────────────────────┐
│ 1. Database (Supabase/PostgreSQL)           │
│    - Tables + RLS policies                  │
└────────────────┬────────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│ 2. Service Layer (pure functions)           │
│    - Business logic                         │
│    - src/server/services/*.service.ts       │
└────────────────┬────────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│ 3. Server Actions (auth + permission)       │
│    - src/app/[locale]/dashboard/*/_actions.ts│
└────────────────┬────────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│ 4. React Query Hooks (client data fetching) │
│    - src/lib/hooks/queries/*-queries.ts     │
└────────────────┬────────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│ 5. UI Components                            │
│    - src/modules/*/components/*.tsx         │
└─────────────────────────────────────────────┘
```

## Current Status

**Phase:** Phase 1 - Auth + SSR Context + Permissions
**Status:** 🟡 Planned
**Progress:** 0% (9 increments planned)

See [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) for live status.

## How to Use This Documentation

### For Developers Implementing

1. **Start with the master plan**: Read [COREFRAME_REBUILD.md](./COREFRAME_REBUILD.md)
2. **Check current phase**: Review [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)
3. **Follow detailed steps**: Use phase-specific implementation guides
4. **Update progress**: Mark tasks complete in PROGRESS_TRACKER.md
5. **Run tests**: Ensure `pnpm test:run` passes before committing

### For Project Managers

- Track progress via PROGRESS_TRACKER.md
- Review Definition of Done for each phase
- Monitor testing metrics
- Check for blockers

### For Code Reviewers

- Verify tests written before implementation (TDD)
- Check Definition of Done criteria met
- Ensure all tests passing
- Validate architectural patterns followed

## Testing Strategy

### Test Pyramid (Most → Least)

1. **Node service tests** - Business logic in isolation
2. **Node server action tests** - API layer
3. **jsdom hook tests** - Client data fetching
4. **jsdom component tests** - UI behavior
5. **Very few integration tests** - Critical flows only

### Test Requirements

- Services: 80%+ coverage
- Actions: 70%+ coverage
- Hooks: 70%+ coverage
- Components: 60%+ coverage

See [Testing Guide](../testing/DEVELOPER_GUIDE.md) for patterns.

## Phase Breakdown

### Phase 0: Testing Infrastructure ✅ Complete

**Duration:** 1-2 days
**Delivered:** Vitest setup, MSW, test harnesses, mocking utilities

### Phase 1: Auth + SSR Context + Permissions 🟡 Planned

**Duration:** 3-7 days
**Goal:** Rock-solid authentication and permission foundation

**Increments:**

1. Database - authorize() function
2. Database - JWT custom hook
3. Auth Service Layer
4. Permission Service Layer
5. Rebuild loadUserContextServer
6. Refine loadAppContextServer
7. Update Zustand Stores
8. Create usePermissions Hook
9. Vertical Slice - List Organizations

### Phase 2: RLS Baseline ⚪ Not Started

**Duration:** 2-5 days
**Goal:** Establish RLS policies for core tables

### Phase 3: First Feature Slice ⚪ Not Started

**Duration:** 3-7 days
**Goal:** Prove full stack with Products CRUD

### Phase 4: UI Rebuild Foundation ⚪ Not Started

**Duration:** 2-6 days
**Goal:** Create reusable UI primitives

### Phase 5: Migrate Warehouse Features ⚪ Not Started

**Duration:** Ongoing
**Goal:** Feature-by-feature migration of warehouse module

## Key Files Reference

### Configuration

- `/vitest.config.ts` - Test configuration
- `/vitest.setup.ts` - Global test setup

### Testing Utilities

- `/src/test/setup-supabase-mocks.ts` - Database mocking
- `/src/test/server-action-mocks.ts` - Action mocking
- `/src/test/harnesses/` - Test wrappers

### Services (Phase 1+)

- `/src/server/services/auth.service.ts` - Authentication
- `/src/server/services/permission.service.ts` - Permissions

### Context Loaders

- `/src/lib/api/load-user-context-server.ts` - User context
- `/src/lib/api/load-app-context-server.ts` - App context

### Stores

- `/src/lib/stores/user-store.ts` - User state
- `/src/lib/stores/app-store.ts` - App state

## Definition of Done Template

Every feature/migration is complete when:

- ✅ DB migration applied cleanly
- ✅ RLS policies exist (or deferred with reason)
- ✅ Service tests cover success + error + RLS denial
- ✅ Action tests cover auth + permission + service call
- ✅ Hook tests cover loading/error/success states
- ✅ UI works with established primitives
- ✅ Cache invalidation correct
- ✅ `pnpm test:run` all green
- ✅ `pnpm type-check` passes
- ✅ `pnpm lint` passes

## Common Workflows

### Starting a New Phase

1. Review phase plan in COREFRAME_REBUILD.md
2. Update PROGRESS_TRACKER.md status
3. Create phase-specific implementation guide
4. Begin Increment 1

### Completing an Increment

1. Ensure all tests pass
2. Run type-check and lint
3. Update PROGRESS_TRACKER.md
4. Commit with descriptive message
5. Begin next increment

### Daily Standup

Use the template in PROGRESS_TRACKER.md to log:

- Completed tasks
- In progress work
- Blockers
- Next steps
- Test status

## Best Practices

### TDD Workflow

1. ✅ Write test (RED) - Test fails
2. ✅ Implement minimal code (GREEN) - Test passes
3. ✅ Refactor if needed - Tests still pass
4. ✅ Commit with passing tests

### Architectural Rules

- ❌ Don't skip tests - write them first
- ❌ Don't use service role except in migrations
- ❌ Don't load large datasets in AppContext
- ❌ Don't bypass permission checks
- ❌ Don't commit with failing tests
- ✅ Always check authentication first
- ✅ Always validate permissions second
- ✅ Always scope queries by org/branch
- ✅ RLS is final defense layer

## Getting Help

### Documentation

- Architecture guides in `/docs/guides/`
- Testing patterns in `/docs/testing/`
- Migration examples in `/docs/guides/examples/`

### Key Contacts

- Architecture questions: Review COREFRAME_REBUILD.md
- Testing questions: Review DEVELOPER_GUIDE.md
- Implementation questions: Review phase-specific guides

## Contributing to Rebuild Docs

When updating documentation:

1. Keep PROGRESS_TRACKER.md current
2. Document architectural decisions
3. Update metrics after each phase
4. Add examples of patterns used
5. Note any deviations from plan with reasoning

---

**Last Updated:** 2026-01-05
**Documentation Version:** 1.0
**Rebuild Status:** Phase 1 Planning Complete
