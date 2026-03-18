# File Structure Guide

## Overview

This guide explains where to put each type of file and why. Following this structure ensures consistency and maintainability across the codebase.

## Directory Structure

```
src/
├── app/                                    # Next.js 15 App Router
│   ├── [locale]/                           # Internationalized routes
│   │   ├── dashboard/                      # Protected dashboard routes
│   │   │   ├── warehouse/                  # Warehouse module routes
│   │   │   │   ├── products/               # Products feature
│   │   │   │   │   ├── page.tsx            # ✅ Server Component page
│   │   │   │   │   ├── _actions.ts         # ✅ Co-located Server Actions
│   │   │   │   │   ├── products-client.tsx # ✅ Client Component
│   │   │   │   │   └── [id]/               # Dynamic route
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       └── _actions.ts
│   │   │   │   └── inventory/
│   │   │   │       ├── page.tsx
│   │   │   │       └── _actions.ts
│   │   │   └── teams/
│   │   │       └── contacts/
│   │   │           ├── page.tsx
│   │   │           └── _actions.ts
│   │   └── (auth)/                         # Auth route group
│   │       ├── login/
│   │       └── signup/
│   ├── api/                                # API routes (if needed)
│   └── providers.tsx                       # React Query + other providers
│
├── server/                                 # Server-side code
│   └── services/                           # ✅ Business logic layer (FLAT)
│       ├── products.service.ts
│       ├── stock-movements.service.ts
│       ├── locations.service.ts
│       ├── reservations.service.ts
│       └── contacts.service.ts
│
├── lib/                                    # Shared utilities
│   ├── hooks/                              # React hooks
│   │   ├── queries/                        # ✅ React Query hooks
│   │   │   ├── products-queries.ts
│   │   │   ├── contacts-queries.ts
│   │   │   └── locations-queries.ts
│   │   └── use-debounce.ts                 # Custom hooks
│   ├── stores/                             # Zustand stores
│   │   ├── app-store.ts                    # App context state
│   │   ├── sidebar-store.ts                # Sidebar state
│   │   └── contacts-store.ts               # Feature-specific state
│   ├── api/                                # API utilities
│   │   └── load-app-context-server.ts      # Server context loader
│   ├── schemas/                            # ✅ Zod validation schemas
│   │   ├── products.schemas.ts
│   │   ├── contacts.schemas.ts
│   │   └── common.schemas.ts
│   └── utils/                              # Utility functions
│
├── modules/                                # Feature modules
│   ├── warehouse/                          # Warehouse module
│   │   ├── config.ts                       # Module configuration
│   │   ├── components/                     # Shared components
│   │   │   ├── product-card.tsx
│   │   │   ├── stock-level-display.tsx
│   │   │   └── movement-history-list.tsx
│   │   └── products/                       # Feature-specific components
│   │       └── components/
│   │           ├── create-product-dialog.tsx
│   │           └── products-advanced-table.tsx
│   ├── teams/
│   │   ├── config.ts
│   │   └── components/
│   └── index.ts                            # Module registry
│
├── components/                             # Shared UI components
│   ├── ui/                                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── auth/                               # Auth components
│   │   ├── HasAnyRoleClient.tsx
│   │   └── HasAnyRoleServer.tsx
│   ├── contacts/                           # Domain components
│   │   ├── ContactCard.tsx
│   │   └── SendMessageButton.tsx
│   └── layout/                             # Layout components
│       ├── DashboardLayout.tsx
│       └── Sidebar.tsx
│
├── utils/                                  # Low-level utilities
│   ├── supabase/                           # Supabase clients
│   │   ├── client.ts                       # Client-side instance
│   │   ├── server.ts                       # Server-side instance
│   │   └── middleware.ts                   # Middleware instance
│   └── auth/                               # Auth utilities
│       └── roles.ts                        # Role validation
│
└── types/                                  # TypeScript types
    ├── supabase.ts                         # Generated DB types
    └── app.ts                              # App-specific types

supabase/
├── migrations/                             # Database migrations
│   ├── 20240101000000_initial_schema.sql
│   └── 20240102000000_add_products.sql
└── types/                                  # Generated types
    └── types.ts
```

## File Placement Rules

### 1. Pages (Server Components)

**Location**: `src/app/[locale]/dashboard/[module]/[feature]/page.tsx`

**Purpose**: Entry point for routes, always Server Components by default

**Example**:

```tsx
// src/app/[locale]/dashboard/warehouse/products/page.tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      <h1>Products</h1>
      <ProductsClient />
    </div>
  );
}
```

**Key Points**:

- Must be `async` functions (Server Components)
- Load context server-side with `loadAppContextServer()`
- Delegate UI to client components
- Handle metadata and SEO

