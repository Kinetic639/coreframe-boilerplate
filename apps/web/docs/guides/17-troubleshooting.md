# Troubleshooting Guide

## Overview

Common issues and solutions when working with the SSR-first architecture.

## Common Issues

### 1. "No active organization" Error

**Symptom**: Server actions return "No active organization"

**Causes**:

- User not assigned to any organization
- JWT token missing organization context
- App context not loaded properly

**Solutions**:

```typescript
// Check if user has organization
const appContext = await loadAppContextServer();
console.log("App context:", appContext);

// Verify user_roles table
SELECT * FROM user_roles WHERE user_id = 'user-uuid';

// Check JWT claims
SELECT auth.jwt() -> 'app_metadata' -> 'active_org_id';
```

**Fix**: Assign user to organization

```sql
INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES ('user-uuid', 'org-uuid', 'org_member');
```

---

### 2. RLS Policies Blocking Queries

**Symptom**: Queries return empty results or "insufficient privileges"

**Causes**:

- RLS policy too restrictive
- User not in correct role
- Missing policy for operation

**Solutions**:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'tasks';

-- View policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tasks';

-- Test as specific user
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';
SELECT * FROM public.tasks; -- What does user see?
ROLLBACK;

-- Check user roles
SELECT * FROM public.user_roles WHERE user_id = 'user-uuid';
```

**Fix**: Update policy or assign role

```sql
-- More permissive policy
DROP POLICY IF EXISTS "restrictive_policy" ON public.tasks;

CREATE POLICY "Users can view organization tasks"
  ON public.tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );
```

---

### 3. Hydration Mismatch Errors

**Symptom**: "Hydration failed" or "Text content does not match"

**Causes**:

- Server HTML doesn't match client render
- Using `Date.now()` or random values
- Accessing browser APIs in Server Components

**Solutions**:

```tsx
// ❌ BAD - Different on server/client
<div>{Date.now()}</div>
<div>{Math.random()}</div>

// ✅ GOOD - Consistent
<div>{new Date(props.timestamp).toLocaleDateString()}</div>

// ❌ BAD - Browser API in Server Component
if (window.innerWidth > 768) { ... }

// ✅ GOOD - Use client component
"use client";
const width = useWindowWidth();
```

**Fix**: Move dynamic logic to Client Component

```tsx
// Server Component
export default function Page() {
  return <ClientWrapper />;
}

// Client Component
("use client");
export function ClientWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <DynamicContent />;
}
```

---

### 4. React Query Not Updating

**Symptom**: Stale data after mutation

**Causes**:

- Missing cache invalidation
- Wrong query keys
- StaleTime too high

**Solutions**:

```typescript
// Check query keys match
// In action
queryKey: ["tasks"]

// In hook
queryKey: ["tasks"] // Must match exactly!

// Add invalidation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
}

// Force refetch
const { refetch } = useTasks();
refetch();

// Lower staleTime for frequently changing data
staleTime: 0, // Always refetch
```

---

### 5. "Cannot read properties of undefined"

**Symptom**: Runtime error accessing nested property

**Causes**:

- Data not loaded yet
- Optional chaining missing
- TypeScript types incorrect

**Solutions**:

```tsx
// ❌ BAD
<div>{task.assignee.name}</div>

// ✅ GOOD - Optional chaining
<div>{task.assignee?.name}</div>

// ✅ GOOD - Conditional rendering
{task.assignee && <div>{task.assignee.name}</div>}

// ✅ GOOD - Nullish coalescing
<div>{task.assignee?.name ?? "Unassigned"}</div>

// ✅ GOOD - Loading guard
if (!task) return <Skeleton />;
return <div>{task.assignee.name}</div>;
```

---

### 6. Slow Page Load Times

**Symptom**: TTFB > 1s, slow initial render

**Causes**:

- N+1 query problem
- Missing database indexes
- Too much SSR pre-fetching
- Unoptimized queries

**Solutions**:

```typescript
// ❌ BAD - N+1 queries
const tasks = await getTasks();
for (const task of tasks) {
  const user = await getUser(task.assigned_to); // N queries!
}

// ✅ GOOD - Join in single query
const tasks = await supabase.from("tasks").select(`
    *,
    assignee:assigned_to (
      id,
      email,
      first_name,
      last_name
    )
  `);
```

**Add indexes**:

```sql
-- Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add missing indexes
CREATE INDEX idx_tasks_org_status
  ON public.tasks(organization_id, status);
```

**Reduce SSR prefetching**:

```tsx
// Only prefetch critical data
await queryClient.prefetchQuery({
  queryKey: ["tasks"],
  queryFn: () => TasksService.getTasks(orgId, { limit: 10 }), // Limit results
});
```

---

### 7. TypeScript Type Errors

**Symptom**: "Type X is not assignable to type Y"

**Causes**:

- Database types out of sync
- Missing type generation
- Manual type definitions wrong

**Solutions**:

```bash
# Regenerate types
npm run supabase:gen:types

# Verify types file exists
ls -la supabase/types/types.ts
```

```typescript
// Use generated types
import type { Database } from "@/types/supabase";
type Task = Database["public"]["Tables"]["tasks"]["Row"];

// Don't manually define types
type Task = { id: string; title: string; ... }; // ❌
```

---

### 8. CORS Errors

**Symptom**: "Access-Control-Allow-Origin" error

**Causes**:

- Calling API from wrong domain
- Missing CORS configuration
- Using wrong Supabase URL

**Solutions**:

```typescript
// Check environment variables
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);

