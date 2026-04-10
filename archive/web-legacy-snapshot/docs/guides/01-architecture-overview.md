# Architecture Overview

## SSR-First Architecture

This application follows a **Server-Side Rendering (SSR) first** approach using Next.js 15 App Router. The core principle is: **Server Components by default, Client Components only when needed**.

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│  1. Page (Server Component)                             │
│     - Loads app context (org/branch) server-side        │
│     - Optional: Pre-fetch critical data for SSR         │
│     - Renders client components with initial data       │
│     File: src/app/[locale]/dashboard/*/page.tsx         │
└────────────────┬────────────────────────────────────────┘
                 │ renders
┌────────────────▼────────────────────────────────────────┐
│  2. Client Component                                    │
│     - Uses React Query hooks for data fetching         │
│     - Displays UI with loading/error states            │
│     - Handles user interactions                         │
│     File: src/modules/*/components/*.tsx                │
└────────────────┬────────────────────────────────────────┘
                 │ calls
┌────────────────▼────────────────────────────────────────┐
│  3. React Query Hook                                    │
│     - Manages cache and automatic refetching           │
│     - Calls server actions                              │
│     - Handles loading/error/success states             │
│     File: src/lib/hooks/queries/*-queries.ts            │
└────────────────┬────────────────────────────────────────┘
                 │ invokes
┌────────────────▼────────────────────────────────────────┐
│  4. Server Action (use server)                          │
│     - Validates input with Zod schemas                  │
│     - Checks authentication and permissions             │
│     - Calls service layer for business logic           │
│     - Returns typed response                            │
│     File: src/app/[locale]/dashboard/*/_actions.ts      │
└────────────────┬────────────────────────────────────────┘
                 │ delegates to
