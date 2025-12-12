# Zod Schema Validation

## Overview

Zod schemas provide type-safe input validation for server actions and forms. They serve as the contract between client and server.

## Key Principles

1. **Single source of types**: Define schema once, infer TypeScript types
2. **Validation messages**: Include user-friendly error messages
3. **Schema reuse**: Create base schema, extend for variations
4. **Export types**: Export inferred types for use in code
5. **Group by domain**: One schema file per feature

## File Location

```
src/lib/schemas/
  └── [feature].schemas.ts    # e.g., tasks.schemas.ts
```

## Basic Schema Template

**File**: `src/lib/schemas/tasks.schemas.ts`

```typescript
import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const taskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);

export const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a task
 */
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional().nullable(),
  priority: taskPrioritySchema.default("normal"),
  due_date: z.string().datetime().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

/**
 * Schema for updating a task
 * Partial makes all fields optional
 */
export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusSchema.optional(),
});

/**
 * Schema for filtering tasks
 */
export const taskFiltersSchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigned_to: z.string().uuid().optional(),
  search: z.string().optional(),
  due_date_before: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
```

## Common Validation Patterns

### String Validation

```typescript
// Required string
z.string().min(1, "Field is required");

// Optional string
z.string().optional().nullable();

// String with length constraints
z.string().min(3, "Min 3 characters").max(100, "Max 100 characters");

// Email
z.string().email("Invalid email address");

// URL
z.string().url("Invalid URL");

// Regex pattern
z.string().regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens");

// UUID
z.string().uuid("Invalid UUID");

// Transform to lowercase
z.string().toLowerCase();

// Trim whitespace
z.string().trim();
```

### Number Validation

```typescript
// Required number
z.number();

// Optional number
z.number().optional().nullable();

// Min/max
z.number().min(0, "Must be non-negative").max(100, "Max value is 100");

// Integer
z.number().int("Must be an integer");

// Positive
z.number().positive("Must be positive");

// Non-negative
z.number().nonnegative("Cannot be negative");

// Default value
z.number().default(0);
```

### Date Validation

```typescript
// ISO datetime string
z.string().datetime();

// Date object
z.date();

// Date in the future
z.string()
  .datetime()
  .refine((date) => new Date(date) > new Date(), { message: "Date must be in the future" });

// Date range
z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine((data) => new Date(data.end_date) > new Date(data.start_date), {
  message: "End date must be after start date",
  path: ["end_date"],
});
```

### Array Validation

```typescript
// Array of strings
z.array(z.string());

// Array with min/max length
z.array(z.string()).min(1, "At least one item required").max(10, "Max 10 items");

// Optional array with default
z.array(z.string()).default([]);

// Array of objects
z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
  })
);

// Non-empty array
z.array(z.string()).nonempty("Array cannot be empty");
```

### Object Validation

```typescript
// Basic object
z.object({
  name: z.string(),
  age: z.number(),
});

// Nested object
z.object({
  user: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  settings: z.object({
    theme: z.enum(["light", "dark"]),
  }),
});

// Optional fields
z.object({
  required: z.string(),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
});

// Dynamic keys (record)
z.record(z.string()); // { [key: string]: string }
z.record(z.any()); // { [key: string]: any }
```

### Enum Validation

```typescript
// String enum
z.enum(["option1", "option2", "option3"]);

// With default
z.enum(["small", "medium", "large"]).default("medium");

// Native enum (if using TypeScript enum)
enum Role {
  Admin = "admin",
  User = "user",
}
z.nativeEnum(Role);
```

### Boolean Validation

```typescript
// Required boolean
z.boolean();

// Optional with default
z.boolean().default(false);

// Optional
z.boolean().optional();
```

## Advanced Patterns

### Schema Composition

