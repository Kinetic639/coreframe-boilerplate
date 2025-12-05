# Building React Query Hooks

## Overview

React Query hooks manage client-side data fetching, caching, and state synchronization. They call server actions and handle loading/error states automatically.

## Key Principles

1. **One file per domain**: Group related queries in `[feature]-queries.ts`
2. **Consistent query keys**: Use hierarchical keys for cache invalidation
3. **Type safety**: Infer types from server actions
4. **Error handling**: Show toast notifications on errors
5. **Cache invalidation**: Invalidate related queries on mutations
6. **Optimistic updates**: Update cache before server response (optional)

## File Location

```
src/lib/hooks/queries/
  └── [feature]-queries.ts    # e.g., tasks-queries.ts
```

## Step-by-Step Guide

### Step 1: Create Hooks File

**File**: `src/lib/hooks/queries/tasks-queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  getTaskStats,
} from "@/app/[locale]/dashboard/tasks/_actions";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
} from "@/lib/schemas/tasks.schemas";
import { toast } from "react-toastify";

// ==========================================
// QUERY KEYS
// ==========================================

export const tasksKeys = {
  all: ["tasks"] as const,
  lists: () => [...tasksKeys.all, "list"] as const,
  list: (filters?: TaskFilters) => [...tasksKeys.lists(), filters] as const,
  details: () => [...tasksKeys.all, "detail"] as const,
  detail: (id: string) => [...tasksKeys.details(), id] as const,
  stats: () => [...tasksKeys.all, "stats"] as const,
};

// ==========================================
// QUERY HOOKS (Read Operations)
// ==========================================

/**
 * Get all tasks with optional filters
 *
 * @param filters - Optional filters (status, priority, assignee, etc.)
 * @returns Query result with tasks array
 */
export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: tasksKeys.list(filters),
    queryFn: async () => {
      const result = await getTasks(filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

/**
 * Get a single task by ID
 *
 * @param taskId - Task ID
 * @returns Query result with task data
 */
export function useTask(taskId: string) {
  return useQuery({
    queryKey: tasksKeys.detail(taskId),
    queryFn: async () => {
      const result = await getTask(taskId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!taskId, // Only fetch if taskId is provided
  });
}

/**
 * Get task statistics
 *
 * @returns Query result with task stats
 */
export function useTaskStats() {
  return useQuery({
    queryKey: tasksKeys.stats(),
    queryFn: async () => {
      const result = await getTaskStats();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

// ==========================================
// MUTATION HOOKS (Write Operations)
// ==========================================

/**
 * Create a new task
 *
 * @returns Mutation hook with mutate function
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate lists to refetch
        queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
        queryClient.invalidateQueries({ queryKey: tasksKeys.stats() });

        toast.success("Task created successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create task");
    },
  });
}

/**
 * Update an existing task
 *
 * @returns Mutation hook with mutate function
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      updateTask(taskId, input),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate lists and specific task detail
        queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: tasksKeys.detail(variables.taskId),
        });
        queryClient.invalidateQueries({ queryKey: tasksKeys.stats() });

        toast.success("Task updated successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update task");
    },
  });
}

/**
 * Delete a task
 *
 * @returns Mutation hook with mutate function
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all task queries
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });

        toast.success("Task deleted successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) {
      toast.error(error.message || "Failed to delete task");
    },
  });
}

/**
 * Assign a task to a user
 *
 * @returns Mutation hook with mutate function
 */
export function useAssignTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      assignTask(taskId, userId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate lists and specific task
        queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: tasksKeys.detail(variables.taskId),
        });

        toast.success("Task assigned successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) {
      toast.error(error.message || "Failed to assign task");
    },
  });
}
```

## Key Patterns

### 1. Query Keys Structure

Hierarchical keys for efficient invalidation:

```typescript
export const tasksKeys = {
  all: ["tasks"] as const, // Invalidate everything
  lists: () => [...tasksKeys.all, "list"] as const, // All lists
  list: (filters) => [...tasksKeys.lists(), filters], // Specific list
  details: () => [...tasksKeys.all, "detail"], // All details
  detail: (id) => [...tasksKeys.details(), id], // Specific detail
};
```

### 2. Query Hook Pattern

```typescript
export function useTask(taskId: string) {
  return useQuery({
    queryKey: tasksKeys.detail(taskId), // Unique key
    queryFn: async () => {
      const result = await getTask(taskId);
      if (!result.success) throw new Error(result.error);
      return result.data; // Return data on success
    },
    enabled: !!taskId, // Conditional fetching
  });
}
```

### 3. Mutation Hook Pattern