// Use correct client
import { createClient } from "@/utils/supabase/client"; // Client
import { createClient } from "@/utils/supabase/server"; // Server
```

---

### 9. Session Lost After Page Refresh

**Symptom**: User logged out on refresh

**Causes**:

- Cookie not being set
- Middleware not refreshing session
- Auth state not persisting

**Solutions**:

```typescript
// Check middleware
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refresh session
  await supabase.auth.getSession();

  return response;
}
```

---

### 10. Migration Fails to Apply

**Symptom**: Migration error when running `migration:up`

**Causes**:

- SQL syntax error
- Constraint violation
- Existing data conflicts

**Solutions**:

```bash
# Check migration status
npm run supabase:migration:list

# Test migration locally first
npm run supabase:db:reset
npm run supabase:migration:up

# Check migration file for errors
cat supabase/migrations/[timestamp]_*.sql
```

**Fix syntax errors**:

```sql
-- Add IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.tasks (...);

-- Use DO blocks for conditional logic
DO $$
BEGIN
  IF NOT EXISTS (...) THEN
    ALTER TABLE ...;
  END IF;
END $$;
```

---

## Debugging Techniques

### 1. Server-Side Debugging

```typescript
// Add console logs
export async function createTask(input: CreateTaskInput) {
  console.log("Input:", input);

  const appContext = await loadAppContextServer();
  console.log("App context:", appContext);

  const result = await TasksService.createTask(...);
  console.log("Result:", result);

  return { success: true, data: result };
}

// Check server logs
npm run dev
# Watch terminal for console output
```

### 2. Client-Side Debugging

```tsx
// React Query DevTools
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>;

// Check browser console
console.log("Query data:", data);
console.log("Is loading:", isLoading);
console.log("Error:", error);
```

### 3. Database Debugging

```sql
-- Check table structure
\d public.tasks

-- View recent data
SELECT * FROM public.tasks ORDER BY created_at DESC LIMIT 10;

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'tasks';

-- Test query as user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';
SELECT * FROM public.tasks;
```

### 4. Network Debugging

```bash
# Check API responses in browser DevTools
# Network tab → Filter by Fetch/XHR

# Test server action directly
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
```

### 5. Type Debugging

```typescript
// Use type assertions to debug
type TaskType = typeof task; // Hover to see inferred type

// Explicitly type variables
const task: Task = data; // TypeScript will show errors

// Use satisfies for type checking
const config = {
  name: "test",
} satisfies Config; // Ensures shape matches Config
```

---

## Performance Debugging

### Check Bundle Size

```bash
# Analyze bundle
npm run build
npm run analyze # If analyzer configured

# Check page size
ls -lh .next/static/
```

### Measure Render Performance

```tsx
import { Profiler } from "react";

<Profiler
  id="TasksList"
  onRender={(id, phase, actualDuration) => {
    console.log(`${id} (${phase}) took ${actualDuration}ms`);
  }}
>
  <TasksList />
</Profiler>;
```

### Database Query Performance

```sql
-- Enable query timing
\timing on

-- Explain query
EXPLAIN ANALYZE
SELECT * FROM public.tasks
WHERE organization_id = 'org-uuid';

-- Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC;
```

---

## Quick Fixes

### Clear All Caches

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules
npm install

# Clear browser cache
# Open DevTools → Application → Clear storage
```

### Reset Database Locally

```bash
# Reset Supabase
npm run supabase:db:reset

# Reapply migrations
npm run supabase:migration:up

# Regenerate types
npm run supabase:gen:types
```

### Fix TypeScript Errors

```bash
# Restart TypeScript server
# In VSCode: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Check for errors
npm run type-check
```

### Fix ESLint Errors

```bash
# Auto-fix
npm run lint -- --fix

# Check specific file
npx eslint src/path/to/file.ts --fix
```

---

## Getting Help

### 1. Check Documentation

- [Architecture Overview](./01-architecture-overview.md)
- [File Structure](./02-file-structure.md)
- [Error Handling](./14-error-handling.md)

### 2. Search Logs

```bash
# Check development logs
npm run dev | grep ERROR

# Check database logs
npm run supabase:logs
```

### 3. Test in Isolation

```typescript
// Create minimal reproduction
const testTask = await TasksService.createTask(
  { title: "Test", priority: "normal" },
  "org-id",
  "user-id"
);
console.log("Result:", testTask);
```

### 4. Check GitHub Issues

Look for similar issues in:

- [Next.js Issues](https://github.com/vercel/next.js/issues)
- [Supabase Issues](https://github.com/supabase/supabase/issues)
- [React Query Issues](https://github.com/TanStack/query/issues)

---

## Prevention Checklist

Before deploying:

- [ ] Run type check: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Run tests: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Test locally: `npm run dev`
- [ ] Check migrations applied: `npm run supabase:migration:list`
- [ ] Verify RLS policies: Test with different user roles
- [ ] Check error handling: Test failure scenarios
- [ ] Review logs: No unexpected errors

---

## Next Steps

- [Error Handling](./14-error-handling.md) - Proper error patterns
- [Testing](./15-testing.md) - Write tests to catch issues
- [Security Patterns](./13-security-patterns.md) - Prevent security issues
