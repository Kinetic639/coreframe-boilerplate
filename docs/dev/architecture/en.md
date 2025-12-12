---
title: "System Architecture"
slug: "architecture"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["architecture", "development", "technical"]
category: "developer"
difficulty: "intermediate"
audience: ["developers", "architects"]
status: "published"
author: "Development Team"
estimatedReadTime: 15
---

# System Architecture

AmbraWMS is built on a modern, scalable architecture using Next.js 15, Supabase, and TypeScript.

## Tech Stack

### Frontend

- **Next.js 15** - App Router with Server Components
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library

### Backend

- **Supabase** - PostgreSQL database
- **Row Level Security (RLS)** - Data access control
- **Database Functions** - Business logic enforcement
- **Server Actions** - Next.js server-side operations

### Infrastructure

- **Vercel** - Hosting and deployment
- **GitHub** - Version control
- **npm** - Package management

## Module System

AmbraWMS uses a modular architecture where features are organized as independent modules:

```typescript
// Module structure
src/modules/
  └── warehouse/
       ├── config.ts          // Module configuration
       ├── components/        // UI components
       ├── actions/           // Server actions
       └── utils/             // Utility functions
```

### Module Configuration

Each module defines:

- **Routes** - Navigation paths
- **Permissions** - Access control
- **Widgets** - Dashboard components
- **Metadata** - Module information

Example:

```typescript
export const warehouseModuleConfig: ModuleConfig = {
  id: "warehouse",
  name: "Warehouse",
  icon: Package,
  color: "#10b981",
  routes: [
    {
      path: "/warehouse/products",
      name: "Products",
      allowedUsers: ["all"],
    },
  ],
  permissions: [
    {
      code: "warehouse.view",
      name: "View Warehouse",
      scope: "branch",
    },
  ],
};
```

## Multi-Tenancy

### Organization Structure

```
Organization (Tenant)
  └── Branch (Warehouse)
       └── Users with Roles
```

### Context Management

User context is managed via Zustand store:

```typescript
interface AppContext {
  activeOrg: Organization | null;
  activeBranch: Branch | null;
  availableBranches: Branch[];
}
```

### Data Isolation

RLS policies enforce data isolation:

```sql
CREATE POLICY "Users can only access their org data"
ON products
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = auth.uid()
  )
);
```

## Database Architecture

### Core Tables

#### Products

- `products` - Base product data
- `product_variants` - Size/color variants
- `product_inventory_data` - Per-warehouse stock
- `product_ecommerce_data` - Pricing and descriptions

#### Locations

- `locations` - Warehouse storage locations (3-level tree)

#### Stock Movements

- `stock_movements` - All inventory transactions
- `stock_movement_items` - Line items per movement

#### Views

- `current_stock_view` - Real-time inventory levels
- `available_stock_view` - Available to promise

### Warehouse Architecture Validation

Database triggers enforce architectural rules:

```sql
-- Ensure products don't cross warehouse boundaries
CREATE OR REPLACE FUNCTION validate_warehouse_architecture()
RETURNS TRIGGER AS $$
BEGIN
  -- Validation logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Authentication & Authorization

### Authentication

Handled by Supabase Auth:

- Email/password
- Magic links
- OAuth providers

### Authorization

Role-based access control (RBAC):

```typescript
interface Role {
  code: string;
  name: string;
  permissions: string[];
  scope: "organization" | "branch";
}
```

### Permission Validation

Server-side:

```typescript
export async function checkPermission(
  permission: string,
  scope: "organization" | "branch"
): Promise<boolean> {
  // Permission check logic
}
```

Client-side:

```tsx
<HasAnyRoleClient allowedRoles={["warehouse_manager"]}>
  <SensitiveComponent />
</HasAnyRoleClient>
```

## State Management

### Server State

- Server Components for initial data
- Server Actions for mutations
- Optimistic updates where needed

### Client State

- Zustand for global state
- React hooks for component state
- URL state for filters/pagination

## API Design

### Server Actions

```typescript
"use server";

export async function createProduct(data: CreateProductInput): Promise<ActionResult<Product>> {
  // Validate user
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Check permissions
  const hasPermission = await checkPermission("warehouse.products.create", "branch");
  if (!hasPermission) {
    return { success: false, error: "Forbidden" };
  }

  // Execute action
  const product = await createProductInDatabase(data);

  return { success: true, data: product };
}
```

## File Structure

```
coreframe-boilerplate/
├── src/
│   ├── app/                    # Next.js app directory
│   │   └── [locale]/          # i18n routing
│   │       └── dashboard/     # Protected routes
│   ├── components/            # Shared components
│   │   └── ui/                # shadcn/ui components
│   ├── modules/               # Feature modules
│   │   ├── warehouse/
│   │   ├── teams/
│   │   └── documentation/
│   ├── lib/                   # Utilities
│   │   ├── stores/            # Zustand stores
│   │   └── api/               # API utilities
│   └── utils/                 # Helper functions
├── supabase/
│   ├── migrations/            # Database migrations
│   └── types/                 # Generated types
├── messages/                  # i18n translations
│   ├── en.json
│   └── pl.json
└── docs/                      # Documentation
```

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### Database Migrations

```bash
# Create migration
npm run supabase:migration:new

# Apply migrations
npm run supabase:migration:up

# Generate types
npm run supabase:gen:types
```

## Performance Optimization

### Server Components

- Default to Server Components
- Use Client Components only when needed
- Streaming with Suspense

### Database

- Indexed columns for frequent queries
- Materialized views for complex calculations
- Database-level aggregations

### Caching

- Next.js cache for static data
- Revalidation strategies
- Optimistic UI updates

## Security Considerations

### Database Security

- RLS policies on all tables
- Function-based authorization
- Input validation in DB functions

### API Security

- Server Actions with auth checks
- Permission validation
- Rate limiting (planned)

### Data Protection

- Encrypted at rest (Supabase)
- HTTPS only
- Secure session management

## Next Steps

- [Contributing Guide](/docs/dev/contributing)
- [API Reference](/docs/api)
- [Testing Guide](/docs/dev/testing)

---

_Last updated: November 26, 2025_