```typescript
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });

        // Show success message
        toast.success("Task created successfully");
      } else {
        // Handle action-level errors
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      // Handle network/unexpected errors
      toast.error(error.message || "Failed to create task");
    },
  });
}
```

### 4. Cache Invalidation

Invalidate related queries after mutations:

```typescript
// Invalidate all tasks
queryClient.invalidateQueries({ queryKey: tasksKeys.all });

// Invalidate all lists (keeps details cached)
queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });

// Invalidate specific task detail
queryClient.invalidateQueries({ queryKey: tasksKeys.detail(taskId) });

// Invalidate multiple keys
queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
queryClient.invalidateQueries({ queryKey: tasksKeys.stats() });
```

## Advanced Patterns

### Optimistic Updates

Update cache immediately, rollback on error:

```typescript
export function useToggleTaskComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) =>
      updateTask(taskId, {
        status: currentStatus === "done" ? "todo" : "done",
      }),
    // Before mutation runs
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: tasksKeys.detail(variables.taskId),
      });

      // Snapshot current value
      const previousTask = queryClient.getQueryData(tasksKeys.detail(variables.taskId));

      // Optimistically update cache
      queryClient.setQueryData(tasksKeys.detail(variables.taskId), (old: any) => ({
        ...old,
        status: old.status === "done" ? "todo" : "done",
      }));

      // Return context for rollback
      return { previousTask };
    },
    // On error, rollback
    onError: (err, variables, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(tasksKeys.detail(variables.taskId), context.previousTask);
      }
      toast.error("Failed to toggle task status");
    },
    // Always refetch after mutation
    onSettled: (result, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tasksKeys.detail(variables.taskId),
      });
    },
  });
}
```

### Dependent Queries

Fetch data that depends on other queries:

```typescript
export function useTaskWithComments(taskId: string) {
  // First query: task
  const { data: task, isLoading: taskLoading, error: taskError } = useTask(taskId);

  // Second query: comments (depends on task)
  const {
    data: comments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery({
    queryKey: ["tasks", taskId, "comments"],
    queryFn: async () => {
      const result = await getTaskComments(taskId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!task, // Only fetch if task exists
  });

  return {
    task,
    comments,
    isLoading: taskLoading || commentsLoading,
    error: taskError || commentsError,
  };
}
```

### Infinite Queries (Pagination)

```typescript
export function useInfiniteTasks(filters?: TaskFilters) {
  return useInfiniteQuery({
    queryKey: tasksKeys.list(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const result = await getTasks({
        ...filters,
        offset: pageParam,
        limit: 20,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined; // No more pages
      return allPages.length * 20; // Next offset
    },
    initialPageParam: 0,
  });
}
```

### Prefetching

Prefetch data before user navigates:

```typescript
export function usePrefetchTask() {
  const queryClient = useQueryClient();

  return (taskId: string) => {
    queryClient.prefetchQuery({
      queryKey: tasksKeys.detail(taskId),
      queryFn: async () => {
        const result = await getTask(taskId);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    });
  };
}

// Usage in component
function TaskList({ tasks }) {
  const prefetchTask = usePrefetchTask();

  return (
    <div>
      {tasks.map((task) => (
        <div
          key={task.id}
          onMouseEnter={() => prefetchTask(task.id)} // Prefetch on hover
        >
          {task.title}
        </div>
      ))}
    </div>
  );
}
```

## Using Hooks in Components

```tsx
"use client";

import { useTasks, useCreateTask, useDeleteTask } from "@/lib/hooks/queries/tasks-queries";

export function TasksList() {
  // Query hook
  const { data: tasks, isLoading, error } = useTasks({ status: "todo" });

  // Mutation hooks
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  async function handleCreate(input: CreateTaskInput) {
    createTask.mutate(input);
  }

  async function handleDelete(taskId: string) {
    if (confirm("Delete task?")) {
      deleteTask.mutate(taskId);
    }
  }

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div>
      {tasks?.map((task) => (
        <div key={task.id}>
          <span>{task.title}</span>
          <button onClick={() => handleDelete(task.id)}>Delete</button>
        </div>
      ))}
      <button onClick={() => handleCreate({ title: "New task", priority: "normal" })}>
        Add Task
      </button>
    </div>
  );
}
```

## React Query Configuration

Default configuration in `src/app/providers.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache cleanup
      retry: 1, // Single retry on failure
      refetchOnWindowFocus: false, // Don't refetch on tab focus
    },
  },
});
```

## Next Steps

- [Building Pages & Components](./07-creating-pages-components.md) - Use hooks in UI
- [Common Patterns](./16-common-patterns.md) - Frequently used patterns
- [Error Handling](./14-error-handling.md) - Advanced error strategies
