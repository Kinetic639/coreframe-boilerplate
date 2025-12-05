# Security Patterns

## Overview

Security is implemented in multiple layers in this application. This guide covers RLS policies, permission validation, and multi-tenant security patterns.

## Security Layers

```
┌─────────────────────────────────────┐
│  1. Client-Side Role Guards         │  UI Layer
│     - HasAnyRoleClient/Server       │
│     - Conditional rendering          │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  2. Server Action Auth Checks       │  API Layer
│     - loadAppContextServer()        │
│     - User authentication           │
│     - Permission validation          │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  3. Service Layer Scoping           │  Business Logic
│     - Organization filtering        │
│     - Branch filtering              │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  4. Database RLS Policies           │  Data Layer
│     - Row-level security            │
│     - Policy-based access           │
└─────────────────────────────────────┘
```

## Layer 1: Client-Side Role Guards

### HasAnyRoleServer (Server Components)

```tsx
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";

export default async function TasksPage() {
  const appContext = await loadAppContextServer();

  return (
    <div>
      {/* Show button only to org admins */}
      {appContext?.activeOrgId && (
        <HasAnyRoleServer
          checks={[
            { role: "org_owner", scope: "org", id: appContext.activeOrgId },
            { role: "org_admin", scope: "org", id: appContext.activeOrgId },
          ]}
        >
          <Button>Admin Action</Button>
        </HasAnyRoleServer>
      )}
    </div>
  );
}
```

### HasAnyRoleClient (Client Components)

```tsx
"use client";

import { HasAnyRoleClient } from "@/components/auth/HasAnyRoleClient";
import { useAppStore } from "@/lib/stores/app-store";

export function TaskActions() {
  const { activeOrgId, activeBranchId } = useAppStore();

  return (
    <div>
      {/* Organization-level permission */}
      <HasAnyRoleClient checks={[{ role: "org_owner", scope: "org", id: activeOrgId }]}>
        <Button>Delete Organization</Button>
      </HasAnyRoleClient>

      {/* Branch-level permission */}
      <HasAnyRoleClient checks={[{ role: "branch_admin", scope: "branch", id: activeBranchId }]}>
        <Button>Manage Branch</Button>
      </HasAnyRoleClient>
    </div>
  );
}
```

## Layer 2: Server Action Authentication

### Standard Auth Pattern

```typescript
"use server";

import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export async function createTask(input: CreateTaskInput) {
  try {
    // 1. Load app context (includes user auth)
    const appContext = await loadAppContextServer();

    // 2. Check authentication
    if (!appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    // 3. Check organization context
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // 4. Validate input
    const validated = createTaskSchema.parse(input);

    // 5. Call service with organization scope
    const task = await TasksService.createTask(
      validated,
      appContext.activeOrgId,
      appContext.user.id
    );

    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}
```

### Permission-Based Authorization

```typescript
import { checkPermission } from "@/utils/auth/permissions";

export async function deleteTask(taskId: string) {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.user?.id || !appContext?.activeOrgId) {
      return { success: false, error: "Authentication required" };
    }

    // Check specific permission
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
    return { success: false, error: error.message };
  }
}
```

### Role-Based Authorization

```typescript
import { hasAnyRole } from "@/utils/auth/roles";

export async function archiveCompletedTasks() {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.user?.id || !appContext?.activeOrgId) {
      return { success: false, error: "Authentication required" };
    }

    // Check if user has required role
    const isAdmin = await hasAnyRole(appContext.user.id, [
      { role: "org_owner", scope: "org", id: appContext.activeOrgId },
      { role: "org_admin", scope: "org", id: appContext.activeOrgId },
    ]);

    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const count = await TasksService.archiveCompletedTasks(appContext.activeOrgId);

    return { success: true, data: count };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Layer 3: Service Layer Security

### Organization Scoping

**Always filter by organization_id**:

```typescript
export class TasksService {
  static async getTasks(organizationId: string): Promise<Task[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("organization_id", organizationId) // ← Required
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async updateTask(
    taskId: string,
    organizationId: string, // ← Required parameter
    input: UpdateTaskInput
  ): Promise<Task> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .update(input)
      .eq("id", taskId)
      .eq("organization_id", organizationId) // ← Required filter
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
```

### Branch Scoping (Optional)

For branch-specific data:

```typescript
static async getBranchTasks(
  organizationId: string,
  branchId: string
): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return data || [];
}
```

### Ownership Validation

Verify user owns resource before modification:

```typescript
static async deleteTask(
  taskId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // Get task to verify ownership
  const task = await this.getTask(taskId, organizationId);

  if (!task) {
    throw new Error("Task not found");
  }

  // Only creator or admin can delete
  if (task.created_by !== userId) {
    // Check if user is admin
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .single();

    if (!role || !["org_owner", "org_admin"].includes(role.role)) {
      throw new Error("Permission denied");
    }
  }

  // Soft delete
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}
```

## Layer 4: Database RLS Policies

### Basic RLS Pattern

```sql
-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view tasks in their organization
CREATE POLICY "Users can view organization tasks"
  ON public.tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- INSERT policy: Users can create tasks in their organization
CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy: Users can update tasks in their organization
CREATE POLICY "Users can update organization tasks"
  ON public.tasks FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- DELETE policy: Only admins or creators can delete
CREATE POLICY "Users can delete own tasks or admins can delete"
  ON public.tasks FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND organization_id = tasks.organization_id
      AND role IN ('org_owner', 'org_admin')
    )
  );
