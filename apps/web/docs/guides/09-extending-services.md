# Extending Existing Services

## Overview

This guide shows how to add new methods to existing service classes when you need to expand functionality.

## When to Extend Services

- Adding new CRUD operations
- Adding business logic methods (e.g., bulk operations, calculations)
- Adding helper methods for specific use cases
- Adding related entity operations

## Step-by-Step Guide

### Step 1: Locate the Service

Services are in `src/server/services/[feature].service.ts`:

```bash
src/server/services/
  ├── tasks.service.ts      # Tasks service
  ├── products.service.ts   # Products service
  └── contacts.service.ts   # Contacts service
```

### Step 2: Add New Method

```typescript
// src/server/services/tasks.service.ts

export class TasksService {
  // ... existing methods ...

  /**
   * Bulk update task status
   *
   * @param taskIds - Array of task IDs
   * @param status - New status to apply
   * @param organizationId - Organization ID for security
   * @returns Number of tasks updated
   */
  static async bulkUpdateStatus(
    taskIds: string[],
    status: string,
    organizationId: string
  ): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in("id", taskIds)
      .eq("organization_id", organizationId)
      .select();

    if (error) {
      throw new Error(`Failed to bulk update tasks: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get overdue tasks for an organization
   *
   * @param organizationId - Organization ID
   * @returns Array of overdue tasks
   */
  static async getOverdueTasks(organizationId: string): Promise<Task[]> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .lt("due_date", now)
      .neq("status", "done")
      .is("deleted_at", null)
      .order("due_date", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch overdue tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Duplicate a task
   *
   * @param taskId - Task ID to duplicate
   * @param organizationId - Organization ID
   * @param userId - User creating the duplicate
   * @returns Duplicated task
   */
  static async duplicateTask(
    taskId: string,
    organizationId: string,
    userId: string
  ): Promise<Task> {
    const supabase = await createClient();

    // Get original task
    const original = await this.getTask(taskId, organizationId);
    if (!original) {
      throw new Error("Task not found");
    }

    // Create duplicate
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: `${original.title} (Copy)`,
        description: original.description,
        priority: original.priority,
        status: "todo", // Reset to todo
        organization_id: organizationId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to duplicate task: ${error.message}`);
    }

    return data;
  }
}
```

### Step 3: Add Schema (if needed)

If your new method requires input validation:

```typescript
// src/lib/schemas/tasks.schemas.ts

// Add new schema
export const bulkUpdateStatusSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1, "At least one task required"),
  status: taskStatusSchema,
});

// Export type
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
```

### Step 4: Add Server Action

```typescript
// src/app/[locale]/dashboard/tasks/_actions.ts

/**
 * Bulk update task status
 */
export async function bulkUpdateTaskStatus(
  taskIds: string[],
  status: string
): Promise<ActionResponse<number>> {
  try {
    const validated = bulkUpdateStatusSchema.parse({ task_ids: taskIds, status });
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const count = await TasksService.bulkUpdateStatus(
      validated.task_ids,
      validated.status,
      appContext.activeOrgId
    );

    return { success: true, data: count };
  } catch (error) {
    console.error("Error in bulkUpdateTaskStatus:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tasks",
    };
  }
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(): Promise<
  ActionResponse<Awaited<ReturnType<typeof TasksService.getOverdueTasks>>>
> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const tasks = await TasksService.getOverdueTasks(appContext.activeOrgId);

    return { success: true, data: tasks };
  } catch (error) {
    console.error("Error in getOverdueTasks:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tasks",
    };
  }
}
```

### Step 5: Add React Query Hook (if needed)

```typescript
// src/lib/hooks/queries/tasks-queries.ts

/**
 * Get overdue tasks
 */
export function useOverdueTasks() {
  return useQuery({
    queryKey: [...tasksKeys.all, "overdue"],
    queryFn: async () => {
      const result = await getOverdueTasks();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

/**
 * Bulk update task status
 */
export function useBulkUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskIds, status }: { taskIds: string[]; status: string }) =>
      bulkUpdateTaskStatus(taskIds, status),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
        toast.success(`Updated ${result.data} tasks`);
      } else {
        toast.error(result.error);
      }
    },
  });
}
```

## Common Extension Patterns

### 1. Aggregation Methods

```typescript
static async getTaskSummaryByUser(
  organizationId: string
): Promise<{ userId: string; userName: string; total: number; completed: number }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_task_summary_by_user", {
      org_id: organizationId,
    });

  if (error) throw new Error(error.message);
  return data || [];
}
```

### 2. Search Methods

```typescript
static async searchTasks(
  organizationId: string,
  query: string
): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data || [];
}
```

### 3. Relationship Methods

```typescript
static async getTasksWithComments(
  organizationId: string,
  taskId: string
): Promise<TaskWithComments> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      comments (
        id,
        text,
        created_at,
        user:users (
          id,
          email,
          first_name,
          last_name
        )
      )
    `)
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

### 4. Bulk Operations

```typescript
static async bulkDelete(
  taskIds: string[],
  organizationId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", taskIds)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}
```

### 5. Transaction Methods

```typescript
static async moveTaskToDifferentProject(
  taskId: string,
  newProjectId: string,
  organizationId: string
): Promise<Task> {
  const supabase = await createClient();

  // Verify both task and project belong to organization
  const [task, project] = await Promise.all([
    this.getTask(taskId, organizationId),
    ProjectsService.getProject(newProjectId, organizationId),
  ]);

  if (!task) throw new Error("Task not found");
  if (!project) throw new Error("Project not found");

  // Update task
  const { data, error } = await supabase
    .from("tasks")
    .update({
      project_id: newProjectId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

## Best Practices

1. **Document with JSDoc**: Add clear comments explaining parameters and behavior
2. **Organization Scoping**: Always filter by `organization_id`
3. **Error Handling**: Throw descriptive errors
4. **Type Safety**: Use generated database types
5. **Validation**: Validate business rules in service
6. **Testing**: Add tests for new methods

## Example: Complete Extension

```typescript
// 1. Service method
export class TasksService {
  static async archiveCompletedTasks(
    organizationId: string,
    olderThanDays: number = 30
  ): Promise<number> {
    const supabase = await createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("status", "done")
      .lt("updated_at", cutoffDate.toISOString())
      .is("archived_at", null)
      .select();

    if (error) throw new Error(error.message);
    return data?.length || 0;
  }
}

// 2. Schema (if needed)
export const archiveTasksSchema = z.object({
  older_than_days: z.number().int().min(1).max(365).default(30),
});
export type ArchiveTasksInput = z.infer<typeof archiveTasksSchema>;

// 3. Server action
export async function archiveCompletedTasks(
  olderThanDays: number = 30
): Promise<ActionResponse<number>> {
  try {
    const validated = archiveTasksSchema.parse({ older_than_days: olderThanDays });
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const count = await TasksService.archiveCompletedTasks(
      appContext.activeOrgId,
      validated.older_than_days
    );

    return { success: true, data: count };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive tasks",
    };
  }
}

// 4. React Query hook
export function useArchiveCompletedTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (olderThanDays?: number) => archiveCompletedTasks(olderThanDays),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
        toast.success(`Archived ${result.data} completed tasks`);
      } else {
        toast.error(result.error);
      }
    },
  });
}
```

## Next Steps

- [Adding New Endpoints](./10-adding-endpoints.md) - Quick CRUD reference
- [Common Patterns](./16-common-patterns.md) - Reusable code snippets
- [Creating New Module](./03-creating-new-module.md) - Build from scratch
