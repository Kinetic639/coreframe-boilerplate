# Common Patterns

## Overview

This guide contains frequently used code patterns and snippets for quick reference.

## Page Patterns

### Basic Server Component Page

```tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export default async function Page() {
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold">Title</h1>
      <ClientComponent />
    </div>
  );
}
```

### Page with Role-Based Action

```tsx
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const appContext = await loadAppContextServer();

  return (
    <div>
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

### Dynamic Route Page

```tsx
type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function DetailPage({ params }: Props) {
  const { id } = await params;
  const appContext = await loadAppContextServer();

  return <DetailClient id={id} />;
}
```

## Client Component Patterns

### List with Loading/Error States

```tsx
"use client";

import { useItems } from "@/lib/hooks/queries/items-queries";
import { Skeleton } from "@/components/ui/skeleton";

export function ItemsList() {
  const { data: items, isLoading, error } = useItems();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Error: {error.message}</div>;
  }

  if (!items || items.length === 0) {
    return <div className="text-muted-foreground">No items found</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

### Form Dialog with React Hook Form

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateItem } from "@/lib/hooks/queries/items-queries";
import { createItemSchema, type CreateItemInput } from "@/lib/schemas/items.schemas";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";

export function CreateItemDialog() {
  const [open, setOpen] = useState(false);
  const createItem = useCreateItem();

  const form = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CreateItemInput) {
    createItem.mutate(data, {
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
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createItem.isPending}>
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### Filter with URL State

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

export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={status} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

## Service Patterns

### Basic CRUD Service

```typescript
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type Item = Database["public"]["Tables"]["items"]["Row"];

export class ItemsService {
  static async getItems(organizationId: string): Promise<Item[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getItem(id: string, organizationId: string): Promise<Item | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }

    return data;
  }

  static async createItem(input: CreateItemInput, orgId: string, userId: string): Promise<Item> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("items")
      .insert({
        ...input,
        organization_id: orgId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateItem(id: string, orgId: string, input: UpdateItemInput): Promise<Item> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("items")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteItem(id: string, orgId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw new Error(error.message);
  }
}
```

### Service with Relations

```typescript
static async getItemWithDetails(id: string, orgId: string): Promise<ItemWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("items")
    .select(`
      *,
      category:categories (
        id,
        name
      ),
      tags:item_tags (
        id,
        name
      )
    `)
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data as ItemWithDetails;
}
```

## Server Action Patterns

### Standard Action Template

```typescript
"use server";

import { z } from "zod";
import { ItemsService } from "@/server/services/items.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { createItemSchema, type CreateItemInput } from "@/lib/schemas/items.schemas";

type ActionResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };

export async function createItem(
  input: CreateItemInput
): Promise<ActionResponse<Awaited<ReturnType<typeof ItemsService.createItem>>>> {
  try {
    const validated = createItemSchema.parse(input);
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId || !appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    const item = await ItemsService.createItem(
      validated,
      appContext.activeOrgId,
      appContext.user.id
    );

    return { success: true, data: item };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create item",
    };
  }
}
```

## React Query Hook Patterns

### Query Keys Pattern

```typescript
export const itemsKeys = {
  all: ["items"] as const,
  lists: () => [...itemsKeys.all, "list"] as const,
  list: (filters?: ItemFilters) => [...itemsKeys.lists(), filters] as const,
  details: () => [...itemsKeys.all, "detail"] as const,
  detail: (id: string) => [...itemsKeys.details(), id] as const,
};
```

### Query Hook

```typescript
export function useItems(filters?: ItemFilters) {
  return useQuery({
    queryKey: itemsKeys.list(filters),
    queryFn: async () => {
      const result = await getItems(filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}
```

### Mutation Hook

```typescript
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateItemInput) => createItem(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });
        toast.success("Item created");
      } else {
        toast.error(result.error);
      }
    },
  });
}
```

## Zod Schema Patterns

### Complete Schema Set

```typescript
import { z } from "zod";

export const itemCategorySchema = z.enum(["category1", "category2", "category3"]);

export const createItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: itemCategorySchema,
  price: z.number().min(0, "Price must be positive"),
  description: z.string().max(500).optional().nullable(),
});

export const updateItemSchema = createItemSchema.partial();

export const itemFiltersSchema = z.object({
  category: itemCategorySchema.optional(),
  search: z.string().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export type ItemCategory = z.infer<typeof itemCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemFilters = z.infer<typeof itemFiltersSchema>;
```

## Database Query Patterns

### Pagination

```typescript
const limit = 20;
const offset = page * limit;

query = query.range(offset, offset + limit - 1);
```

### Search Multiple Fields

```typescript
if (search) {
  query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`);
}
```

### Date Range Filter

```typescript
if (filters.start_date) {
  query = query.gte("created_at", filters.start_date);
}

if (filters.end_date) {
  query = query.lte("created_at", filters.end_date);
}
```

### Array Contains

```typescript
if (filters.tags && filters.tags.length > 0) {
  query = query.contains("tags", filters.tags);
}
```

### Soft Delete Pattern

```typescript
// In queries
.is("deleted_at", null)

// For deletion
.update({ deleted_at: new Date().toISOString() })
```

## UI Component Patterns

### Data Table with Actions

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";

export function ItemsTable({ items }: { items: Item[] }) {
  const deleteItem = useDeleteItem();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.category}</TableCell>
            <TableCell>${item.price}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete item?")) {
                      deleteItem.mutate(item.id);
                    }
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Status Badge

```tsx
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const variants = {
    active: "default",
    pending: "secondary",
    completed: "default",
    cancelled: "destructive",
  } as const;

  return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}
```

### Confirmation Dialog

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Toast Notifications

```typescript
import { toast } from "react-toastify";

// Success
toast.success("Operation completed successfully");

// Error
toast.error("Something went wrong");

// Info
toast.info("Information message");

// Warning
toast.warning("Warning message");
```

## Next Steps

- [Architecture Overview](./01-architecture-overview.md) - Understand the SSR-first architecture
- [Creating New Module](./03-creating-new-module.md) - Build a complete feature from scratch
- [Adding Endpoints](./10-adding-endpoints.md) - Quick CRUD reference
