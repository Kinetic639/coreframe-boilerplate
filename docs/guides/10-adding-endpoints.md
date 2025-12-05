# Adding New Endpoints (Quick Reference)

## Overview

This is a quick reference for adding new CRUD operations to existing features. Follow this checklist to ensure you don't miss any steps.

## Complete Checklist

When adding a new endpoint (e.g., "mark task as favorite"):

- [ ] **1. Update Database** (if schema changes needed)
- [ ] **2. Update Zod Schema** (if new input fields)
- [ ] **3. Add Service Method**
- [ ] **4. Add Server Action**
- [ ] **5. Add React Query Hook**
- [ ] **6. Use in Component**

## Quick Templates

### 1. Simple Update Operation

**Example**: Toggle task favorite status

#### Service Method

```typescript
// src/server/services/tasks.service.ts
static async toggleFavorite(
  taskId: string,
  organizationId: string,
  isFavorite: boolean
): Promise<Task> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ is_favorite: isFavorite })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

#### Server Action

```typescript
// src/app/[locale]/dashboard/tasks/_actions.ts
export async function toggleTaskFavorite(
  taskId: string,
  isFavorite: boolean
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.toggleFavorite>>>> {
  try {
    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const task = await TasksService.toggleFavorite(taskId, appContext.activeOrgId, isFavorite);

    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task",
    };
  }
}
```

#### React Query Hook

```typescript
// src/lib/hooks/queries/tasks-queries.ts
export function useToggleTaskFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, isFavorite }: { taskId: string; isFavorite: boolean }) =>
      toggleTaskFavorite(taskId, isFavorite),
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
        queryClient.invalidateQueries({ queryKey: tasksKeys.detail(variables.taskId) });
        toast.success(variables.isFavorite ? "Added to favorites" : "Removed from favorites");
      }
    },
  });
}
```

---

### 2. Get List with Filters

**Example**: Get tasks by assignee

#### Service Method

```typescript
static async getTasksByAssignee(
  organizationId: string,
  assigneeId: string
): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("assigned_to", assigneeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
```

#### Server Action

```typescript
export async function getTasksByAssignee(
  assigneeId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.getTasksByAssignee>>>> {
  try {
    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const tasks = await TasksService.getTasksByAssignee(appContext.activeOrgId, assigneeId);

    return { success: true, data: tasks };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tasks",
    };
  }
}
```

#### React Query Hook

```typescript
export function useTasksByAssignee(assigneeId: string) {
  return useQuery({
    queryKey: [...tasksKeys.lists(), "assignee", assigneeId],
    queryFn: async () => {
      const result = await getTasksByAssignee(assigneeId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!assigneeId,
  });
}
```

---

### 3. Create with Complex Input

**Example**: Create task with attachments

#### Schema

```typescript
// src/lib/schemas/tasks.schemas.ts
export const createTaskWithAttachmentsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: taskPrioritySchema,
  attachment_urls: z.array(z.string().url()).max(5),
});

export type CreateTaskWithAttachmentsInput = z.infer<typeof createTaskWithAttachmentsSchema>;
```

#### Service Method

```typescript
static async createTaskWithAttachments(
  input: CreateTaskWithAttachmentsInput,
  organizationId: string,
  userId: string
): Promise<Task> {
  const supabase = await createClient();

  // Create task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description,
      priority: input.priority,
      organization_id: organizationId,
      created_by: userId,
    })
    .select()
    .single();

  if (taskError) throw new Error(taskError.message);

  // Create attachments
  if (input.attachment_urls.length > 0) {
    const attachments = input.attachment_urls.map((url) => ({
      task_id: task.id,
      url,
      organization_id: organizationId,
    }));

    const { error: attachError } = await supabase
      .from("task_attachments")
      .insert(attachments);

    if (attachError) throw new Error(attachError.message);
  }

  return task;
}
```

#### Server Action

```typescript
export async function createTaskWithAttachments(
  input: CreateTaskWithAttachmentsInput
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.createTaskWithAttachments>>>> {
  try {
    const validated = createTaskWithAttachmentsSchema.parse(input);
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId || !appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    const task = await TasksService.createTaskWithAttachments(
      validated,
      appContext.activeOrgId,
      appContext.user.id
    );

    return { success: true, data: task };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}
```

---

### 4. Bulk Operation

**Example**: Bulk assign tasks

#### Service Method

```typescript
static async bulkAssignTasks(
  taskIds: string[],
  assigneeId: string,
  organizationId: string
): Promise<number> {
  const supabase = await createClient();

  // Verify assignee belongs to organization
  const { data: userOrg, error: userError } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", assigneeId)
    .eq("organization_id", organizationId)
    .single();

  if (userError || !userOrg) {
    throw new Error("User not found in organization");
  }

  // Update tasks
  const { data, error } = await supabase
    .from("tasks")
    .update({
      assigned_to: assigneeId,
      updated_at: new Date().toISOString(),
    })
    .in("id", taskIds)
    .eq("organization_id", organizationId)
    .select();

  if (error) throw new Error(error.message);
  return data?.length || 0;
}
```

#### Schema

```typescript
export const bulkAssignTasksSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1, "At least one task required"),
  assignee_id: z.string().uuid(),
});

export type BulkAssignTasksInput = z.infer<typeof bulkAssignTasksSchema>;
```

#### Server Action

```typescript
export async function bulkAssignTasks(
  taskIds: string[],
  assigneeId: string
): Promise<ActionResponse<number>> {
  try {
    const validated = bulkAssignTasksSchema.parse({
      task_ids: taskIds,
      assignee_id: assigneeId,
    });

    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const count = await TasksService.bulkAssignTasks(
      validated.task_ids,
      validated.assignee_id,
      appContext.activeOrgId
    );

    return { success: true, data: count };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign tasks",
    };
  }
}
```

---

### 5. Get with Relations

**Example**: Get task with comments

#### Service Method

```typescript
static async getTaskWithComments(
  taskId: string,
  organizationId: string
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
        user:created_by (
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

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data as TaskWithComments;
}
```

#### Server Action

```typescript
export async function getTaskWithComments(
  taskId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.getTaskWithComments>>>> {
  try {
    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const task = await TasksService.getTaskWithComments(taskId, appContext.activeOrgId);

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch task",
    };
  }
}
```

## Common Patterns Reference

### Organization Scoping

```typescript
.eq("organization_id", organizationId)
```

### Soft Delete Filter

```typescript
.is("deleted_at", null)
```

### Pagination

```typescript
.range(offset, offset + limit - 1)
```

### Search

```typescript
.or(`field1.ilike.%${query}%,field2.ilike.%${query}%`)
```

### Sorting

```typescript
.order("created_at", { ascending: false })
```

### Error Handling in Service

```typescript
if (error) {
  if (error.code === "PGRST116") return null; // Not found
  throw new Error(`Failed to ...: ${error.message}`);
}
```

### Error Handling in Action

```typescript
try {
  // ... action logic
} catch (error) {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: error.errors.map((e) => e.message).join(", "),
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : "Generic error message",
  };
}
```

### Cache Invalidation

```typescript
// Invalidate all lists
queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });

// Invalidate specific detail
queryClient.invalidateQueries({ queryKey: tasksKeys.detail(taskId) });

// Invalidate everything
queryClient.invalidateQueries({ queryKey: tasksKeys.all });
```

## Next Steps

- [Extending Services](./09-extending-services.md) - Detailed service extension guide
- [Common Patterns](./16-common-patterns.md) - More code snippets
- [Creating New Module](./03-creating-new-module.md) - Build from scratch