```typescript
// Base schema
const baseTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

// Extend base schema
export const createTaskSchema = baseTaskSchema.extend({
  priority: taskPrioritySchema.default("normal"),
  due_date: z.string().datetime().optional(),
});

// Make all fields optional
export const updateTaskSchema = baseTaskSchema.partial();

// Pick specific fields
export const taskTitleSchema = baseTaskSchema.pick({ title: true });

// Omit specific fields
export const taskWithoutDescriptionSchema = baseTaskSchema.omit({
  description: true,
});
```

### Custom Refinements

```typescript
// Single field validation
export const urgentTaskSchema = z
  .object({
    priority: z.enum(["low", "normal", "high", "urgent"]),
    due_date: z.string().datetime().optional(),
  })
  .refine((data) => data.priority !== "urgent" || data.due_date !== undefined, {
    message: "Urgent tasks must have a due date",
    path: ["due_date"],
  });

// Cross-field validation
export const dateRangeSchema = z
  .object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "End date must be after start date",
    path: ["end_date"],
  });

// Multiple refinements
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((val) => /[A-Z]/.test(val), { message: "Password must contain an uppercase letter" })
  .refine((val) => /[0-9]/.test(val), { message: "Password must contain a number" });
```

### Transformations

```typescript
// Transform to lowercase
export const slugSchema = z
  .string()
  .min(1)
  .transform((val) => val.toLowerCase().replace(/\s+/g, "-"));

// Parse number from string
export const priceSchema = z
  .string()
  .transform((val) => parseFloat(val))
  .pipe(z.number().min(0));

// JSON string to object
export const metadataSchema = z
  .string()
  .transform((val) => JSON.parse(val))
  .pipe(z.record(z.any()));

// Date string to Date object
export const dateTransformSchema = z
  .string()
  .datetime()
  .transform((val) => new Date(val));
```

### Union and Discriminated Unions

```typescript
// Union (either/or)
export const contactSchema = z.union([
  z.object({ type: z.literal("email"), email: z.string().email() }),
  z.object({ type: z.literal("phone"), phone: z.string() }),
]);

// Discriminated union (better type inference)
export const notificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email"),
    subject: z.string(),
    body: z.string(),
    to: z.string().email(),
  }),
  z.object({
    type: z.literal("sms"),
    message: z.string(),
    to: z.string(),
  }),
  z.object({
    type: z.literal("push"),
    title: z.string(),
    body: z.string(),
    user_id: z.string().uuid(),
  }),
]);
```

### Recursive Schemas

```typescript
// Comment with nested replies
type Comment = {
  id: string;
  text: string;
  replies?: Comment[];
};

export const commentSchema: z.ZodType<Comment> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    text: z.string(),
    replies: z.array(commentSchema).optional(),
  })
);
```

## Using Schemas in Forms

### With React Hook Form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTaskSchema, type CreateTaskInput } from "@/lib/schemas/tasks.schemas";

function TaskForm() {
  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      priority: "normal",
      tags: [],
    },
  });

  function onSubmit(data: CreateTaskInput) {
    // data is automatically validated and typed
    console.log(data);
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* form fields */}</form>;
}
```

### Manual Validation

```typescript
import { createTaskSchema } from "@/lib/schemas/tasks.schemas";

try {
  const validated = createTaskSchema.parse(input);
  // validated is typed as CreateTaskInput
} catch (error) {
  if (error instanceof z.ZodError) {
    // error.errors contains validation errors
    console.log(error.errors);
  }
}

// Safe parse (doesn't throw)
const result = createTaskSchema.safeParse(input);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.errors);
}
```

## Error Handling

```typescript
try {
  const validated = createTaskSchema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Format errors for user display
    const formattedErrors = error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    // Or join messages
    const errorMessage = error.errors.map((e) => e.message).join(", ");

    return { success: false, error: errorMessage };
  }
}
```

## Next Steps

- [Creating Server Actions](./05-creating-server-actions.md) - Use schemas in actions
- [Building Pages & Components](./07-creating-pages-components.md) - Use in forms
- [Common Patterns](./16-common-patterns.md) - Reusable validation patterns
