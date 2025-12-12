# Creating Server Actions

## Overview

Server Actions are the **API layer** between your client components and server-side services. They handle authentication, input validation, and error handling.

## Key Principles

1. **Co-located**: Live with routes in `_actions.ts` files (NOT in global folder)
2. **"use server"**: Must have the directive at the top
3. **Validation**: Validate input with Zod before calling services
4. **Authentication**: Check user auth and context
5. **Typed Responses**: Return `{ success, data?, error? }`
6. **Error Handling**: Catch and return user-friendly errors

## File Location

```
src/app/[locale]/dashboard/[module]/[feature]/
  ├── page.tsx         # Server Component page
  ├── _actions.ts      # ← Co-located Server Actions
  └── client.tsx       # Client Component
```

**Why underscore prefix?** The underscore prevents `_actions.ts` from becoming a route in Next.js App Router.

## Step-by-Step Guide

### Step 1: Create Actions File

**File**: `src/app/[locale]/dashboard/tasks/_actions.ts`

```typescript
"use server";

import { z } from "zod";
import { TasksService } from "@/server/services/tasks.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import {
  createTaskSchema,
  updateTaskSchema,
  taskFiltersSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilters,
} from "@/lib/schemas/tasks.schemas";

// ==========================================
// ACTION RESPONSE TYPE
// ==========================================

type ActionResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };

// ==========================================
// QUERY ACTIONS (Read Operations)
// ==========================================

/**
 * Get all tasks for the active organization
 */
export async function getTasks(
  filters?: TaskFilters
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.getTasks>>>> {
  try {
    // Load app context (org, branch, user)
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // Validate filters if provided
    const validatedFilters = filters ? taskFiltersSchema.parse(filters) : {};

    // Call service
    const tasks = await TasksService.getTasks(appContext.activeOrgId, validatedFilters);

    return { success: true, data: tasks };
  } catch (error) {
    console.error("Error in getTasks:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tasks",
    };
  }
}

/**
 * Get a single task by ID
 */
export async function getTask(
  taskId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.getTask>>>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const task = await TasksService.getTask(taskId, appContext.activeOrgId);

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    return { success: true, data: task };
  } catch (error) {
    console.error("Error in getTask:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch task",
    };
  }
}

/**
 * Get task statistics
 */
export async function getTaskStats(): Promise<
  ActionResponse<Awaited<ReturnType<typeof TasksService.getTaskStats>>>
> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const stats = await TasksService.getTaskStats(appContext.activeOrgId);

    return { success: true, data: stats };
  } catch (error) {
    console.error("Error in getTaskStats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch stats",
    };
  }
}

// ==========================================
// MUTATION ACTIONS (Write Operations)
// ==========================================

/**
 * Create a new task
 */
export async function createTask(
  input: CreateTaskInput
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.createTask>>>> {
  try {
    // Validate input with Zod
    const validated = createTaskSchema.parse(input);

    // Load context
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId || !appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    // Call service
    const task = await TasksService.createTask(
      validated,
      appContext.activeOrgId,
      appContext.user.id
    );

    return { success: true, data: task };
  } catch (error) {
    console.error("Error in createTask:", error);

    // Handle Zod validation errors
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

/**
 * Update an existing task
 */
export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.updateTask>>>> {
  try {
    // Validate input with Zod
    const validated = updateTaskSchema.parse(input);

    // Load context
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // Call service
    const task = await TasksService.updateTask(taskId, appContext.activeOrgId, validated);

    return { success: true, data: task };
  } catch (error) {
    console.error("Error in updateTask:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task",
    };
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<ActionResponse<void>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    await TasksService.deleteTask(taskId, appContext.activeOrgId);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error in deleteTask:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete task",
    };
  }
}

/**
 * Assign a task to a user
 */
export async function assignTask(
  taskId: string,
  userId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.assignTask>>>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const task = await TasksService.assignTask(taskId, appContext.activeOrgId, userId);

    return { success: true, data: task };
  } catch (error) {
    console.error("Error in assignTask:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign task",
    };
  }
}
```

## Action Patterns

### 1. Standard Response Type

Always return this structure:

```typescript
type ActionResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };
```

### 2. Input Validation

Always validate with Zod:

```typescript
try {
  const validated = createTaskSchema.parse(input);
  // Use validated, not input
} catch (error) {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: error.errors.map((e) => e.message).join(", "),
    };
  }
}
```

### 3. Authentication Check

Always load and validate context:

```typescript
const appContext = await loadAppContextServer();

if (!appContext?.activeOrgId) {
  return { success: false, error: "No active organization" };
}

// For mutations that need user ID
if (!appContext?.user?.id) {
  return { success: false, error: "Authentication required" };
}
```

### 4. Error Handling

Catch all errors and return user-friendly messages:

