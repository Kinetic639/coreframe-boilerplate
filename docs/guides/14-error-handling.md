# Error Handling

## Overview

This guide covers error handling patterns across all layers of the application, from database errors to user-facing messages.

## Error Flow

```
Database Error
    ↓
Service throws Error
    ↓
Server Action catches & returns { success: false, error: string }
    ↓
React Query onError
    ↓
Toast Notification (react-toastify)
```

## Service Layer Errors

### Basic Pattern

```typescript
export class TasksService {
  static async getTask(id: string, orgId: string): Promise<Task | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    // Handle specific error codes
    if (error) {
      if (error.code === "PGRST116") {
        // Not found - return null instead of throwing
        return null;
      }
      // Throw descriptive error for other cases
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    return data;
  }
}
```

### Business Logic Errors

```typescript
static async createTask(
  input: CreateTaskInput,
  orgId: string,
  userId: string
): Promise<Task> {
  const supabase = await createClient();

  // Validate business rules - throw clear errors
  if (input.priority === "urgent" && !input.due_date) {
    throw new Error("Urgent tasks must have a due date");
  }

  if (input.due_date && new Date(input.due_date) < new Date()) {
    throw new Error("Due date cannot be in the past");
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      organization_id: orgId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Handle specific database errors
    if (error.code === "23505") {
      throw new Error("A task with this title already exists");
    }

    if (error.code === "23503") {
      throw new Error("Invalid reference: assigned user does not exist");
    }

    throw new Error(`Failed to create task: ${error.message}`);
  }

  return data;
}
```

### Common Supabase Error Codes

```typescript
const POSTGRES_ERROR_CODES = {
  "23505": "Unique constraint violation",
  "23503": "Foreign key violation",
  "23502": "Not null violation",
  "23514": "Check constraint violation",
  PGRST116: "Row not found",
  "42501": "Insufficient privileges (RLS)",
} as const;

function getErrorMessage(error: PostgrestError): string {
  const knownError = POSTGRES_ERROR_CODES[error.code];
  if (knownError) {
    return `${knownError}: ${error.message}`;
  }
  return error.message;
}
```

## Server Action Errors

### Standard Error Handling

```typescript
"use server";

import { z } from "zod";
import { TasksService } from "@/server/services/tasks.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { createTaskSchema } from "@/lib/schemas/tasks.schemas";

type ActionResponse<T> = { success: true; data: T } | { success: false; error: string };

export async function createTask(input: CreateTaskInput): Promise<ActionResponse<Task>> {
  try {
    // 1. Validate input (Zod errors)
    const validated = createTaskSchema.parse(input);

    // 2. Check authentication
    const appContext = await loadAppContextServer();
    if (!appContext?.user?.id || !appContext?.activeOrgId) {
      return { success: false, error: "Authentication required" };
    }

    // 3. Call service (business logic errors)
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

    // Handle service/business errors
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}
```

### Detailed Error Response

For more granular error handling:

```typescript
type ActionResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
      fieldErrors?: Record<string, string>;
    };

export async function createTask(input: CreateTaskInput) {
  try {
    const validated = createTaskSchema.parse(input);
    const appContext = await loadAppContextServer();

    if (!appContext?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
        errorCode: "AUTH_REQUIRED",
      };
    }

    const task = await TasksService.createTask(
      validated,
      appContext.activeOrgId,
      appContext.user.id
    );

    return { success: true, data: task };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return field-level errors
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const field = err.path.join(".");
        fieldErrors[field] = err.message;
      });

      return {
        success: false,
        error: "Validation failed",
        errorCode: "VALIDATION_ERROR",
        fieldErrors,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
      errorCode: "UNKNOWN_ERROR",
    };
  }
}
```

## React Query Error Handling

### Query Error Handling

```typescript
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const result = await getTasks();

      // Throw error if action failed
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    // Optional: retry configuration
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error.message.includes("Authentication")) {
        return false;
      }
      // Retry network errors up to 3 times
      return failureCount < 3;
    },
  });
}
```

### Mutation Error Handling

```typescript
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Task created successfully");
      } else {
        // Action returned error
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      // Network or unexpected error
      console.error("Mutation error:", error);
      toast.error(error.message || "An unexpected error occurred");
    },
  });
}
```

### Global Error Handling

```typescript
// src/app/providers.tsx

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error: Error) => {
        // Log to error tracking service
        console.error("Query error:", error);
      },
    },
    mutations: {
      onError: (error: Error) => {
        // Global mutation error handler
        console.error("Mutation error:", error);

        // Don't show toast here if handled in hook
      },
    },
  },
});
```

