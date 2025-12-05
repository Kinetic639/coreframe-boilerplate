# Building Pages & Components

## Overview

This guide covers creating Server Components (pages) and Client Components following the SSR-first architecture.

## Key Principles

1. **Server Components by default**: Pages are always Server Components
2. **Client Components when needed**: Use `"use client"` only for interactivity
3. **Load context server-side**: Use `loadAppContextServer()` in pages
4. **Delegate to client**: Let client components handle data fetching
5. **Use shadcn/ui**: Always prefer shadcn/ui components over custom UI

## Page Structure (Server Component)

**Location**: `src/app/[locale]/dashboard/[module]/[feature]/page.tsx`

### Basic Page Template

```tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { TasksClient } from "./tasks-client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";

export default async function TasksPage() {
  // Load context server-side
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage your tasks and track progress</p>
        </div>

        {/* Role-based action button */}
        {appContext?.activeOrgId && (
          <HasAnyRoleServer
            checks={[
              { role: "org_owner", scope: "org", id: appContext.activeOrgId },
              { role: "org_admin", scope: "org", id: appContext.activeOrgId },
            ]}
          >
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </HasAnyRoleServer>
        )}
      </div>

      {/* Client Component */}
      <TasksClient />
    </div>
  );
}
```

### Page with Metadata

```tsx
import { Metadata } from "next";
import { generateDashboardMetadata, MetadataProps } from "@/lib/metadata";

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  return generateDashboardMetadata(params, "metadata.dashboard.tasks");
}

export default async function TasksPage() {
  // ... page content
}
```

### Page with Search Params

```tsx
type SearchParams = { [key: string]: string | string[] | undefined };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function TasksPage({ searchParams }: Props) {
  const appContext = await loadAppContextServer();
  const params = await searchParams;

  // Extract search params
  const status = params.status as string | undefined;
  const priority = params.priority as string | undefined;

  return (
    <div className="container mx-auto py-8">
      <TasksClient initialStatus={status} initialPriority={priority} />
    </div>
  );
}
```

### Dynamic Route Page

```tsx
type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  const appContext = await loadAppContextServer();

  if (!appContext?.activeOrgId) {
    return <div>No active organization</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <TaskDetailClient taskId={id} />
    </div>
  );
}
```

## Client Component Structure

**Location**: `src/app/[locale]/dashboard/[module]/[feature]/[name]-client.tsx`

### List Component with React Query

```tsx
"use client";

import { useTasks, useDeleteTask } from "@/lib/hooks/queries/tasks-queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Edit } from "lucide-react";

export function TasksClient() {
  const { data: tasks, isLoading, error } = useTasks();
  const deleteTask = useDeleteTask();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error loading tasks: {error.message}</div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks found. Create your first task to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              <Badge variant={task.status === "done" ? "default" : "secondary"}>
                {task.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{task.description}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete this task?")) {
                    deleteTask.mutate(task.id);
                  }
                }}
                disabled={deleteTask.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Detail Component

```tsx
"use client";

import { useTask, useUpdateTask } from "@/lib/hooks/queries/tasks-queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, Tag } from "lucide-react";

type Props = {
  taskId: string;
};

export function TaskDetailClient({ taskId }: Props) {
  const { data: task, isLoading, error } = useTask(taskId);
  const updateTask = useUpdateTask();

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (error || !task) {
    return <div className="text-center py-8 text-destructive">Task not found</div>;
  }

  function handleToggleStatus() {
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      taskId: task.id,
      input: { status: newStatus },
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-2xl">{task.title}</CardTitle>
            <Badge variant={task.status === "done" ? "default" : "secondary"}>{task.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{task.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Priority: {task.priority}</span>
            </div>

            {task.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Due: {new Date(task.due_date).toLocaleDateString()}</span>
              </div>
            )}

            {task.assignee && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Assigned to: {task.assignee.first_name} {task.assignee.last_name}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleToggleStatus} disabled={updateTask.isPending}>
              Mark as {task.status === "done" ? "Todo" : "Done"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Form Component with Dialog

```tsx
"use client";

import { useState } from "react";
import { useCreateTask } from "@/lib/hooks/queries/tasks-queries";
import { createTaskSchema, type CreateTaskInput } from "@/lib/schemas/tasks.schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask();

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "normal",
    },
  });

  async function onSubmit(data: CreateTaskInput) {
    createTask.mutate(data, {
      onSuccess: (result) => {
        if (result.success) {
          setOpen(false);
          form.reset();
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to your list</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Task description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

## Common UI Patterns

### Loading States

```tsx
if (isLoading) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </div>
  );
}
```

### Error States

```tsx
if (error) {
  return (
    <div className="text-center py-8 text-destructive">
      <p>Error loading data: {error.message}</p>
      <Button onClick={() => refetch()} className="mt-4">
        Try Again
      </Button>
    </div>
  );
}
```

### Empty States

```tsx
if (!data || data.length === 0) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground mb-4">No tasks found</p>
      <CreateTaskDialog />
    </div>
  );
}
```

### Filters with URL State

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "all";

  function handleStatusChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`/dashboard/tasks?${params.toString()}`);
  }

  return (
    <Select value={status} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Tasks</SelectItem>
        <SelectItem value="todo">Todo</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

## shadcn/ui Components Reference

Always use shadcn/ui components:

```bash
# Add components as needed
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add skeleton
npx shadcn@latest add badge
npx shadcn@latest add tabs
npx shadcn@latest add table
```

## Next Steps

- [Zod Schema Validation](./08-zod-schemas.md) - Input validation patterns
- [Common Patterns](./16-common-patterns.md) - Reusable code snippets
- [Error Handling](./14-error-handling.md) - Advanced error handling
