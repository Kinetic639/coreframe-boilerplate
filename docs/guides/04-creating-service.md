# Adding a Server-Side Service

## Overview

Services contain **all business logic** for your application. They are static classes that interact with the database and enforce business rules.

## Service Principles

1. **Single Responsibility**: Each service handles one domain (e.g., products, contacts, orders)
2. **Static Methods**: No instantiation needed - all methods are static
3. **Database Operations**: Direct Supabase queries live here
4. **Business Logic**: Validation, transformations, and rules enforcement
5. **Organization Scoping**: Always filter by `organization_id` for multi-tenancy
6. **Error Handling**: Throw descriptive errors that bubble up to actions

## File Structure

```
src/server/services/
  └── [feature].service.ts    # Flat structure (no nesting)
```

## Step-by-Step Guide

### Step 1: Create Service File

**File**: `src/server/services/tasks.service.ts`

```typescript
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from "@/lib/schemas/tasks.schemas";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskWithAssignee = Task & {
  assignee: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

// ==========================================
// TASKS SERVICE
// ==========================================

export class TasksService {
  /**
   * Get all tasks for an organization with optional filters
   *
   * @param organizationId - Organization ID to scope tasks
   * @param filters - Optional filters (status, priority, assignee, etc.)
   * @returns Array of tasks
   */
  static async getTasks(
    organizationId: string,
    filters: TaskFilters = {}
  ): Promise<TaskWithAssignee[]> {
    const supabase = await createClient();

    let query = supabase
      .from("tasks")
      .select(
        `
        *,
        assignee:assigned_to (
          id,
          email,
          first_name,
          last_name
        )
      `
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply filters
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.priority) {
      query = query.eq("priority", filters.priority);
    }

    if (filters.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.due_date_before) {
      query = query.lte("due_date", filters.due_date_before);
    }

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    // Sorting
    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return (data as TaskWithAssignee[]) || [];
  }

  /**
   * Get a single task by ID
   *
   * @param taskId - Task ID
   * @param organizationId - Organization ID for security
   * @returns Task or null if not found
   */
  static async getTask(taskId: string, organizationId: string): Promise<TaskWithAssignee | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        *,
        assignee:assigned_to (
          id,
          email,
          first_name,
          last_name
        )
      `
      )
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    return data as TaskWithAssignee;
  }

  /**
   * Create a new task
   *
   * @param input - Task data from validated schema
   * @param organizationId - Organization ID
   * @param userId - User creating the task
   * @returns Created task
   */
  static async createTask(
    input: CreateTaskInput,
    organizationId: string,
    userId: string
  ): Promise<Task> {
    const supabase = await createClient();

    // Business rule: Due date must be in the future
    if (input.due_date && new Date(input.due_date) < new Date()) {
      throw new Error("Due date must be in the future");
    }

    // Business rule: Priority 'urgent' tasks must have a due date
    if (input.priority === "urgent" && !input.due_date) {
      throw new Error("Urgent tasks must have a due date");
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        ...input,
        organization_id: organizationId,
        created_by: userId,
        status: "todo", // Default status
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing task
   *
   * @param taskId - Task ID to update
   * @param organizationId - Organization ID for security
   * @param input - Partial task data to update
   * @returns Updated task
   */
  static async updateTask(
    taskId: string,
    organizationId: string,
    input: UpdateTaskInput
  ): Promise<Task> {
    const supabase = await createClient();

    // Check task exists
    const existing = await this.getTask(taskId, organizationId);
    if (!existing) {
      throw new Error("Task not found");
    }

    // Business rule: Can't change status from 'done' back to 'todo'
    if (existing.status === "done" && input.status === "todo") {
      throw new Error("Cannot reopen completed tasks");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a task (soft delete)
   *
   * @param taskId - Task ID to delete
   * @param organizationId - Organization ID for security
   */
  static async deleteTask(taskId: string, organizationId: string): Promise<void> {
    const supabase = await createClient();

    // Check task exists
    const existing = await this.getTask(taskId, organizationId);
    if (!existing) {
      throw new Error("Task not found");
    }

    // Soft delete
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  /**
   * Assign a task to a user
   *
   * @param taskId - Task ID
   * @param organizationId - Organization ID for security
   * @param userId - User ID to assign to
   * @returns Updated task
   */
  static async assignTask(taskId: string, organizationId: string, userId: string): Promise<Task> {
    const supabase = await createClient();

    // Business rule: Can only assign to users in the same organization
    const { data: userOrg, error: userError } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .single();

    if (userError || !userOrg) {
      throw new Error("User not found in organization");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({
        assigned_to: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign task: ${error.message}`);
    }

    return data;
  }

  /**
   * Get task statistics for an organization
   *
   * @param organizationId - Organization ID
   * @returns Task statistics
   */
  static async getTaskStats(organizationId: string): Promise<{
    total: number;
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
  }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .select("status, due_date")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch task stats: ${error.message}`);
    }

    const now = new Date();
    const stats = {
      total: data.length,
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    };

    data.forEach((task) => {
      if (task.status === "todo") stats.todo++;
      if (task.status === "in_progress") stats.in_progress++;
      if (task.status === "done") stats.done++;

      if (task.due_date && new Date(task.due_date) < now && task.status !== "done") {
        stats.overdue++;
      }
    });

    return stats;
  }
}
```

## Key Patterns

### 1. Organization Scoping

Always filter by `organization_id`:

```typescript
.eq("organization_id", organizationId)
```

### 2. Soft Deletes

Use `deleted_at` instead of hard deletes:

```typescript
.is("deleted_at", null)  // In queries

.update({ deleted_at: new Date().toISOString() })  // For deletion
```

### 3. Relations

Use Supabase's `select()` with relations:

```typescript
.select(`
  *,
  assignee:assigned_to (
    id,
    email,
    first_name,
    last_name
  )
`)
```

### 4. Business Rules

Enforce business logic in service methods:

```typescript
// Validate business rules
if (input.priority === "urgent" && !input.due_date) {
  throw new Error("Urgent tasks must have a due date");
}
```

### 5. Error Handling

Throw descriptive errors:

```typescript
if (error) {
  throw new Error(`Failed to create task: ${error.message}`);
}

// Handle "not found" gracefully
if (error.code === "PGRST116") return null;
```

### 6. Pagination

Implement pagination with `range()`:

```typescript
const limit = filters.limit || 50;
const offset = filters.offset || 0;
query = query.range(offset, offset + limit - 1);
```

### 7. Search/Filtering

Use `or()` for multi-field search:

```typescript
if (filters.search) {
  query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
}
```

### 8. Timestamps

Always update `updated_at`:

```typescript
.update({
  ...input,
  updated_at: new Date().toISOString(),
})
```

## Common Service Methods

Every service typically includes:

1. **`getAll()`** - List all items with filters/pagination
2. **`getById()`** - Get single item by ID
3. **`create()`** - Create new item
4. **`update()`** - Update existing item
5. **`delete()`** - Soft delete item
6. **Additional methods** - Domain-specific operations (e.g., `assignTask()`, `getStats()`)

## Type Safety

Always use generated database types:

```typescript
import type { Database } from "@/types/supabase";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
```

## JSDoc Comments

Document all methods with JSDoc:

```typescript
/**
 * Get a single task by ID
 *
 * @param taskId - Task ID
 * @param organizationId - Organization ID for security
 * @returns Task or null if not found
 * @throws Error if database query fails
 */
static async getTask(
  taskId: string,
  organizationId: string
): Promise<TaskWithAssignee | null> {
  // ...
}
```

## Testing Services

Services can be tested independently:

```typescript
import { TasksService } from "@/server/services/tasks.service";

describe("TasksService", () => {
  it("should create a task", async () => {
    const task = await TasksService.createTask(
      {
        title: "Test task",
        priority: "normal",
      },
      "org-id",
      "user-id"
    );

    expect(task.title).toBe("Test task");
  });

  it("should enforce urgent task due date rule", async () => {
    await expect(
      TasksService.createTask(
        {
          title: "Urgent task",
          priority: "urgent",
          // Missing due_date
        },
        "org-id",
        "user-id"
      )
    ).rejects.toThrow("Urgent tasks must have a due date");
  });
});
```

## Next Steps

- [Creating Server Actions](./05-creating-server-actions.md) - Call services from actions
- [Extending Services](./09-extending-services.md) - Add methods to existing services
- [Security Patterns](./13-security-patterns.md) - RLS and permission validation
