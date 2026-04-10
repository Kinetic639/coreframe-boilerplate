# Testing Guide

## Overview

This guide covers testing strategies for the SSR-first architecture, including unit tests, integration tests, and end-to-end tests.

## Testing Stack

- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: Jest with mocked services
- **E2E Tests**: Playwright or Cypress
- **Type Checking**: TypeScript compiler

## Testing Layers

```
┌─────────────────────────────┐
│  E2E Tests                  │  Full user flows
│  (Playwright/Cypress)       │
└─────────────────────────────┘
            ↓
┌─────────────────────────────┐
│  Integration Tests          │  Multiple layers
│  (Jest + MSW)               │
└─────────────────────────────┘
            ↓
┌─────────────────────────────┐
│  Unit Tests                 │  Individual functions
│  (Jest + RTL)               │
└─────────────────────────────┘
```

## Unit Testing

### Testing Services

**File**: `src/server/services/__tests__/tasks.service.test.ts`

```typescript
import { TasksService } from "../tasks.service";
import { createClient } from "@/utils/supabase/server";

// Mock Supabase
jest.mock("@/utils/supabase/server");

describe("TasksService", () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe("getTasks", () => {
    it("should fetch tasks for organization", async () => {
      const mockTasks = [
        { id: "1", title: "Task 1", organization_id: "org-1" },
        { id: "2", title: "Task 2", organization_id: "org-1" },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockTasks,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await TasksService.getTasks("org-1");

      expect(result).toEqual(mockTasks);
      expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    });

    it("should throw error on database failure", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Database error" },
              }),
            }),
          }),
        }),
      });

      await expect(TasksService.getTasks("org-1")).rejects.toThrow("Failed to fetch tasks");
    });
  });

  describe("createTask", () => {
    it("should enforce business rules", async () => {
      const input = {
        title: "Urgent Task",
        priority: "urgent" as const,
        // Missing due_date
      };

      await expect(TasksService.createTask(input, "org-1", "user-1")).rejects.toThrow(
        "Urgent tasks must have a due date"
      );
    });

    it("should create task with valid input", async () => {
      const input = {
        title: "Task",
        priority: "normal" as const,
        due_date: "2024-12-31",
      };

      const mockTask = {
        id: "1",
        ...input,
        organization_id: "org-1",
        created_by: "user-1",
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTask,
              error: null,
            }),
          }),
        }),
      });

      const result = await TasksService.createTask(input, "org-1", "user-1");

      expect(result).toEqual(mockTask);
    });
  });
});
```

### Testing Server Actions

**File**: `src/app/[locale]/dashboard/tasks/__tests__/_actions.test.ts`

```typescript
import { createTask, getTasks } from "../_actions";
import { TasksService } from "@/server/services/tasks.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

// Mock dependencies
jest.mock("@/server/services/tasks.service");
jest.mock("@/lib/api/load-app-context-server");

describe("Task Actions", () => {
  const mockAppContext = {
    activeOrgId: "org-1",
    activeBranchId: "branch-1",
    user: { id: "user-1", email: "user@example.com" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (loadAppContextServer as jest.Mock).mockResolvedValue(mockAppContext);
  });

  describe("getTasks", () => {
    it("should return tasks on success", async () => {
      const mockTasks = [
        { id: "1", title: "Task 1" },
        { id: "2", title: "Task 2" },
      ];

      (TasksService.getTasks as jest.Mock).mockResolvedValue(mockTasks);

      const result = await getTasks();

      expect(result).toEqual({
        success: true,
        data: mockTasks,
      });
      expect(TasksService.getTasks).toHaveBeenCalledWith("org-1", {});
    });

    it("should return error when no organization", async () => {
      (loadAppContextServer as jest.Mock).mockResolvedValue({
        ...mockAppContext,
        activeOrgId: null,
      });

      const result = await getTasks();

      expect(result).toEqual({
        success: false,
        error: "No active organization",
      });
    });

    it("should handle service errors", async () => {
      (TasksService.getTasks as jest.Mock).mockRejectedValue(new Error("Database error"));

      const result = await getTasks();

      expect(result).toEqual({
        success: false,
        error: "Database error",
      });
    });
  });

  describe("createTask", () => {
    it("should create task with valid input", async () => {
      const input = {
        title: "New Task",
        priority: "normal" as const,
      };

      const mockTask = { id: "1", ...input };

      (TasksService.createTask as jest.Mock).mockResolvedValue(mockTask);

      const result = await createTask(input);

      expect(result).toEqual({
        success: true,
        data: mockTask,
      });
    });

    it("should validate input with Zod", async () => {
      const input = {
        title: "", // Invalid: empty string
        priority: "normal" as const,
      };

      const result = await createTask(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Title");
    });

    it("should require authentication", async () => {
      (loadAppContextServer as jest.Mock).mockResolvedValue({
        ...mockAppContext,
        user: null,
      });

      const result = await createTask({ title: "Task", priority: "normal" });

      expect(result).toEqual({
        success: false,
        error: "Authentication required",
      });
    });
  });
});
```

### Testing React Query Hooks

**File**: `src/lib/hooks/queries/__tests__/tasks-queries.test.tsx`

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTasks, useCreateTask } from "../tasks-queries";
import * as actions from "@/app/[locale]/dashboard/tasks/_actions";

// Mock server actions
jest.mock("@/app/[locale]/dashboard/tasks/_actions");