## Component Error Handling

### Error Boundaries

```tsx
// src/components/ErrorBoundary.tsx
"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8">
          <h2 className="text-2xl font-bold text-destructive mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>Try again</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Usage

```tsx
// Wrap components that might error
<ErrorBoundary>
  <TasksClient />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary
  fallback={
    <div className="text-center p-8">
      <p>Failed to load tasks</p>
    </div>
  }
>
  <TasksClient />
</ErrorBoundary>
```

### Query Error Display

```tsx
"use client";

import { useTasks } from "@/lib/hooks/queries/tasks-queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TasksList() {
  const { data: tasks, isLoading, error, refetch } = useTasks();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error.message || "Failed to load tasks"}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // ... rest of component
}
```

## Toast Notifications

### Using react-toastify

```typescript
import { toast } from "react-toastify";

// Success
toast.success("Task created successfully");

// Error
toast.error("Failed to create task");

// Error with details
toast.error("Failed to create task: Title is required");

// Info
toast.info("Task assigned to John Doe");

// Warning
toast.warning("Task is overdue");

// Custom duration
toast.success("Saved", { autoClose: 2000 });

// Promise-based (shows loading/success/error)
toast.promise(createTask(input), {
  pending: "Creating task...",
  success: "Task created!",
  error: "Failed to create task",
});
```

### Mutation with Toast

```typescript
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onMutate: () => {
      // Optional: Show loading toast
      toast.info("Creating task...", { autoClose: false, toastId: "create-task" });
    },
    onSuccess: (result) => {
      toast.dismiss("create-task");

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Task created successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.dismiss("create-task");
      toast.error(error.message || "Failed to create task");
    },
  });
}
```

## Form Error Handling

### React Hook Form Errors

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTaskSchema, type CreateTaskInput } from "@/lib/schemas/tasks.schemas";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function TaskForm() {
  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
  });

  const createTask = useCreateTask();

  async function onSubmit(data: CreateTaskInput) {
    const result = await createTask.mutateAsync(data);

    if (!result.success) {
      // Set form-level error
      form.setError("root", {
        type: "manual",
        message: result.error,
      });

      // Or set field-specific errors
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          form.setError(field as any, {
            type: "manual",
            message,
          });
        });
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}

        {/* Display root error */}
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={createTask.isPending}>
          Create Task
        </Button>
      </form>
    </Form>
  );
}
```

## Error Logging

### Client-Side Logging

```typescript
// src/lib/error-logger.ts

export function logError(error: Error, context?: Record<string, any>) {
  console.error("Error:", error.message, context);

  // Send to error tracking service (e.g., Sentry)
  if (typeof window !== "undefined") {
    // Sentry.captureException(error, { extra: context });
  }
}

// Usage
try {
  await createTask(input);
} catch (error) {
  logError(error as Error, {
    action: "createTask",
    input,
  });
  throw error;
}
```

### Server-Side Logging

```typescript
"use server";

export async function createTask(input: CreateTaskInput) {
  try {
    // ... action logic
  } catch (error) {
    // Log error with context
    console.error("Server error in createTask:", {
      error: error instanceof Error ? error.message : "Unknown error",
      input,
      timestamp: new Date().toISOString(),
    });

    // Log to database audit table
    await supabase.from("error_logs").insert({
      error_type: "server_action",
      error_message: error instanceof Error ? error.message : "Unknown",
      context: { action: "createTask", input },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}
```

## Best Practices

### 1. Use Specific Error Messages

```typescript
// ❌ BAD
throw new Error("Error");

// ✅ GOOD
throw new Error("Failed to create task: title is required");
```

### 2. Handle Expected Errors Gracefully

```typescript
// Return null for "not found" instead of throwing
if (error.code === "PGRST116") {
  return null;
}
```

### 3. Don't Expose Sensitive Information

```typescript
// ❌ BAD
throw new Error(`Database error: ${error.details}`);

// ✅ GOOD
throw new Error("Failed to fetch task");
console.error("Database error details:", error); // Log internally only
```

### 4. Provide Actionable Error Messages

```typescript
// ❌ BAD
"An error occurred";

// ✅ GOOD
"Failed to save changes. Please check your internet connection and try again.";
```

### 5. Use Error Boundaries for React Errors

```tsx
// Wrap entire sections
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

## Next Steps

- [Security Patterns](./13-security-patterns.md) - Handle security errors
- [Troubleshooting](./17-troubleshooting.md) - Debug common issues
- [Testing](./15-testing.md) - Test error scenarios
