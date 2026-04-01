# Developer Guides

Complete guides for implementing features following the SSR-first architecture established in the migration.

## Quick Navigation

### Core Concepts

- **[Architecture Overview](./01-architecture-overview.md)** - Understanding the SSR-first architecture
- **[File Structure](./02-file-structure.md)** - Where files go and why

### Implementation Guides

- **[Creating a New Feature Module](./03-creating-new-module.md)** - Complete walkthrough for new features
- **[Adding Server-Side Service](./04-creating-service.md)** - Backend business logic layer
- **[Creating Server Actions](./05-creating-server-actions.md)** - API layer for client-server communication
- **[Building React Query Hooks](./06-creating-react-query-hooks.md)** - Client-side data fetching
- **[Building Pages & Components](./07-creating-pages-components.md)** - UI layer with SSR
- **[Zod Schema Validation](./08-zod-schemas.md)** - Input validation patterns

### Extending Existing Features

- **[Extending Services](./09-extending-services.md)** - Adding methods to existing services
- **[Adding New Endpoints](./10-adding-endpoints.md)** - Quick reference for new CRUD operations
- **[Database Migrations](./11-database-migrations.md)** - Schema changes and RLS policies

### Advanced Patterns

- **[SSR with HydrationBoundary](./12-ssr-hydration.md)** - Performance optimization (optional)
- **[Multi-tenant Security](./13-security-patterns.md)** - Organization/branch scoping
- **[Error Handling](./14-error-handling.md)** - Consistent error patterns
- **[Testing Strategies](./15-testing.md)** - Unit and integration testing

### Reference

- **[Code Examples](./examples/)** - Real-world implementations
- **[Common Patterns](./16-common-patterns.md)** - Frequently used code snippets
- **[Troubleshooting](./17-troubleshooting.md)** - Common issues and solutions

## Quick Start Checklist

When creating a new feature, follow this order:

1. ✅ **Database**: Create migration with tables + RLS policies
2. ✅ **Schema**: Define Zod validation schemas for inputs
3. ✅ **Service**: Implement business logic layer
4. ✅ **Actions**: Create server actions for client communication
5. ✅ **Hooks**: Build React Query hooks for data fetching
6. ✅ **UI**: Create pages and components using hooks

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│  Page (Server Component)                                │
│  - Loads context server-side                            │
│  - Optional: Pre-fetch data for SSR                     │
│  - Renders client components                            │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Client Component                                       │
│  - Uses React Query hooks                               │
│  - Displays UI with data                                │
│  - Handles user interactions                            │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  React Query Hook (src/lib/hooks/queries/)             │
│  - Manages cache and refetching                         │
│  - Calls server actions                                 │
│  - Handles loading/error states                         │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Server Action (_actions.ts, co-located)                │
│  - Validates input with Zod                             │
│  - Checks authentication                                │
│  - Calls service layer                                  │
│  - Returns typed response                               │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Service (src/server/services/)                         │
│  - Contains business logic                              │
│  - Executes database queries                            │
│  - Transforms data                                      │
│  - Enforces business rules                              │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Database (Supabase/PostgreSQL)                         │
│  - RLS policies enforce security                        │
│  - Row-level permissions                                │
└─────────────────────────────────────────────────────────┘
```

## Key Principles

1. **SSR-First**: Server components by default, client only when needed
2. **Type Safety**: End-to-end TypeScript with generated DB types
3. **Single Source of Truth**: Services contain all business logic
4. **Security Layers**: RLS + Permission checks + Server actions
5. **No Client DB Access**: Only server actions touch the database
6. **Co-located Actions**: Server actions live with routes, not global folder
7. **Flat Structure**: Services in flat directory, not nested

## Getting Help

- Check the specific guide for your use case
- Look at existing implementations in `src/server/services/`
- Refer to migration documentation in `docs/MIGRATION_PROGRESS.md`
- See real examples in `docs/guides/examples/`

---

**Last Updated**: December 5, 2025
**Migration Status**: Week 1-3 Complete