```

### Branch-Level RLS

```sql
-- Users can only see tasks in their assigned branches
CREATE POLICY "Users can view branch tasks"
  ON public.tasks FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = auth.uid()
    )
    OR
    branch_id IS NULL -- Organization-level tasks visible to all
  );
```

### Role-Based RLS

```sql
-- Only admins can see all tasks, regular users see only assigned
CREATE POLICY "Admins see all tasks, users see assigned"
  ON public.tasks FOR SELECT
  USING (
    -- Admins see everything in their organization
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND organization_id = tasks.organization_id
      AND role IN ('org_owner', 'org_admin')
    )
    OR
    -- Users see tasks assigned to them
    assigned_to = auth.uid()
    OR
    -- Users see tasks they created
    created_by = auth.uid()
  );
```

### Permission-Based RLS

Using the `public.authorize()` function:

```sql
-- Function to check permissions
CREATE OR REPLACE FUNCTION public.authorize(
  user_id UUID,
  permission TEXT,
  organization_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = user_id
    AND ur.organization_id = organization_id
    AND rp.permission = permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in policy
CREATE POLICY "Users with tasks:delete permission can delete"
  ON public.tasks FOR DELETE
  USING (
    public.authorize(auth.uid(), 'tasks:delete', organization_id)
  );
```

## Multi-Tenant Patterns

### Tenant Isolation

Every table must have organization_id:

```sql
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- other fields
);

-- Index for performance
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
```

### Cross-Tenant Prevention

Prevent accidental cross-tenant data access:

```typescript
// ❌ BAD - Missing organization filter
static async getTask(taskId: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  return data;
}

// ✅ GOOD - Always include organization filter
static async getTask(
  taskId: string,
  organizationId: string
): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .single();
  return data;
}
```

## File Upload Security

### Storage Bucket Policies

```sql
-- Create organization-scoped storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tasks', 'tasks', false);

-- RLS for storage
CREATE POLICY "Users can upload files to their organization"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tasks'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::TEXT FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their organization files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tasks'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::TEXT FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );
```

### Upload Path Structure

```typescript
// Organize uploads by organization
const uploadPath = `${organizationId}/${userId}/${filename}`;

const { data, error } = await supabase.storage.from("tasks").upload(uploadPath, file);
```

## Security Best Practices

### 1. Never Trust Client Input

```typescript
// ❌ BAD - Using client-provided organization ID
export async function createTask(input: { organizationId: string; ...}) {
  await TasksService.createTask(input);
}

// ✅ GOOD - Using server-side context
export async function createTask(input: CreateTaskInput) {
  const appContext = await loadAppContextServer();
  await TasksService.createTask({
    ...input,
    organization_id: appContext.activeOrgId, // From server
  });
}
```

### 2. Validate on Every Layer

```typescript
// Client: Zod validation
const validated = createTaskSchema.parse(input);

// Server Action: Auth check
if (!appContext?.user?.id) throw new Error("Unauthorized");

// Service: Business rules
if (task.priority === "urgent" && !task.due_date) {
  throw new Error("Urgent tasks need due date");
}

// Database: RLS policies enforce access
```

### 3. Use Parameterized Queries

```typescript
// ✅ GOOD - Parameterized (Supabase does this automatically)
.eq("organization_id", organizationId)

// ❌ BAD - String interpolation (vulnerable to injection)
.filter(`organization_id='${organizationId}'`)
```

### 4. Implement Soft Deletes

```typescript
// Don't hard delete (preserve audit trail)
.delete() // ❌

// Soft delete
.update({ deleted_at: new Date().toISOString() }) // ✅
```

### 5. Log Security Events

```typescript
await supabase.from("audit_logs").insert({
  user_id: userId,
  action: "task_deleted",
  resource_type: "task",
  resource_id: taskId,
  organization_id: organizationId,
  metadata: { reason: "user_request" },
});
```

## Testing Security

### Test RLS Policies

```sql
-- Test as specific user
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';

-- Should only see user's organization tasks
SELECT * FROM public.tasks;

ROLLBACK;
```

### Test Permission Checks

```typescript
describe("Task Security", () => {
  it("should prevent cross-tenant access", async () => {
    const org1Task = await TasksService.createTask(input, "org-1", "user-1");

    // Try to access from different org
    await expect(TasksService.getTask(org1Task.id, "org-2")).rejects.toThrow();
  });

  it("should require authentication", async () => {
    // Mock no auth context
    jest.spyOn(loadAppContextServer).mockResolvedValue(null);

    const result = await createTask(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Authentication required");
  });
});
```

## Next Steps

- [Database Migrations](./11-database-migrations.md) - Add RLS policies
- [Creating Service](./04-creating-service.md) - Implement org scoping
- [Error Handling](./14-error-handling.md) - Handle security errors