┌────────────────▼────────────────────────────────────────┐
│  5. Service Layer                                       │
│     - Contains ALL business logic                       │
│     - Executes database queries via Supabase           │
│     - Transforms and validates data                     │
│     - Enforces business rules                           │
│     File: src/server/services/*.service.ts              │
└────────────────┬────────────────────────────────────────┘
                 │ queries
┌────────────────▼────────────────────────────────────────┐
│  6. Database (Supabase/PostgreSQL)                      │
│     - RLS policies enforce row-level security          │
│     - Multi-tenant data isolation                       │
│     - Generated TypeScript types                        │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. **Server Components by Default**

Every page starts as a Server Component unless it needs client-side interactivity:

```tsx
// ✅ GOOD - Server Component (default)
export default async function ProductsPage() {
  const appContext = await loadAppContextServer();

  return (
    <div>
      <h1>Products</h1>
      <ProductsClient appContext={appContext} />
    </div>
  );
}
```

```tsx
// ❌ BAD - Unnecessary "use client" at page level
"use client";
export default function ProductsPage() {
  // Don't do this unless absolutely necessary
}
```

### 2. **Single Source of Truth: Service Layer**

All business logic lives in the service layer. No logic in components, actions, or pages:

```typescript
// ✅ GOOD - Business logic in service
// src/server/services/products.service.ts
export class ProductsService {
  static async createProduct(data: CreateProductInput) {
    // Validate business rules
    if (data.price < 0) {
      throw new Error("Price cannot be negative");
    }

    // Execute database operation
    const { data: product, error } = await supabase.from("products").insert(data).select().single();

    return product;
  }
}
```

```typescript
// ❌ BAD - Business logic in server action
export async function createProduct(data: CreateProductInput) {
  // Don't put business logic here
  if (data.price < 0) {
    throw new Error("Price cannot be negative");
  }

  const { data: product } = await supabase.from("products").insert(data);
  return product;
}
```

### 3. **No Direct Client-Side Database Access**

Clients NEVER touch the database directly. All data flows through Server Actions:

```tsx
// ✅ GOOD - Client uses React Query hook → Server Action → Service
"use client";
export function ProductsList() {
  const { data: products, isLoading } = useProducts();
  // ...
}
```

```tsx
// ❌ BAD - Client directly accessing database
"use client";
import { createClient } from "@/utils/supabase/client";

export function ProductsList() {
  const supabase = createClient();
  const { data } = await supabase.from("products").select(); // ❌ NEVER DO THIS
}
```

**Exception**: Client-side Supabase is ONLY allowed for:

- Authentication flows
- File uploads to Supabase Storage
- Realtime subscriptions

### 4. **Co-located Server Actions**

Server Actions live with their routes, not in a global actions folder:

```
✅ GOOD Structure:
src/app/[locale]/dashboard/
  warehouse/
    products/
      page.tsx              (Server Component)
      _actions.ts           (Server Actions - co-located)
      products-client.tsx   (Client Component)

❌ BAD Structure:
src/app/actions/
  warehouse/
    products.ts            (Don't centralize actions)
```

### 5. **Flat Service Directory**

Services are organized in a flat structure, not nested:

```
✅ GOOD:
src/server/services/
  products.service.ts
  stock-movements.service.ts
  reservations.service.ts
  locations.service.ts

❌ BAD:
src/server/services/
  warehouse/
    products/
      products.service.ts
```

### 6. **Type Safety End-to-End**

TypeScript types flow from database → service → action → hook → component:

```typescript
// 1. Database types (generated)
import { Database } from "@/types/supabase";
type Product = Database["public"]["Tables"]["products"]["Row"];

// 2. Service uses DB types
export class ProductsService {
  static async getProduct(id: string): Promise<Product> {
    // ...
  }
}

// 3. Action validates with Zod and returns typed data
export async function getProduct(id: string): Promise<ActionResponse<Product>> {
  const product = await ProductsService.getProduct(id);
  return { success: true, data: product };
}

// 4. Hook is typed
export function useProduct(id: string) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: () => getProduct(id),
  });
}

// 5. Component receives typed data
export function ProductDetail({ id }: { id: string }) {
  const { data } = useProduct(id); // data is typed as ActionResponse<Product>
}
```

### 7. **Security in Layers**

Security is enforced at multiple levels:

1. **Database RLS Policies**: Row-level security on all tables
2. **Service Layer**: Organization/branch scoping in queries
3. **Server Actions**: Authentication and permission checks
4. **Client Components**: Role-based rendering

```typescript
// Layer 1: Database RLS (in migration)
CREATE POLICY "Users can only see their org's products"
  ON products FOR SELECT
  USING (organization_id = auth.jwt() -> 'app_metadata' -> 'active_org_id');

// Layer 2: Service enforces org scoping
static async getProducts(orgId: string) {
  return await supabase
    .from("products")
    .select()
    .eq("organization_id", orgId); // Explicit filter
}

// Layer 3: Server action validates auth
export async function getProducts() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const { activeOrgId } = await loadAppContextServer();
  return ProductsService.getProducts(activeOrgId);
}

// Layer 4: Client checks roles
<HasAnyRoleClient checks={[{ role: "branch_admin", scope: "branch", id: branchId }]}>
  <CreateProductButton />
</HasAnyRoleClient>
```

## Component Patterns

### Server Component Pattern

```tsx
// src/app/[locale]/dashboard/products/page.tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  // Load context server-side
  const appContext = await loadAppContextServer();

  // Optional: Pre-fetch critical data
  // const products = await ProductsService.getProducts(appContext.activeOrgId);

  return (
    <div>
      <h1>Products</h1>
      <ProductsClient appContext={appContext} />
    </div>
  );
}
```

### Client Component Pattern

```tsx
// src/app/[locale]/dashboard/products/products-client.tsx
"use client";

import { useProducts } from "@/lib/hooks/queries/products-queries";

export function ProductsClient({ appContext }: { appContext: AppContext }) {
  const { data, isLoading, error } = useProducts();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div>
      {data?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### React Query Hook Pattern

```typescript
// src/lib/hooks/queries/products-queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, createProduct } from "@/app/[locale]/dashboard/products/_actions";

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
      toast.success("Product created successfully");
    },
  });
}
```

### Server Action Pattern

```typescript
// src/app/[locale]/dashboard/products/_actions.ts
"use server";

import { z } from "zod";
import { ProductsService } from "@/server/services/products.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

export async function createProduct(input: z.infer<typeof CreateProductSchema>) {
  try {
    // Validate input
    const validated = CreateProductSchema.parse(input);

    // Check auth
    const { activeOrgId } = await loadAppContextServer();
    if (!activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // Call service
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

### Service Pattern

```typescript
// src/server/services/products.service.ts
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type Product = Database["public"]["Tables"]["products"]["Row"];
type CreateProductInput = Database["public"]["Tables"]["products"]["Insert"];

export class ProductsService {
  /**
   * Get all products for an organization
   */
  static async getProducts(organizationId: string): Promise<Product[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new product
   */
  static async createProduct(input: CreateProductInput): Promise<Product> {
    const supabase = await createClient();

    const { data, error } = await supabase.from("products").insert(input).select().single();

    if (error) throw error;
    return data;
  }
}
```

## State Management Strategy

### Server State (Data from Database)

Managed by **React Query (@tanstack/react-query)**:

- Automatic caching
- Background refetching
- Optimistic updates
- Cache invalidation

```typescript
// React Query manages server state
const { data: products } = useProducts(); // Cached, auto-refetched
```

### Client State (UI State)

Managed by **Zustand** for global state:

- App context (activeOrg, activeBranch)
- Sidebar state
- User preferences

```typescript
// Zustand manages client state
const { activeOrgId, setActiveOrg } = useAppStore();
```

### URL State (Navigation State)

Managed by **Next.js Router**:

- Search params for filters
- Route params for IDs

```typescript
// URL manages navigation state
const searchParams = useSearchParams();
const filter = searchParams.get("filter");
```

## Multi-Tenant Architecture

Every request operates within an organization and branch context:

```typescript
// Context loaded server-side
const appContext = await loadAppContextServer();
// Returns: { activeOrgId, activeBranchId, availableBranches, user }

// All services scoped to organization
await ProductsService.getProducts(appContext.activeOrgId);

// Database queries include org filter
.eq("organization_id", appContext.activeOrgId)
```

## Next Steps

- [File Structure Guide](./02-file-structure.md) - Where to put each type of file
- [Creating New Module](./03-creating-new-module.md) - Build a feature from scratch
- [Common Patterns](./16-common-patterns.md) - Frequently used code snippets