```typescript
try {
  // Action logic
} catch (error) {
  console.error("Error in actionName:", error);

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

### 5. Service Call

Delegate business logic to service:

```typescript
// ✅ GOOD - Call service
const task = await TasksService.createTask(validated, orgId, userId);

// ❌ BAD - Don't put business logic in action
const { data } = await supabase.from("tasks").insert(validated);
```

## Advanced Patterns

### Batch Operations

```typescript
export async function bulkUpdateTasks(
  taskIds: string[],
  input: UpdateTaskInput
): Promise<ActionResponse<void>> {
  try {
    const validated = updateTaskSchema.parse(input);
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // Update each task
    await Promise.all(
      taskIds.map((id) => TasksService.updateTask(id, appContext.activeOrgId, validated))
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error in bulkUpdateTasks:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tasks",
    };
  }
}
```

### Permission Checking

```typescript
import { checkPermission } from "@/utils/auth/permissions";

export async function deleteTask(taskId: string): Promise<ActionResponse<void>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId || !appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    // Check permission
    const hasPermission = await checkPermission(
      appContext.user.id,
      "tasks:delete",
      appContext.activeOrgId
    );

    if (!hasPermission) {
      return { success: false, error: "Permission denied" };
    }

    await TasksService.deleteTask(taskId, appContext.activeOrgId);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error in deleteTask:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete task",
    };
  }
}
```

### Optimistic Updates Data

Return data needed for optimistic updates:

```typescript
export async function toggleTaskComplete(
  taskId: string
): Promise<ActionResponse<{ id: string; status: string; completed_at: string | null }>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const task = await TasksService.getTask(taskId, appContext.activeOrgId);

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const newStatus = task.status === "done" ? "todo" : "done";
    const updatedTask = await TasksService.updateTask(taskId, appContext.activeOrgId, {
      status: newStatus,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    });

    return {
      success: true,
      data: {
        id: updatedTask.id,
        status: updatedTask.status,
        completed_at: updatedTask.completed_at,
      },
    };
  } catch (error) {
    console.error("Error in toggleTaskComplete:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle task status",
    };
  }
}
```

## Type Safety

Use `ReturnType` to infer types from service methods:

```typescript
export async function getTask(
  taskId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof TasksService.getTask>>>> {
  // TypeScript will infer the correct return type from TasksService.getTask
}
```

## Calling from Client

Actions are called from React Query hooks or directly from client components:

```tsx
// From React Query hook
const { data } = useQuery({
  queryKey: ["tasks"],
  queryFn: async () => {
    const result = await getTasks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
});

// Direct call in event handler
async function handleCreateTask(input: CreateTaskInput) {
  const result = await createTask(input);
  if (result.success) {
    toast.success("Task created!");
  } else {
    toast.error(result.error);
  }
}
```

## Testing Server Actions

```typescript
import { createTask, getTasks } from "./_actions";

// Mock loadAppContextServer
jest.mock("@/lib/api/load-app-context-server", () => ({
  loadAppContextServer: jest.fn().mockResolvedValue({
    activeOrgId: "org-123",
    user: { id: "user-123" },
  }),
}));

describe("Task Actions", () => {
  it("should create a task", async () => {
    const result = await createTask({
      title: "Test task",
      priority: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe("Test task");
  });

  it("should return error for invalid input", async () => {
    const result = await createTask({
      title: "", // Invalid: empty string
      priority: "normal",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Title");
  });
});
```

## Common Mistakes

### ❌ DON'T: Put business logic in actions

```typescript
export async function createTask(input: CreateTaskInput) {
  // ❌ Don't do validation here
  if (input.priority === "urgent" && !input.due_date) {
    throw new Error("Urgent tasks need due date");
  }

  const { data } = await supabase.from("tasks").insert(input);
  return { success: true, data };
}
```

### ✅ DO: Delegate to service

```typescript
export async function createTask(input: CreateTaskInput) {
  const validated = createTaskSchema.parse(input);
  const appContext = await loadAppContextServer();

  // ✅ Let service handle business logic
  const task = await TasksService.createTask(validated, appContext.activeOrgId, appContext.user.id);

  return { success: true, data: task };
}
```

---

### ❌ DON'T: Access database directly

```typescript
export async function getTasks() {
  // ❌ Never do this in actions
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select();
  return { success: true, data };
}
```

### ✅ DO: Call service

```typescript
export async function getTasks() {
  const appContext = await loadAppContextServer();

  // ✅ Always use service
  const tasks = await TasksService.getTasks(appContext.activeOrgId);

  return { success: true, data: tasks };
}
```

## Next Steps

- [Building React Query Hooks](./06-creating-react-query-hooks.md) - Call actions from hooks
- [Building Pages & Components](./07-creating-pages-components.md) - Use actions in UI
- [Error Handling](./14-error-handling.md) - Advanced error patterns