describe("Task Queries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useTasks", () => {
    it("should fetch tasks", async () => {
      const mockTasks = [
        { id: "1", title: "Task 1" },
        { id: "2", title: "Task 2" },
      ];

      (actions.getTasks as jest.Mock).mockResolvedValue({
        success: true,
        data: mockTasks,
      });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTasks);
    });

    it("should handle errors", async () => {
      (actions.getTasks as jest.Mock).mockResolvedValue({
        success: false,
        error: "Failed to fetch",
      });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Failed to fetch");
    });
  });

  describe("useCreateTask", () => {
    it("should create task", async () => {
      const mockTask = { id: "1", title: "New Task" };

      (actions.createTask as jest.Mock).mockResolvedValue({
        success: true,
        data: mockTask,
      });

      const { result } = renderHook(() => useCreateTask(), { wrapper });

      result.current.mutate({ title: "New Task", priority: "normal" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
```

### Testing Components

**File**: `src/app/[locale]/dashboard/tasks/__tests__/tasks-client.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksClient } from "../tasks-client";
import * as queries from "@/lib/hooks/queries/tasks-queries";

jest.mock("@/lib/hooks/queries/tasks-queries");

describe("TasksClient", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should show loading state", () => {
    (queries.useTasks as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<TasksClient />, { wrapper });

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("should show tasks", async () => {
    const mockTasks = [
      { id: "1", title: "Task 1", status: "todo" },
      { id: "2", title: "Task 2", status: "done" },
    ];

    (queries.useTasks as jest.Mock).mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    });

    render(<TasksClient />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Task 2")).toBeInTheDocument();
    });
  });

  it("should show error state", () => {
    (queries.useTasks as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    render(<TasksClient />, { wrapper });

    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
  });

  it("should show empty state", () => {
    (queries.useTasks as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<TasksClient />, { wrapper });

    expect(screen.getByText(/No tasks found/i)).toBeInTheDocument();
  });
});
```

## Integration Testing

### Testing with Mock Service Worker (MSW)

**File**: `src/__tests__/integration/tasks-flow.test.tsx`

```typescript
import { setupServer } from "msw/node";
import { rest } from "msw";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TasksPage } from "@/app/[locale]/dashboard/tasks/page";

// Setup MSW server
const server = setupServer(
  rest.post("/api/tasks", (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: { id: "1", title: "New Task" },
      })
    );
  }),

  rest.get("/api/tasks", (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: [{ id: "1", title: "Task 1" }],
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Tasks Integration", () => {
  it("should create and display task", async () => {
    render(<TasksPage />);

    // Click create button
    fireEvent.click(screen.getByText("Create Task"));

    // Fill form
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New Task" },
    });

    // Submit
    fireEvent.click(screen.getByText("Submit"));

    // Verify task appears
    await waitFor(() => {
      expect(screen.getByText("New Task")).toBeInTheDocument();
    });
  });
});
```

## E2E Testing

### Playwright Example

**File**: `e2e/tasks.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[name="email"]', "user@example.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should create a task", async ({ page }) => {
    // Navigate to tasks
    await page.goto("/dashboard/tasks");

    // Click create button
    await page.click('button:has-text("Create Task")');

    // Fill form
    await page.fill('[name="title"]', "E2E Test Task");
    await page.selectOption('[name="priority"]', "high");

    // Submit
    await page.click('button:has-text("Submit")');

    // Verify toast
    await expect(page.locator(".Toastify")).toContainText("Task created successfully");

    // Verify task appears in list
    await expect(page.locator("text=E2E Test Task")).toBeVisible();
  });

  test("should filter tasks by status", async ({ page }) => {
    await page.goto("/dashboard/tasks");

    // Apply filter
    await page.selectOption('[name="status"]', "done");

    // Wait for filtered results
    await page.waitForSelector('[data-status="done"]');

    // Verify only done tasks shown
    const tasks = await page.locator("[data-task-card]").all();
    for (const task of tasks) {
      await expect(task).toHaveAttribute("data-status", "done");
    }
  });

  test("should delete a task", async ({ page }) => {
    await page.goto("/dashboard/tasks");

    // Click delete on first task
    await page.click('[data-testid="delete-task"]:first-child');

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Verify toast
    await expect(page.locator(".Toastify")).toContainText("Task deleted successfully");
  });
});
```

## Testing Best Practices

### 1. Test User Behavior, Not Implementation

```typescript
// ❌ BAD - Testing implementation
expect(mockService.getTasks).toHaveBeenCalled();

// ✅ GOOD - Testing user-visible behavior
expect(screen.getByText("Task 1")).toBeInTheDocument();
```

### 2. Use Data Test IDs for Stable Selectors

```tsx
<button data-testid="create-task">Create</button>;

// In test
screen.getByTestId("create-task");
```

### 3. Mock at Appropriate Boundaries

```typescript
// ✅ GOOD - Mock at service layer
jest.mock("@/server/services/tasks.service");

// ❌ AVOID - Mocking too deep (database)
jest.mock("@supabase/supabase-js");
```

### 4. Test Error States

```typescript
it("should handle errors gracefully", async () => {
  mockService.getTasks.mockRejectedValue(new Error("Network error"));

  render(<TasksList />);

  await waitFor(() => {
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
  });
});
```

### 5. Test Loading States

```typescript
it("should show loading spinner", () => {
  mockHook.mockReturnValue({
    data: undefined,
    isLoading: true,
  });

  render(<TasksList />);

  expect(screen.getByTestId("skeleton")).toBeInTheDocument();
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test tasks.service.test.ts

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## Coverage Goals

- **Services**: 80%+ coverage
- **Server Actions**: 70%+ coverage
- **React Hooks**: 70%+ coverage
- **Components**: 60%+ coverage
- **Critical Paths**: 90%+ E2E coverage

## Next Steps

- [Error Handling](./14-error-handling.md) - Test error scenarios
- [Security Patterns](./13-security-patterns.md) - Test security
- [Troubleshooting](./17-troubleshooting.md) - Debug test issues