### 2. Server Actions

**Location**: `src/app/[locale]/dashboard/[module]/[feature]/_actions.ts`

**Purpose**: API layer between client and service layer

**Naming**: Always `_actions.ts` (underscore prefix prevents it from being a route)

**Example**:

```typescript
// src/app/[locale]/dashboard/warehouse/products/_actions.ts
"use server";

import { z } from "zod";
import { ProductsService } from "@/server/services/products.service";
import { CreateProductSchema } from "@/lib/schemas/products.schemas";

export async function createProduct(input: z.infer<typeof CreateProductSchema>) {
  try {
    const validated = CreateProductSchema.parse(input);
    const { activeOrgId } = await loadAppContextServer();

    const product = await ProductsService.createProduct({
      ...validated,
      organization_id: activeOrgId,
    });

    return { success: true, data: product };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Key Points**:

- Co-located with pages (NOT in global actions folder)
- Must have `"use server"` directive
- Validate input with Zod
- Check authentication
- Call service layer
- Return typed response `{ success, data?, error? }`

### 3. Services

**Location**: `src/server/services/[feature].service.ts`

**Purpose**: Business logic and database operations

**Structure**: FLAT directory (no nesting)

**Example**:

```typescript
// src/server/services/products.service.ts
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type Product = Database["public"]["Tables"]["products"]["Row"];

export class ProductsService {
  static async getProducts(organizationId: string): Promise<Product[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId);

