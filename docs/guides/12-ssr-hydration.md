# SSR Optimization with Hydration

## Overview

This guide covers the optional HydrationBoundary pattern for optimizing React Query with Server-Side Rendering (SSR). This is documented in [GitHub Issue #180](https://github.com/your-repo/issues/180) as a future enhancement.

## Current Architecture (Week 1-3 Complete)

Your application already uses SSR effectively:

✅ **Server Components by default**: Pages load context server-side
✅ **React Query for client data**: Automatic caching and refetching
✅ **No client-side DB access**: All data through server actions

## When to Use HydrationBoundary

**Use HydrationBoundary when**:

- Page has critical data needed immediately on load
- You want to eliminate loading spinners for initial data
- SEO requires fully rendered content
- You're optimizing Core Web Vitals (LCP, CLS)

**Don't use HydrationBoundary when**:

- Data changes frequently (< 5 min staleTime)
- User-specific dynamic data that varies per request
- Simple pages with fast client fetching
- Mobile-first apps (extra data transfer cost)

## Basic Pattern (Current - Week 3)

**File**: `src/app/[locale]/dashboard/tasks/page.tsx`

```tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  // Load context server-side
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      <h1>Tasks</h1>
      <TasksClient />
    </div>
  );
}
```

**Client Component** fetches data with React Query:

```tsx
"use client";

import { useTasks } from "@/lib/hooks/queries/tasks-queries";

export function TasksClient() {
  const { data: tasks, isLoading } = useTasks();

  if (isLoading) return <Skeleton />; // Shows spinner briefly

  return <TasksList tasks={tasks} />;
}
```

**Result**: Brief loading spinner on initial page load

## Enhanced Pattern with HydrationBoundary

**File**: `src/app/[locale]/dashboard/tasks/page.tsx`

```tsx
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { TasksService } from "@/server/services/tasks.service";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const appContext = await loadAppContextServer();

  // Create query client for this request
  const queryClient = new QueryClient();

  // Pre-fetch data server-side
  await queryClient.prefetchQuery({
    queryKey: ["tasks"],
    queryFn: () => TasksService.getTasks(appContext.activeOrgId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="container mx-auto py-8">
        <h1>Tasks</h1>
        <TasksClient />
      </div>
    </HydrationBoundary>
  );
}
```

**Client Component** (unchanged):

```tsx
"use client";

import { useTasks } from "@/lib/hooks/queries/tasks-queries";

export function TasksClient() {
  const { data: tasks, isLoading } = useTasks();

  // isLoading = false immediately (data already in cache)
  // No spinner shown!

  return <TasksList tasks={tasks} />;
}
```

**Result**: Zero loading spinner, instant content display

## Step-by-Step Implementation

### Step 1: Update Service to Accept Supabase Client (Optional)

**Current**:

```typescript
static async getTasks(organizationId: string): Promise<Task[]> {
  const supabase = await createClient();
  // ...
}
```

**Optional Enhancement** (for flexibility):

```typescript
static async getTasks(
  organizationId: string,
  supabaseClient?: SupabaseClient
): Promise<Task[]> {
  const supabase = supabaseClient || await createClient();
  // ...
}
```

### Step 2: Add Prefetching to Page

```tsx
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

export default async function TasksPage() {
  const appContext = await loadAppContextServer();
  const queryClient = new QueryClient();

  // Pre-fetch multiple queries
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["tasks"],
      queryFn: () => TasksService.getTasks(appContext.activeOrgId),
    }),
    queryClient.prefetchQuery({
      queryKey: ["tasks", "stats"],
      queryFn: () => TasksService.getTaskStats(appContext.activeOrgId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksClient />
    </HydrationBoundary>
  );
}
```

### Step 3: Client Component Uses Cached Data

```tsx
"use client";

export function TasksClient() {
  // Data is already in cache from server prefetch
  const { data: tasks } = useTasks(); // No loading state!
  const { data: stats } = useTaskStats(); // No loading state!

  return (
    <div>
      <TasksStats stats={stats} />
      <TasksList tasks={tasks} />
    </div>
  );
}
```

## Advanced Patterns

### Conditional Prefetching

Only prefetch critical data:

```tsx
export default async function TasksPage({ searchParams }: Props) {
  const appContext = await loadAppContextServer();
  const queryClient = new QueryClient();
  const params = await searchParams;

  // Only prefetch if no filters applied
  if (!params.status && !params.search) {
    await queryClient.prefetchQuery({
      queryKey: ["tasks"],
      queryFn: () => TasksService.getTasks(appContext.activeOrgId),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksClient initialFilters={params} />
    </HydrationBoundary>
  );
}
```

### Parallel Prefetching

Fetch multiple related queries:

```tsx
await Promise.all([
  // Critical data
  queryClient.prefetchQuery({
    queryKey: ["tasks"],
    queryFn: () => TasksService.getTasks(appContext.activeOrgId),
  }),

  // Supporting data
  queryClient.prefetchQuery({
    queryKey: ["users"],
    queryFn: () => UsersService.getUsers(appContext.activeOrgId),
  }),

  queryClient.prefetchQuery({
    queryKey: ["projects"],
    queryFn: () => ProjectsService.getProjects(appContext.activeOrgId),
  }),
]);
```

### Infinite Query Prefetching

```tsx
await queryClient.prefetchInfiniteQuery({
  queryKey: ["tasks", "infinite"],
  queryFn: ({ pageParam = 0 }) =>
    TasksService.getTasks(appContext.activeOrgId, {
      offset: pageParam,
      limit: 20,
    }),
  initialPageParam: 0,
  pages: 1, // Only prefetch first page
});
```

## Performance Considerations

### Benefits

✅ **Faster perceived load time**: No loading spinners
✅ **Better SEO**: Fully rendered HTML with data
✅ **Improved Core Web Vitals**: Better LCP scores
✅ **Reduced layout shift**: Content appears immediately

### Tradeoffs

❌ **Increased server load**: Database queries on every page request
❌ **Slower TTFB**: Server must fetch data before sending HTML
❌ **Larger HTML payload**: Serialized data in initial response
❌ **Cache complexity**: Need to handle stale data carefully

### When to Avoid

- **Frequently changing data**: If staleTime < 5 minutes
- **Heavy queries**: If queries take > 500ms
- **User-specific data**: Varies per user, can't cache effectively
- **Large datasets**: If data > 100KB, affects initial load

## Measuring Impact

### Before (Client-Side Fetch)

```
Server: 50ms (no data fetching)
TTFB: 50ms ✅ Fast
Client JS: 200ms
Data Fetch: 150ms
FCP: 400ms
LCP: 600ms ⚠️
```

### After (SSR with Hydration)

```
Server: 200ms (includes data fetch)
TTFB: 200ms ⚠️ Slower
Client JS: 200ms
Data Fetch: 0ms (cached)
FCP: 400ms
LCP: 400ms ✅ Better
```

## React Query Configuration

Adjust settings for SSR:

```typescript
// src/app/providers.tsx

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min - higher for SSR
      gcTime: 10 * 60 * 1000, // 10 min
      refetchOnWindowFocus: false, // Don't refetch immediately
      refetchOnMount: false, // Trust SSR data initially
    },
  },
});
```

## Testing SSR Hydration

### 1. Verify Data in HTML

View page source and check for serialized data:

```html
<script>
  self.__next_f.push([1, "... dehydrated state ..."]);
</script>
```

### 2. Network Tab

- SSR: No XHR request on initial load
- Client: XHR request visible in Network tab

### 3. React DevTools

Check if data is available before component mounts.

## Common Issues

### Issue 1: Hydration Mismatch

**Problem**: Server HTML doesn't match client render

**Solution**: Ensure queryKey matches exactly

```tsx
// Server
queryKey: ["tasks"];

// Client hook
queryKey: ["tasks"]; // Must match!
```

### Issue 2: Stale Data

**Problem**: Cached data doesn't update

**Solution**: Adjust staleTime or invalidate on mount

```tsx
const { data } = useTasks({
  staleTime: 0, // Force refetch
});
```

### Issue 3: Slow Server Response

**Problem**: TTFB too high with prefetch

**Solution**: Only prefetch critical data or use streaming

```tsx
// Don't prefetch everything
await queryClient.prefetchQuery({ ... }); // Only critical query
```

## Migration Strategy

### Phase 1: Identify Critical Pages

Pages that benefit most:

- Landing pages
- List views with stable data
- Dashboard overview
- Public-facing pages (SEO)

### Phase 2: Add Hydration Gradually

Start with one page:

```tsx
// Before
export default async function TasksPage() {
  return <TasksClient />;
}

// After
export default async function TasksPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ ... });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksClient />
    </HydrationBoundary>
  );
}
```

### Phase 3: Measure and Iterate

- Monitor TTFB, FCP, LCP metrics
- Compare user-perceived performance
- Adjust based on data

## Next Steps

- [Architecture Overview](./01-architecture-overview.md) - Understand SSR-first design
- [Creating Pages & Components](./07-creating-pages-components.md) - Build pages
- [Common Patterns](./16-common-patterns.md) - Code snippets