    if (error) throw error;
    return data || [];
  }
}
```

**Key Points**:

- Static class methods (no instantiation needed)
- All business logic lives here
- Direct database access
- Organization scoping
- Comprehensive JSDoc comments

### 4. React Query Hooks

**Location**: `src/lib/hooks/queries/[feature]-queries.ts`

**Purpose**: Client-side data fetching with caching

**Example**:

```typescript
// src/lib/hooks/queries/products-queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, createProduct } from "@/app/[locale]/dashboard/warehouse/products/_actions";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const result = await getProducts();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
```

**Key Points**:

- Group related queries in same file
- Use consistent query keys
- Handle cache invalidation
- Include error handling

### 5. Zod Schemas

**Location**: `src/lib/schemas/[feature].schemas.ts`

**Purpose**: Input validation and type inference

**Example**:

```typescript
// src/lib/schemas/products.schemas.ts
import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().min(0, "Price must be positive"),
  category_id: z.string().uuid(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
```

**Key Points**:

- Define schema and export type
- Use `.partial()` for update schemas
- Include validation messages
- Group related schemas

### 6. Client Components

**Location**: Two options based on usage:

**Option A**: Co-located with page (feature-specific)

```
src/app/[locale]/dashboard/warehouse/products/
  ├── page.tsx
  ├── _actions.ts
  └── products-client.tsx  ← Feature-specific client component
```

**Option B**: In module components (reusable across module)

```
src/modules/warehouse/
  ├── components/
  │   ├── product-card.tsx          ← Shared across warehouse module
  │   └── stock-level-display.tsx
  └── products/
      └── components/
          └── create-product-dialog.tsx  ← Product-specific component
```

**Example**:

```tsx
// src/app/[locale]/dashboard/warehouse/products/products-client.tsx
"use client";

import { useProducts } from "@/lib/hooks/queries/products-queries";
import { ProductCard } from "@/modules/warehouse/components/product-card";

export function ProductsClient() {
  const { data: products, isLoading } = useProducts();

  if (isLoading) return <Skeleton />;

  return (
    <div className="grid grid-cols-3 gap-4">
      {products?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

**Key Points**:

- Must have `"use client"` directive
- Use React Query hooks for data
- Handle loading/error states
- Import from shadcn/ui for UI components

### 7. Shared UI Components

**Location**: `src/components/[category]/[component].tsx`

**Purpose**: Reusable UI components across the app

**Categories**:

- `ui/` - shadcn/ui components (button, dialog, input, etc.)
- `auth/` - Authentication components
- `layout/` - Layout components
- `[domain]/` - Domain-specific shared components (contacts, news, etc.)

**Example**:

```tsx
// src/components/contacts/ContactCard.tsx
"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function ContactCard({ contact }) {
  return (
    <Card>
      <CardHeader>
        <Avatar>
          <AvatarImage src={contact.avatar_url} />
          <AvatarFallback>{contact.initials}</AvatarFallback>
        </Avatar>
      </CardHeader>
      <CardContent>
        <h3>{contact.name}</h3>
        <p>{contact.email}</p>
      </CardContent>
    </Card>
  );
}
```

### 8. Module Configuration

**Location**: `src/modules/[module]/config.ts`

**Purpose**: Define module metadata, routes, and widgets

**Example**:

```typescript
// src/modules/warehouse/config.ts
import { ModuleConfig } from "@/modules/types";

export const warehouseModule: ModuleConfig = {
  id: "warehouse",
  name: "Warehouse",
  icon: "Package",
  color: "#10b981",
  order: 2,
  menuItems: [
    {
      id: "products",
      label: "Products",
      href: "/dashboard/warehouse/products",
      icon: "Package",
      allowedUsers: [
        { role: "branch_admin", scope: "branch" },
        { role: "warehouse_manager", scope: "branch" },
      ],
    },
  ],
};
```

### 9. Database Migrations

**Location**: `supabase/migrations/[timestamp]_[description].sql`

**Naming**: `YYYYMMDDHHMMSS_description.sql`

**Example**:

```sql
-- supabase/migrations/20240101000000_create_products.sql

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org products"
  ON public.products FOR SELECT
  USING (organization_id = (auth.jwt() -> 'app_metadata' -> 'active_org_id')::uuid);
```

**Key Points**:

- Use timestamp prefix for ordering
- Include RLS policies
- Add indexes for performance
- Use `IF NOT EXISTS` for idempotency

### 10. TypeScript Types

**Location**: Multiple places based on purpose:

**Database Types** (generated):

```
supabase/types/types.ts  ← Generated, don't edit manually
```

**App Types**:

```typescript
// src/types/app.ts
export interface AppContext {
  activeOrgId: string;
  activeBranchId: string | null;
  availableBranches: Branch[];
  user: User;
}
```

**Feature Types** (in schemas):

```typescript
// src/lib/schemas/products.schemas.ts
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
```

## Common Anti-Patterns to Avoid

### ❌ DON'T: Centralized Actions Folder

```
src/app/actions/
  warehouse/
    products.ts  ← Don't do this
```

### ✅ DO: Co-located Actions

```
src/app/[locale]/dashboard/warehouse/products/
  _actions.ts  ← Do this
```

---

### ❌ DON'T: Nested Services

```
src/server/services/
  warehouse/
    products/
      products.service.ts  ← Too nested
```

### ✅ DO: Flat Services

```
src/server/services/
  products.service.ts  ← Flat structure
```

---

### ❌ DON'T: Business Logic in Actions

```typescript
// _actions.ts
export async function createProduct(data) {
  // Don't put business logic here
  if (data.price < 0) throw new Error("Invalid price");

  const { data: product } = await supabase.from("products").insert(data);
  return product;
}
```

### ✅ DO: Business Logic in Services

```typescript
// products.service.ts
static async createProduct(data) {
  // Business logic belongs here
  if (data.price < 0) throw new Error("Invalid price");

  const { data: product } = await supabase.from("products").insert(data);
  return product;
}
```

---

### ❌ DON'T: Direct DB Access from Client

```tsx
"use client";
const supabase = createClient();
const { data } = await supabase.from("products").select();  ← Never do this
```

### ✅ DO: Use React Query Hooks

```tsx
"use client";
const { data } = useProducts();  ← Always use hooks
```

## Quick Reference

| File Type                        | Location                                                      | Example                                                         |
| -------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Page                             | `app/[locale]/dashboard/[module]/[feature]/page.tsx`          | `app/[locale]/dashboard/warehouse/products/page.tsx`            |
| Server Actions                   | `app/[locale]/dashboard/[module]/[feature]/_actions.ts`       | `app/[locale]/dashboard/warehouse/products/_actions.ts`         |
| Service                          | `server/services/[feature].service.ts`                        | `server/services/products.service.ts`                           |
| React Query Hook                 | `lib/hooks/queries/[feature]-queries.ts`                      | `lib/hooks/queries/products-queries.ts`                         |
| Zod Schema                       | `lib/schemas/[feature].schemas.ts`                            | `lib/schemas/products.schemas.ts`                               |
| Client Component (page-specific) | `app/[locale]/dashboard/[module]/[feature]/[name]-client.tsx` | `app/[locale]/dashboard/warehouse/products/products-client.tsx` |
| Client Component (reusable)      | `modules/[module]/components/[name].tsx`                      | `modules/warehouse/components/product-card.tsx`                 |
| Shared UI Component              | `components/[category]/[name].tsx`                            | `components/contacts/ContactCard.tsx`                           |
| Module Config                    | `modules/[module]/config.ts`                                  | `modules/warehouse/config.ts`                                   |
| Migration                        | `supabase/migrations/[timestamp]_[description].sql`           | `supabase/migrations/20240101000000_create_products.sql`        |

## Next Steps

- [Creating a New Module](./03-creating-new-module.md)
- [Adding Server-Side Service](./04-creating-service.md)
- [Creating Server Actions](./05-creating-server-actions.md)
