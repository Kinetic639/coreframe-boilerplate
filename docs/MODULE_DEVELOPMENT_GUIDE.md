# Coreframe Module Development Guide

> **CRITICAL**: This guide contains everything needed to build enterprise-grade modules for the Coreframe SaaS boilerplate. Follow every step exactly. This guide has been verified against the actual codebase as of February 2026.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Architecture Overview](#architecture-overview)
3. [6-Layer Implementation](#6-layer-implementation)
4. [Security Requirements](#security-requirements)
5. [Module Configuration](#module-configuration)
6. [Performance Optimization](#performance-optimization)
7. [Internationalization](#internationalization)
8. [Commands Reference](#commands-reference)
9. [Testing Requirements](#testing-requirements)
10. [Checklist](#checklist)
11. [Hardening Standards (Recommended)](#hardening-standards-recommended)
12. [Quick Start Template](#quick-start-template)

---

## Core Principles

### Non-Negotiable Rules

1. **SSR-First** - Server Components by default, Client Components only for interactivity
2. **Mobile-First** - Design from mobile up, responsive by default
3. **Security-First** - RLS, policies, and permissions MUST be implemented BEFORE features
4. **Type-Safety** - 100% TypeScript with strict mode, no `any` types
5. **Performance** - Use React Query for caching, optimize bundle size, lazy load

### Critical Constraints

- **NEVER** use `sonner` for toasts - ALWAYS use `react-toastify`. Any remaining `sonner` imports in the codebase or `package.json` are legacy and must be migrated to `react-toastify` before merging.
- **Supabase environment rules**:
  - **Remote Supabase** is the default for day-to-day development (project ID: `zlcnlalwfmmtusigeuyk`)
  - **Local Supabase** is optional and allowed — primarily for running integration tests and applying/testing migrations at home
  - At work (Firebase Studio / browser-only), local Supabase is not available — use remote
  - See [Testing Requirements > Running Integration Tests](#running-integration-tests) for both paths
- **ALWAYS** use shadcn/ui components before creating custom ones
- **NEVER** modify existing RLS policies destructively - add new ones incrementally
- **ALWAYS** kill dev server after testing (`pnpm dev` must be terminated)
- **ALWAYS** use `getUser()` for authentication, not `getSession()` (validates JWT server-side)

---

## Architecture Overview

### Data Flow Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                         SSR-First Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Page (Server Component)                                        │
│       │                                                         │
│       ▼                                                         │
│  loadAppContextServer() ─────────────────────┐                  │
│       │                                      │                  │
│       ▼                                      ▼                  │
│  Client Component ◄───────────────── Context Provider           │
│       │                                                         │
│       ▼                                                         │
│  React Query Hook (useQuery/useMutation)                        │
│       │                                                         │
│       ▼                                                         │
│  Server Action (src/app/actions/)                               │
│       │                                                         │
│       ▼                                                         │
│  Service Layer (src/server/services/)                           │
│       │                                                         │
│       ▼                                                         │
│  Supabase + RLS Policies                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Active Organization Trust Boundary

> **CLARIFICATION**: `user_preferences.organization_id` is a convenience field for UI state, NOT a security boundary. RLS policies using `is_org_member()` and `has_permission()` are the authoritative security boundary. Server actions SHOULD validate permissions explicitly for Class B/C data as defense-in-depth, but RLS remains the hard enforcement layer.

### File Structure (VERIFIED)

```
src/
├── app/
│   ├── actions/                        # Server actions organized by feature
│   │   ├── [module]/                   # Module-specific actions
│   │   │   ├── index.ts                # Barrel re-exports (recommended for new modules)
│   │   │   └── [action-name].ts        # Individual action files
│   │   │   # NOTE: Some modules (e.g., warehouse) use individual files without
│   │   │   # a barrel index.ts. Both patterns are acceptable.
│   │   └── shared/                     # Shared actions
│   └── [locale]/
│       └── dashboard/
│           └── [module]/               # Module pages
│               ├── page.tsx            # Server Component (main page)
│               ├── loading.tsx         # Loading UI (Suspense fallback)
│               ├── error.tsx           # Error boundary
│               ├── _components/        # Module-specific components
│               │   └── [name]-client.tsx
│               └── [subpage]/
│                   └── page.tsx
├── server/
│   └── services/
│       └── [module].service.ts         # FLAT directory, no nesting
├── hooks/
│   └── queries/                        # React Query hooks
│       └── [module]/
│           └── index.ts                # Query hooks for module
├── lib/
│   ├── types/
│   │   └── [module].ts                 # TypeScript types
│   ├── validations/
│   │   └── [module].ts                 # Zod validation schemas
│   └── stores/
│       └── [module]-store.ts           # Zustand stores (if needed)
├── modules/
│   └── [module]/
│       └── config.ts                   # Module configuration
└── components/
    └── ui/                             # shadcn/ui components
```

---

## 6-Layer Implementation

### Layer 1: Database (Supabase)

**Location**: `supabase/migrations/`

Every table MUST have:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id)`
- `branch_id UUID REFERENCES branches(id)` (if branch-scoped)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `deleted_at TIMESTAMPTZ` (soft delete)
- `created_by UUID REFERENCES auth.users(id)`

**Naming Convention**: `YYYYMMDDHHMMSS_description.sql`

```sql
-- Example: 20260205120000_create_feature_table.sql

-- Create table
CREATE TABLE IF NOT EXISTS public.feature_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Feature fields
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_feature_items_org ON public.feature_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_items_branch ON public.feature_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_feature_items_deleted ON public.feature_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_feature_items_status ON public.feature_items(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feature_items_created_at ON public.feature_items(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_feature_items_updated_at
  BEFORE UPDATE ON public.feature_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.feature_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (VERIFIED helper functions)
-- NOTE: is_org_member() and has_permission() use auth.uid() internally

CREATE POLICY "feature_items_select_member"
  ON public.feature_items FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

CREATE POLICY "feature_items_insert_permission"
  ON public.feature_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(organization_id) AND
    has_permission(organization_id, 'feature.create')
  );

-- CANONICAL UPDATE POLICY: Handles both normal updates AND soft-deletes
-- Users with module.update can update non-deleted rows
-- Users with module.delete can soft-delete (set deleted_at) on any row
CREATE POLICY "feature_items_update_permission"
  ON public.feature_items FOR UPDATE
  TO authenticated
  USING (
    is_org_member(organization_id) AND
    (
      (deleted_at IS NULL AND has_permission(organization_id, 'feature.update'))
      OR
      has_permission(organization_id, 'feature.delete')
    )
  )
  WITH CHECK (
    is_org_member(organization_id) AND
    (
      (deleted_at IS NULL AND has_permission(organization_id, 'feature.update'))
      OR
      has_permission(organization_id, 'feature.delete')
    )
  );

-- DELETE policy: OPTIONAL - for rare hard-delete or admin cleanup scenarios only
-- Most operations should use soft-delete via UPDATE (setting deleted_at)
CREATE POLICY "feature_items_delete_permission"
  ON public.feature_items FOR DELETE
  TO authenticated
  USING (
    is_org_member(organization_id) AND
    has_permission(organization_id, 'feature.delete') AND
    deleted_at IS NULL
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_items TO authenticated;

-- Add permissions to permissions table
-- NOTE: The permissions table has additional columns (name, label, subcategory,
-- resource_type, scope_types, is_system, is_dangerous, requires_mfa, priority, metadata)
-- but only slug, action, category, and description are required for basic setup.
INSERT INTO public.permissions (slug, name, action, category, description)
VALUES
  ('feature.read', 'Read Features', 'read', 'feature', 'View feature items'),
  ('feature.create', 'Create Features', 'create', 'feature', 'Create feature items'),
  ('feature.update', 'Update Features', 'update', 'feature', 'Update feature items'),
  ('feature.delete', 'Delete Features', 'delete', 'feature', 'Delete feature items')
ON CONFLICT (slug) DO NOTHING;

-- Assign permissions to org_owner role (gets all permissions)
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_owner'
AND p.slug LIKE 'feature.%'
ON CONFLICT DO NOTHING;

-- Assign read permission to org_member
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_member'
AND p.slug = 'feature.read'
ON CONFLICT DO NOTHING;
```

### Layer 2: Service Layer

**Location**: `src/server/services/[module].service.ts`

**Rules**:

- Static class with static methods
- ALWAYS accepts `SupabaseClient` as first parameter
- Organization/branch scoping in EVERY query
- Proper error handling with typed errors
- NO direct database access outside services

```typescript
// src/server/services/feature.service.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/supabase/types/types";

type DbClient = SupabaseClient<Database>;
type FeatureRow = Database["public"]["Tables"]["feature_items"]["Row"];
type FeatureInsert = Database["public"]["Tables"]["feature_items"]["Insert"];
type FeatureUpdate = Database["public"]["Tables"]["feature_items"]["Update"];

export interface FeatureFilters {
  status?: "active" | "inactive" | "archived";
  branchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class FeatureService {
  /**
   * Get all features for an organization
   */
  static async getFeatures(
    supabase: DbClient,
    organizationId: string,
    filters?: FeatureFilters
  ): Promise<FeatureRow[]> {
    let query = supabase
      .from("feature_items")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }
    if (filters?.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[FeatureService.getFeatures]", error);
      throw new Error(`Failed to fetch features: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Get features count for pagination
   */
  static async getFeaturesCount(
    supabase: DbClient,
    organizationId: string,
    filters?: Omit<FeatureFilters, "limit" | "offset">
  ): Promise<number> {
    let query = supabase
      .from("feature_items")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }
    if (filters?.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    const { count, error } = await query;

    if (error) {
      console.error("[FeatureService.getFeaturesCount]", error);
      throw new Error(`Failed to count features: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Get a single feature by ID
   */
  static async getFeatureById(
    supabase: DbClient,
    featureId: string,
    organizationId: string
  ): Promise<FeatureRow | null> {
    const { data, error } = await supabase
      .from("feature_items")
      .select("*")
      .eq("id", featureId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("[FeatureService.getFeatureById]", error);
      throw new Error(`Failed to fetch feature: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new feature
   */
  static async createFeature(
    supabase: DbClient,
    input: Omit<FeatureInsert, "id" | "created_at" | "updated_at" | "deleted_at">,
    organizationId: string,
    userId: string,
    branchId?: string
  ): Promise<FeatureRow> {
    const { data, error } = await supabase
      .from("feature_items")
      .insert({
        ...input,
        organization_id: organizationId,
        branch_id: branchId ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[FeatureService.createFeature]", error);
      throw new Error(`Failed to create feature: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing feature
   */
  static async updateFeature(
    supabase: DbClient,
    featureId: string,
    input: FeatureUpdate,
    organizationId: string
  ): Promise<FeatureRow> {
    const { data, error } = await supabase
      .from("feature_items")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", featureId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[FeatureService.updateFeature]", error);
      throw new Error(`Failed to update feature: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete a feature (sets deleted_at timestamp)
   */
  static async deleteFeature(
    supabase: DbClient,
    featureId: string,
    organizationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("feature_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", featureId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (error) {
      console.error("[FeatureService.deleteFeature]", error);
      throw new Error(`Failed to delete feature: ${error.message}`);
    }
  }
}
```

### Layer 3: Zod Validation Schemas

**Location**: `src/lib/validations/[module].ts`

```typescript
// src/lib/validations/feature.ts
import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const featureStatusSchema = z.enum(["active", "inactive", "archived"]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a feature
 */
export const createFeatureSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .trim()
    .optional()
    .nullable(),
  status: featureStatusSchema.default("active"),
});

/**
 * Schema for updating a feature
 */
export const updateFeatureSchema = createFeatureSchema.partial();

/**
 * Schema for filtering features
 */
export const featureFiltersSchema = z.object({
  status: featureStatusSchema.optional(),
  branchId: z.string().uuid("Invalid branch ID").optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type FeatureStatus = z.infer<typeof featureStatusSchema>;
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
export type FeatureFilters = z.infer<typeof featureFiltersSchema>;
```

### Layer 4: Server Actions

**Location**: `src/app/actions/[module]/index.ts`

**Rules**:

- ALWAYS starts with `"use server"`
- ALWAYS validate with Zod schemas
- ALWAYS use `getUser()` for authentication (validates JWT server-side)
- ALWAYS check permissions using PermissionServiceV2
- ALWAYS return `ActionResult<T>` type

```typescript
// src/app/actions/feature/index.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { FeatureService } from "@/server/services/feature.service";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import { ZodError } from "zod";
import {
  createFeatureSchema,
  updateFeatureSchema,
  featureFiltersSchema,
  type CreateFeatureInput,
  type UpdateFeatureInput,
  type FeatureFilters,
} from "@/lib/validations/feature";

/**
 * Standard action result type
 */
export type ActionResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

/**
 * Format Zod validation errors into a readable string
 */
function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
      return `${path}${e.message}`;
    })
    .join("; ");
}

/**
 * Authenticate user using getUser() which validates JWT against Supabase Auth
 *
 * IMPORTANT: getUser() is preferred over getSession() for server-side auth
 * because getSession() only reads cookies without validating the token.
 */
async function authenticateUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated" as const };
  }

  return { supabase, user };
}

/**
 * Get current user's active organization from preferences
 *
 * NOTE: This is a convenience field, NOT a security boundary.
 * RLS policies enforce the actual security boundary.
 */
async function getActiveOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  return preferences?.organization_id ?? null;
}

/**
 * Get all features for the current organization
 */
export async function getFeatures(
  filters?: FeatureFilters
): Promise<ActionResult<Awaited<ReturnType<typeof FeatureService.getFeatures>>>> {
  try {
    const auth = await authenticateUser();
    if ("error" in auth) {
      return { success: false, error: auth.error };
    }

    const organizationId = await getActiveOrganization(auth.supabase, auth.user.id);
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    // Validate filters if provided
    let validatedFilters: FeatureFilters | undefined;
    if (filters) {
      const result = featureFiltersSchema.safeParse(filters);
      if (!result.success) {
        return { success: false, error: formatZodError(result.error) };
      }
      validatedFilters = result.data;
    }

    const data = await FeatureService.getFeatures(auth.supabase, organizationId, validatedFilters);

    return { success: true, data };
  } catch (error) {
    console.error("[getFeatures]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch features",
    };
  }
}

/**
 * Get a single feature by ID
 */
export async function getFeatureById(
  featureId: string
): Promise<ActionResult<Awaited<ReturnType<typeof FeatureService.getFeatureById>>>> {
  try {
    const auth = await authenticateUser();
    if ("error" in auth) {
      return { success: false, error: auth.error };
    }

    const organizationId = await getActiveOrganization(auth.supabase, auth.user.id);
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    const data = await FeatureService.getFeatureById(auth.supabase, featureId, organizationId);

    if (!data) {
      return { success: false, error: "Feature not found" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[getFeatureById]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch feature",
    };
  }
}

/**
 * Create a new feature
 */
export async function createFeature(
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof FeatureService.createFeature>>>> {
  try {
    const auth = await authenticateUser();
    if ("error" in auth) {
      return { success: false, error: auth.error };
    }

    const organizationId = await getActiveOrganization(auth.supabase, auth.user.id);
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    // Validate input
    const validationResult = createFeatureSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: formatZodError(validationResult.error) };
    }

    // Check permission using V2 service
    const hasPermission = await PermissionServiceV2.hasPermission(
      auth.supabase,
      auth.user.id,
      organizationId,
      "feature.create"
    );

    if (!hasPermission) {
      return { success: false, error: "Permission denied: feature.create required" };
    }

    // Get active branch from preferences
    const { data: preferences } = await auth.supabase
      .from("user_preferences")
      .select("default_branch_id")
      .eq("user_id", auth.user.id)
      .single();

    const data = await FeatureService.createFeature(
      auth.supabase,
      validationResult.data,
      organizationId,
      auth.user.id,
      preferences?.default_branch_id ?? undefined
    );

    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[createFeature]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create feature",
    };
  }
}

/**
 * Update an existing feature
 */
export async function updateFeature(
  featureId: string,
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof FeatureService.updateFeature>>>> {
  try {
    const auth = await authenticateUser();
    if ("error" in auth) {
      return { success: false, error: auth.error };
    }

    const organizationId = await getActiveOrganization(auth.supabase, auth.user.id);
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    // Validate input
    const validationResult = updateFeatureSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: formatZodError(validationResult.error) };
    }

    // Check permission
    const hasPermission = await PermissionServiceV2.hasPermission(
      auth.supabase,
      auth.user.id,
      organizationId,
      "feature.update"
    );

    if (!hasPermission) {
      return { success: false, error: "Permission denied: feature.update required" };
    }

    const data = await FeatureService.updateFeature(
      auth.supabase,
      featureId,
      validationResult.data,
      organizationId
    );

    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateFeature]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update feature",
    };
  }
}

/**
 * Delete a feature (soft delete)
 */
export async function deleteFeature(
  featureId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const auth = await authenticateUser();
    if ("error" in auth) {
      return { success: false, error: auth.error };
    }

    const organizationId = await getActiveOrganization(auth.supabase, auth.user.id);
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    // Check permission
    const hasPermission = await PermissionServiceV2.hasPermission(
      auth.supabase,
      auth.user.id,
      organizationId,
      "feature.delete"
    );

    if (!hasPermission) {
      return { success: false, error: "Permission denied: feature.delete required" };
    }

    await FeatureService.deleteFeature(auth.supabase, featureId, organizationId);

    return { success: true, data: { success: true } };
  } catch (error) {
    console.error("[deleteFeature]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete feature",
    };
  }
}
```

### Layer 5: React Query Hooks

**Location**: `src/hooks/queries/[module]/index.ts`

```typescript
// src/hooks/queries/feature/index.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
} from "@/app/actions/feature";
import type {
  FeatureFilters,
  CreateFeatureInput,
  UpdateFeatureInput,
} from "@/lib/validations/feature";
import type { Database } from "@/supabase/types/types";

type FeatureRow = Database["public"]["Tables"]["feature_items"]["Row"];

// Query key factory for consistent cache management
export const featureKeys = {
  all: ["features"] as const,
  lists: () => [...featureKeys.all, "list"] as const,
  list: (filters?: FeatureFilters) => [...featureKeys.lists(), filters] as const,
  details: () => [...featureKeys.all, "detail"] as const,
  detail: (id: string) => [...featureKeys.details(), id] as const,
};

/**
 * Hook to fetch all features with optional filters
 */
export function useFeaturesQuery(filters?: FeatureFilters, enabled = true) {
  return useQuery({
    queryKey: featureKeys.list(filters),
    queryFn: async () => {
      const result = await getFeatures(filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single feature by ID
 */
export function useFeatureQuery(featureId: string, enabled = true) {
  return useQuery({
    queryKey: featureKeys.detail(featureId),
    queryFn: async () => {
      const result = await getFeatureById(featureId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: enabled && !!featureId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a feature with optimistic updates
 */
export function useCreateFeatureMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFeatureInput) => {
      const result = await createFeature(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all feature lists to refetch
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
      toast.success("Feature created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create feature");
    },
  });
}

/**
 * Hook to update a feature with optimistic updates
 *
 * IMPORTANT: All optimistic updates MUST be explicitly typed using generated
 * Database row types. Never use `any`. Include safe fallback when cache is undefined.
 */
export function useUpdateFeatureMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureId, input }: { featureId: string; input: UpdateFeatureInput }) => {
      const result = await updateFeature(featureId, input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onMutate: async ({ featureId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: featureKeys.detail(featureId) });

      // Snapshot previous value for rollback (explicitly typed)
      const previousFeature = queryClient.getQueryData<FeatureRow | null>(
        featureKeys.detail(featureId)
      );

      // Optimistically update the cache (explicitly typed, safe fallback)
      queryClient.setQueryData<FeatureRow | null>(featureKeys.detail(featureId), (old) =>
        old ? { ...old, ...input } : null
      );

      return { previousFeature };
    },
    onError: (error: Error, { featureId }, context) => {
      // Rollback on error
      if (context?.previousFeature !== undefined) {
        queryClient.setQueryData(featureKeys.detail(featureId), context.previousFeature);
      }
      toast.error(error.message || "Failed to update feature");
    },
    onSettled: (_data, error, { featureId }) => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
      queryClient.invalidateQueries({ queryKey: featureKeys.detail(featureId) });
      if (!error) {
        toast.success("Feature updated successfully");
      }
    },
  });
}

/**
 * Hook to delete a feature
 */
export function useDeleteFeatureMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (featureId: string) => {
      const result = await deleteFeature(featureId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
      toast.success("Feature deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete feature");
    },
  });
}
```

### Layer 6: Pages & Components

#### Server Component (Page)

**Location**: `src/app/[locale]/dashboard/[module]/page.tsx`

```tsx
// src/app/[locale]/dashboard/feature/page.tsx
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { FeaturePageClient } from "./_components/feature-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FeaturePage");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function FeaturePage() {
  const context = await loadAppContextServer();
  const t = await getTranslations("FeaturePage");

  if (!context?.activeOrgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("noOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Client Component handles data fetching and interactivity */}
      <FeaturePageClient />
    </div>
  );
}
```

#### Loading State

**Location**: `src/app/[locale]/dashboard/[module]/loading.tsx`

```tsx
// src/app/[locale]/dashboard/feature/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function FeatureLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

#### Error Boundary

**Location**: `src/app/[locale]/dashboard/[module]/error.tsx`

```tsx
// src/app/[locale]/dashboard/feature/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FeatureError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to error reporting service
    console.error("[FeatureError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          Try Again
        </Button>
        <Button onClick={() => window.history.back()} variant="outline">
          Go Back
        </Button>
      </div>
    </div>
  );
}
```

#### Client Component

**Location**: `src/app/[locale]/dashboard/[module]/_components/[name]-client.tsx`

```tsx
// src/app/[locale]/dashboard/feature/_components/feature-page-client.tsx
"use client";

import { useState } from "react";
import { useFeaturesQuery, useDeleteFeatureMutation } from "@/hooks/queries/feature";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit, Search } from "lucide-react";
import { FeatureForm } from "./feature-form";
import { useDebounce } from "@/hooks/use-debounce";

export function FeaturePageClient() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    data: features,
    isLoading,
    error,
    refetch,
  } = useFeaturesQuery({
    search: debouncedSearch || undefined,
  });
  const deleteFeature = useDeleteFeatureMutation();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" data-testid="skeleton" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Error loading features: {error.message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {can("feature.create") && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Feature
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Feature</DialogTitle>
                <DialogDescription>Add a new feature to your organization</DialogDescription>
              </DialogHeader>
              <FeatureForm onSuccess={() => setCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Empty state */}
      {!features || features.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground mb-4">No features found</p>
          {can("feature.create") && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first feature
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Feature</DialogTitle>
                  <DialogDescription>Add a new feature to your organization</DialogDescription>
                </DialogHeader>
                <FeatureForm onSuccess={() => setCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      ) : (
        /* Feature Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.id} data-testid="feature-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-1">{feature.name}</CardTitle>
                  <Badge variant={feature.status === "active" ? "default" : "secondary"}>
                    {feature.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {feature.description || "No description"}
                </p>
                <div className="flex items-center gap-2">
                  {can("feature.update") && (
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {can("feature.delete") && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={deleteFeature.isPending}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Feature</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{feature.name}&quot;? This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFeature.mutate(feature.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Form Component

```tsx
// src/app/[locale]/dashboard/feature/_components/feature-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateFeatureMutation } from "@/hooks/queries/feature";
import { createFeatureSchema, type CreateFeatureInput } from "@/lib/validations/feature";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface FeatureFormProps {
  onSuccess?: () => void;
}

export function FeatureForm({ onSuccess }: FeatureFormProps) {
  const createFeature = useCreateFeatureMutation();

  const form = useForm<CreateFeatureInput>({
    resolver: zodResolver(createFeatureSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  async function onSubmit(data: CreateFeatureInput) {
    createFeature.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess?.();
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter feature name"
                  {...field}
                  disabled={createFeature.isPending}
                />
              </FormControl>
              <FormDescription>A unique name for this feature (max 200 characters)</FormDescription>
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
                <Textarea
                  placeholder="Enter feature description"
                  {...field}
                  value={field.value ?? ""}
                  disabled={createFeature.isPending}
                  rows={3}
                />
              </FormControl>
              <FormDescription>Optional description (max 1000 characters)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={createFeature.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={createFeature.isPending}>
            {createFeature.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {createFeature.isPending ? "Creating..." : "Create Feature"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## Security Requirements

### Permission System V2 Architecture

The system uses a **"Compile, don't evaluate"** permission architecture:

1. **Roles + Overrides** describe INTENT
2. **Compiler** turns intent into FACTS (via database triggers)
3. **RLS** only checks FACTS (from `user_effective_permissions` table)

```
┌─────────────────────────────────────────────────────────────────┐
│                   Permission System V2                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │ user_role_       │   │ user_permission_ │                   │
│  │ assignments      │   │ overrides        │                   │
│  └────────┬─────────┘   └────────┬─────────┘                   │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │          Database Triggers               │                   │
│  │   (auto-compile on changes)              │                   │
│  └────────────────┬────────────────────────┘                   │
│                   │                                             │
│                   ▼                                             │
│  ┌─────────────────────────────────────────┐                   │
│  │   user_effective_permissions             │                   │
│  │   (THE KEY TABLE - only explicit facts)  │                   │
│  └────────────────┬────────────────────────┘                   │
│                   │                                             │
│                   ▼                                             │
│  ┌─────────────────────────────────────────┐                   │
│  │   RLS Policies (simple membership check) │                   │
│  │   is_org_member() + has_permission()     │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Available RLS Helper Functions

**VERIFIED**: These functions exist and use `auth.uid()` internally:

```sql
-- Check if current user is an active member of the organization
is_org_member(org_id UUID) RETURNS BOOLEAN

-- Check if current user has a specific permission in the organization
has_permission(org_id UUID, permission TEXT) RETURNS BOOLEAN

-- Alternative function (with explicit user_id parameter)
user_has_effective_permission(p_user_id UUID, p_organization_id UUID, p_permission_slug TEXT) RETURNS BOOLEAN
```

### RLS Policy Patterns

#### UPDATE Policy Rules

> **CRITICAL**: Every `FOR UPDATE` policy MUST define both `USING` and `WITH CHECK`.
>
> - `USING`: Controls which existing rows can be targeted for update
> - `WITH CHECK`: Controls what values the row can be changed into
> - They SHOULD match unless you intentionally want to restrict what can be written differently from what can be read

#### Canonical UPDATE Policy Pattern (Soft-Delete Support)

This pattern handles both normal updates AND soft-deletes via a single UPDATE policy with permission escalation:

```sql
-- SELECT: Org members can view (tenant boundary)
CREATE POLICY "table_select_member"
  ON public.table_name FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

-- INSERT: Check permission
CREATE POLICY "table_insert_permission"
  ON public.table_name FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(organization_id) AND
    has_permission(organization_id, 'module.create')
  );

-- UPDATE: Canonical pattern supporting normal updates AND soft-deletes
-- - Users with module.update can update non-deleted rows (normal updates)
-- - Users with module.delete can soft-delete any row (setting deleted_at)
CREATE POLICY "table_update_permission"
  ON public.table_name FOR UPDATE
  TO authenticated
  USING (
    is_org_member(organization_id) AND
    (
      (deleted_at IS NULL AND has_permission(organization_id, 'module.update'))
      OR
      has_permission(organization_id, 'module.delete')
    )
  )
  WITH CHECK (
    is_org_member(organization_id) AND
    (
      (deleted_at IS NULL AND has_permission(organization_id, 'module.update'))
      OR
      has_permission(organization_id, 'module.delete')
    )
  );

-- DELETE: OPTIONAL - for rare hard-delete or admin cleanup scenarios only
-- Most operations should use soft-delete via UPDATE (setting deleted_at)
CREATE POLICY "table_delete_permission"
  ON public.table_name FOR DELETE
  TO authenticated
  USING (
    is_org_member(organization_id) AND
    has_permission(organization_id, 'module.delete') AND
    deleted_at IS NULL
  );
```

> **Note on DELETE policies**: The `FOR DELETE` policy is OPTIONAL and should only be used for:
>
> 1. Rare hard-delete scenarios (admin cleanup)
> 2. Compliance requirements that mandate actual data deletion
>
> Standard delete operations should use soft-delete via UPDATE (setting `deleted_at`).

### Permission Naming Convention

```
category.action

Examples:
- feature.read
- feature.create
- feature.update
- feature.delete
- warehouse.products.read
- warehouse.inventory.manage
- members.manage
- branches.create
```

### Client-Side Permission Check

```typescript
import { usePermissions } from "@/hooks/v2/use-permissions";

export function MyComponent() {
  const { can, cannot, canAny, canAll } = usePermissions();

  // Check single permission
  if (cannot("feature.create")) {
    return <AccessDenied />;
  }

  // Check any of multiple permissions
  if (canAny(["feature.update", "feature.delete"])) {
    return <ManagementActions />;
  }

  // Check all permissions required
  if (canAll(["feature.create", "feature.update", "feature.delete"])) {
    return <FullAdminPanel />;
  }

  return (
    <div>
      {can("feature.update") && <EditButton />}
      {can("feature.delete") && <DeleteButton />}
    </div>
  );
}
```

### Server-Side Permission Check

```typescript
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";

// In server actions
const hasPermission = await PermissionServiceV2.hasPermission(
  supabase,
  userId,
  organizationId,
  "feature.create"
);

if (!hasPermission) {
  return { success: false, error: "Permission denied" };
}
```

---

## Module Configuration

**Location**: `src/modules/[module]/config.ts`

### Module Types

```typescript
// src/lib/types/module.ts
import { Scope } from "./user";
import { Widget } from "./widgets";

export type MenuItem = LinkMenuItem | ActionMenuItem;

export interface AllowedUser {
  role: string;
  scope: Scope;
}

export interface BaseMenuItem {
  id: string;
  label: string; // i18n key
  icon: string; // Lucide icon name
  allowedUsers?: AllowedUser[];
  requiredPermissions?: string[]; // Permission-based access control
}

export interface LinkMenuItem extends BaseMenuItem {
  type?: "link";
  path: string;
  submenu?: MenuItem[];
}

export interface ActionMenuItem extends BaseMenuItem {
  type: "action";
  actionId?: string;
}

export interface ModuleConfig {
  id: string;
  slug: string;
  title: string; // i18n key
  icon?: string; // Lucide icon name
  description?: string; // i18n key
  color?: string; // Hex color for module theme
  path?: string; // Optional direct link
  items: MenuItem[];
  actions?: Record<string, () => void>;
  widgets?: Widget[];
}
```

### Widget Types

```typescript
// src/lib/types/widgets.ts
export type WidgetBase = {
  id: string;
  title: string;
};

export type WidgetMetric = WidgetBase & {
  type: "metric";
  data: {
    value: number;
    label?: string;
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
  };
  config?: {
    icon?: string;
    color?: string;
  };
};

export type WidgetList = WidgetBase & {
  type: "list";
  data: {
    items: {
      id: string;
      title: string;
      description?: string;
      timestamp?: string;
      user?: string;
    }[];
  };
  config?: {
    showTimestamp?: boolean;
    maxItems?: number;
  };
};

export type WidgetChart = WidgetBase & {
  type: "chart";
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }[];
  };
  config: {
    type: "bar" | "line" | "pie" | "doughnut";
    responsive?: boolean;
  };
};

export type WidgetCustom = WidgetBase & {
  type: "custom";
  componentName: string;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export type Widget = WidgetMetric | WidgetList | WidgetChart | WidgetCustom;
```

### Module Config Example

```typescript
// src/modules/feature/config.ts
import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

export async function getFeatureModule(): Promise<ModuleConfig> {
  const widgets: Widget[] = [
    {
      id: "feature-stats",
      title: "Feature Statistics",
      type: "metric",
      data: {
        value: 42,
        label: "Total Features",
        change: "+12%",
        changeType: "positive",
      },
      config: {
        icon: "Package",
        color: "#10b981",
      },
    },
  ];

  return {
    id: "feature",
    slug: "feature",
    title: "modules.feature.title",
    icon: "Package",
    description: "modules.feature.description",
    color: "#10b981",
    items: [
      {
        id: "feature-list",
        label: "modules.feature.items.list",
        icon: "List",
        path: "/dashboard/feature",
        requiredPermissions: ["feature.read"],
      },
      {
        id: "feature-settings",
        label: "modules.feature.items.settings",
        icon: "Settings",
        path: "/dashboard/feature/settings",
        requiredPermissions: ["feature.update"],
      },
    ],
    widgets,
  };
}
```

### Register Module

**Location**: `src/modules/index.ts`

> **NOTE**: `getAllModules()` returns `ModuleWithAccess[]` which extends `ModuleConfig` with subscription access fields (`hasAccess`, `isPremium`, `requiredPlan`, `isAlwaysAvailable`).

```typescript
import { getFeatureModule } from "./feature/config";

// In getAllModules function, add to the allModulesConfig array:
const allModulesConfig = [
  // ... existing modules (homeModule, warehouseModule, contactsModule, etc.)

  // Free tier modules (always available)
  { module: await getFeatureModule(), alwaysAvailable: true, requiredPlan: "free" },

  // Professional tier modules (subscription-gated)
  // { module: await getPremiumModule(), alwaysAvailable: false, requiredPlan: "professional" },
];
```

---

## Performance Optimization

### Database Indexes

Always create indexes for:

- Foreign keys (`organization_id`, `branch_id`, `created_by`)
- Soft delete filter (`deleted_at`)
- Frequently filtered columns (`status`, `type`)
- Frequently sorted columns (`created_at`)

```sql
-- Partial index for non-deleted records
CREATE INDEX IF NOT EXISTS idx_feature_items_active
  ON public.feature_items(organization_id, status)
  WHERE deleted_at IS NULL;
```

### React Query Configuration

```typescript
// Optimal stale times
const queryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes for most data
  refetchOnWindowFocus: false, // Avoid excessive refetches
  retry: 2, // Retry failed requests twice
};
```

### Component Optimization

```typescript
// Use React.memo for list items
const FeatureCard = React.memo(function FeatureCard({ feature }: Props) {
  // ...
});

// Use useDebounce for search inputs (from @/hooks/use-debounce)
const debouncedSearch = useDebounce(search, 300);

// Use Suspense boundaries for code splitting
const LazyFeatureDetails = React.lazy(() => import("./feature-details"));
```

### Bundle Optimization

```typescript
// Dynamic imports for heavy components
const Chart = dynamic(() => import("@/components/chart"), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false, // Disable SSR for client-only components
});
```

---

## Internationalization

**Location**: `messages/en.json` and `messages/pl.json`

```json
{
  "modules": {
    "feature": {
      "title": "Features",
      "description": "Manage your features",
      "items": {
        "list": "Feature List",
        "settings": "Settings"
      }
    }
  },
  "FeaturePage": {
    "title": "Features",
    "description": "View and manage all features",
    "noOrganization": "Please select an organization",
    "createButton": "Create Feature",
    "editButton": "Edit",
    "deleteButton": "Delete",
    "confirmDelete": "Are you sure you want to delete this feature?",
    "searchPlaceholder": "Search features...",
    "noFeatures": "No features found",
    "createFirst": "Create your first feature"
  }
}
```

---

## Commands Reference

```bash
# Development
pnpm dev                 # Start dev server
pnpm build              # Production build
pnpm type-check         # TypeScript validation
pnpm lint               # ESLint
pnpm format             # Prettier

# Supabase
pnpm supabase:link:dev                      # Link to dev project
pnpm supabase:migration:new -- name         # Create migration
pnpm supabase:migration:up                  # Apply migrations
pnpm supabase:gen:types                     # Generate TypeScript types

# Testing (vitest)
pnpm test                # Run tests in watch mode (vitest)
pnpm test:run            # Run all tests once
pnpm test:coverage       # Run tests with coverage
pnpm test:watch          # Watch mode (explicit)
pnpm test:ui             # Vitest UI dashboard
```

---

## Testing Requirements

### Test File Locations

```
src/
├── server/services/__tests__/
│   └── feature.service.test.ts
├── app/actions/feature/__tests__/
│   └── index.test.ts
├── hooks/queries/feature/__tests__/
│   └── index.test.tsx
└── app/[locale]/dashboard/feature/_components/__tests__/
    └── feature-page-client.test.tsx
```

### Service Test Example

```typescript
// src/server/services/__tests__/feature.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FeatureService } from "../feature.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/supabase/types/types";

type MockSupabase = ReturnType<typeof vi.fn> & SupabaseClient<Database>;

describe("FeatureService", () => {
  const mockSupabase = {
    from: vi.fn(),
  } as unknown as MockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeatures", () => {
    it("should fetch features for organization", async () => {
      const mockFeatures = [
        { id: "1", name: "Feature 1", organization_id: "org-1" },
        { id: "2", name: "Feature 2", organization_id: "org-1" },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockFeatures,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await FeatureService.getFeatures(mockSupabase, "org-1");

      expect(result).toEqual(mockFeatures);
      expect(mockSupabase.from).toHaveBeenCalledWith("feature_items");
    });

    it("should apply filters correctly", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery);

      await FeatureService.getFeatures(mockSupabase, "org-1", {
        status: "active",
        search: "test",
      });

      expect(mockQuery.eq).toHaveBeenCalledWith("status", "active");
      expect(mockQuery.ilike).toHaveBeenCalledWith("name", "%test%");
    });

    it("should throw error on database failure", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Database error" },
              }),
            }),
          }),
        }),
      });

      await expect(FeatureService.getFeatures(mockSupabase, "org-1")).rejects.toThrow(
        "Failed to fetch features"
      );
    });
  });
});
```

### Component Test Example

```typescript
// src/app/[locale]/dashboard/feature/_components/__tests__/feature-page-client.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturePageClient } from "../feature-page-client";

// Mock hooks
vi.mock("@/hooks/queries/feature", () => ({
  useFeaturesQuery: vi.fn(),
  useDeleteFeatureMutation: vi.fn(),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({
    can: vi.fn().mockReturnValue(true),
    cannot: vi.fn().mockReturnValue(false),
    canAny: vi.fn().mockReturnValue(true),
    canAll: vi.fn().mockReturnValue(true),
  }),
}));

describe("FeaturePageClient", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it("should show loading state", async () => {
    const { useFeaturesQuery } = await import("@/hooks/queries/feature");
    (useFeaturesQuery as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true });

    render(<FeaturePageClient />, { wrapper });

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("should show features when loaded", async () => {
    const { useFeaturesQuery } = await import("@/hooks/queries/feature");
    (useFeaturesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { id: "1", name: "Feature 1", status: "active", description: "Test" },
      ],
      isLoading: false,
    });

    render(<FeaturePageClient />, { wrapper });

    expect(screen.getByText("Feature 1")).toBeInTheDocument();
  });

  it("should show empty state when no features", async () => {
    const { useFeaturesQuery } = await import("@/hooks/queries/feature");
    (useFeaturesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<FeaturePageClient />, { wrapper });

    expect(screen.getByText("No features found")).toBeInTheDocument();
  });
});
```

### RLS Integration Tests (CRITICAL)

> **WARNING**: Mocked Supabase clients are insufficient to prove RLS policies work. Integration tests MUST run against real Postgres with RLS enabled. The expected behavior for unauthorized access is "row invisibility" (empty results), not errors.

#### Required Test Cases

1. **Cross-tenant isolation**: User A cannot SELECT/UPDATE org B data
2. **Permission enforcement**: User without permission cannot mutate
3. **Soft-delete visibility**: `deleted_at` rows are invisible
4. **ID guessing attack**: Cannot access by guessing UUIDs

#### Example RLS Attack Test

```typescript
// test/integration/rls/feature.rls.test.ts
import { createClient } from "@supabase/supabase-js";

describe("Feature RLS", () => {
  let orgAClient: SupabaseClient; // User in Org A
  let orgBClient: SupabaseClient; // User in Org B
  let serviceRoleClient: SupabaseClient; // For setup
  let orgAFeatureId: string;

  beforeAll(async () => {
    // Setup: Create test users, orgs, and a feature in Org A
    // Use service role to create test data
  });

  it("User B cannot read Org A features", async () => {
    const { data, error } = await orgBClient
      .from("feature_items")
      .select("*")
      .eq("id", orgAFeatureId);

    // RLS returns empty result, NOT an error
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it("User B cannot update Org A features by ID guessing", async () => {
    const { data, error } = await orgBClient
      .from("feature_items")
      .update({ name: "hacked" })
      .eq("id", orgAFeatureId)
      .select();

    // Either returns empty (row not visible) or error (policy violation)
    expect(data?.length ?? 0).toBe(0);
  });

  it("Soft-deleted features are invisible", async () => {
    // Soft-delete the feature via service role
    await serviceRoleClient
      .from("feature_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", orgAFeatureId);

    // User cannot see it anymore
    const { data } = await orgAClient.from("feature_items").select("*").eq("id", orgAFeatureId);

    expect(data).toEqual([]);
  });
});
```

### Running Integration Tests

RLS and permission compiler tests MUST run against a real Postgres database with RLS enabled (not mocks). There are two supported paths:

#### Path A: Local Supabase (home / local machine)

If you have Supabase CLI installed locally:

```bash
# Start local Supabase (includes local Postgres with RLS)
supabase start

# Run integration tests against local DB
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
pnpm test:run -- test/integration/
```

This is the preferred path for fast iteration. Local Supabase gives you a fresh database with all migrations applied.

#### Path B: Remote / ephemeral DB (work / CI)

When local Supabase is not available (e.g., Firebase Studio, browser-only environment, CI pipelines):

- Use the remote dev project (`zlcnlalwfmmtusigeuyk`) or a dedicated ephemeral test database
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables pointing to the remote instance
- Ensure test data is cleaned up after each run to avoid pollution

```bash
# Run integration tests against remote dev DB
SUPABASE_URL=https://zlcnlalwfmmtusigeuyk.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
pnpm test:run -- test/integration/
```

> **Important**: Both paths require real Postgres with RLS enabled. Never mock the Supabase client for RLS or permission tests.

### Permission Compiler Tests (V2-Specific)

The V2 permission system compiles intent tables into `user_effective_permissions`. These tests verify the compiler works correctly:

- Role assignment → effective permissions created
- Override → effective permissions changed
- Role removal → effective permissions removed

```typescript
// test/integration/permissions/permission-compiler.test.ts
describe("Permission Compiler V2", () => {
  it("Role assignment creates effective permissions", async () => {
    // Assign role to user
    await assignRoleToUser(userId, "org_member", orgId);

    // Verify compiled permissions exist
    const { data } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    expect(data?.map((p) => p.permission_slug)).toContain("org.read");
  });

  it("Permission override modifies effective permissions", async () => {
    // Grant additional permission
    await createPermissionOverride(userId, orgId, "feature.delete", "grant");

    // Verify it compiled
    const { data } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .eq("permission_slug", "feature.delete");

    expect(data?.length).toBe(1);
  });

  it("Role removal cleans up effective permissions", async () => {
    // Remove role
    await removeRoleFromUser(userId, roleAssignmentId);

    // Verify permissions removed
    const { data } = await supabase
      .from("user_effective_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    expect(data).toEqual([]);
  });
});
```

### Post-Migration Verification

After migrations that add permissions, run verification queries:

```sql
-- 1) Verify permission exists
SELECT * FROM public.permissions WHERE slug = 'feature.create';

-- 2) Verify role has permission
SELECT r.name, p.slug, rp.allowed
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name = 'org_owner' AND p.slug LIKE 'feature.%';

-- 3) Verify compilation (for a test user)
SELECT * FROM public.user_effective_permissions
WHERE user_id = '<test-user-uuid>'
AND organization_id = '<test-org-uuid>'
AND permission_slug = 'feature.create';
```

---

## Checklist

### Before Starting

- [ ] Read this entire guide
- [ ] Understand the 6-layer architecture
- [ ] Review existing module implementations (warehouse, teams, organization-managment, contacts, user-account, etc.)

### Database Layer

- [ ] Migration file created with correct naming (YYYYMMDDHHMMSS_description.sql)
- [ ] Table has all required columns (id, organization_id, created_at, updated_at, deleted_at, created_by)
- [ ] Indexes created for foreign keys and frequently queried columns
- [ ] RLS enabled on table
- [ ] RLS policies use `is_org_member()` and `has_permission()` helper functions
- [ ] **UPDATE policies have both `USING` and `WITH CHECK` (must match)**
- [ ] **UPDATE policy supports soft-delete via permission escalation pattern**
- [ ] Permissions added to `permissions` table
- [ ] Permissions assigned to roles in `role_permissions`
- [ ] Migration applied successfully
- [ ] Post-migration permission verification queries run
- [ ] Types regenerated with `pnpm supabase:gen:types`

### Service Layer

- [ ] Service class created in `src/server/services/`
- [ ] Static methods with Supabase client as first parameter
- [ ] Organization scoping in ALL queries
- [ ] Proper error handling with descriptive messages
- [ ] All CRUD operations implemented
- [ ] Soft delete pattern used (update deleted_at, not actual delete)

### Validation Layer

- [ ] Zod schemas created in `src/lib/validations/`
- [ ] Input schemas for create/update operations
- [ ] Filter schemas for list operations
- [ ] Types exported from schema file
- [ ] Validation messages are user-friendly

### Server Actions

- [ ] Actions file in `src/app/actions/[module]/`
- [ ] `"use server"` directive at top
- [ ] `authenticateUser()` helper using `getUser()` for auth
- [ ] Zod validation for all inputs
- [ ] Permission check using `PermissionServiceV2.hasPermission()`
- [ ] Proper error handling with try/catch
- [ ] Returns `ActionResult<T>` type

### React Query Hooks

- [ ] Hooks file in `src/hooks/queries/[module]/`
- [ ] Query keys defined with factory pattern
- [ ] useQuery for reads with proper staleTime
- [ ] useMutation for writes with cache invalidation
- [ ] Toast notifications using `react-toastify`
- [ ] **Optimistic updates explicitly typed (no `any`), with safe undefined fallback**

### Pages & Components

- [ ] Server Component page in `src/app/[locale]/dashboard/[module]/`
- [ ] Loading.tsx for Suspense fallback
- [ ] Error.tsx for error boundary
- [ ] Client Component in `_components/` folder
- [ ] Loading states with Skeleton components
- [ ] Error states with retry option
- [ ] Empty states with call-to-action
- [ ] Permission-based rendering using `usePermissions()`
- [ ] Mobile-first responsive design
- [ ] Using shadcn/ui components

### Module Configuration

- [ ] Config file created in `src/modules/[module]/`
- [ ] Module registered in `src/modules/index.ts`
- [ ] Menu items with `requiredPermissions`
- [ ] Widgets defined if applicable
- [ ] i18n keys added to messages files

### Testing

- [ ] Service tests written (unit tests with mocks)
- [ ] Action tests written (if applicable)
- [ ] Component tests written
- [ ] **RLS integration tests written (cross-tenant, permissions, soft-delete) - against real DB**
- [ ] **Permission compiler tests written (for V2 system)**
- [ ] All tests passing (`pnpm test:run`)
- [ ] Type check passing (`pnpm type-check`)
- [ ] Lint passing (`pnpm lint`)

### Security Final Check

- [ ] RLS policies prevent cross-organization data access
- [ ] Server-side permission validation in all mutating actions
- [ ] Client-side permission checks for UI elements
- [ ] No sensitive data exposed in client components
- [ ] Proper error messages (no sensitive info leaked)

### Final

- [ ] Dev server killed after testing
- [ ] Code formatted with Prettier (`pnpm format`)
- [ ] No console.log statements (except errors)
- [ ] No TypeScript errors
- [ ] Documentation updated if needed

---

## Hardening Standards (Recommended)

> **Note**: These are **recommended patterns for new modules**, particularly those handling sensitive data or expecting scale. They are NOT yet widespread in the current codebase but represent best practices for enterprise-grade modules.

### FORCE ROW LEVEL SECURITY

**Status**: OPTIONAL / FUTURE - Partial adoption (currently only in enterprise cleanup migration).

For sensitive tables (user data, permissions, billing), consider using `FORCE ROW LEVEL SECURITY` to prevent even table owners from bypassing RLS:

```sql
-- Prevents even table owners from bypassing RLS
ALTER TABLE public.sensitive_table FORCE ROW LEVEL SECURITY;
```

**When to consider**:

- Permission-related tables
- PII/user data
- Billing/subscription data
- Audit logs

This is NOT currently a codebase standard, but recommended for new sensitive modules.

### Search Performance Indexing

**Status**: Current codebase uses `ilike` without specialized indexes.

`ilike('%term%')` causes full table scans on large datasets. For modules with >10k rows, consider one of:

**1. Trigram index** (pg_trgm):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_feature_items_name_trgm
  ON public.feature_items
  USING GIN (name gin_trgm_ops);
```

**2. Full-text search**:

```sql
ALTER TABLE public.feature_items ADD COLUMN search_vector tsvector;
CREATE INDEX idx_feature_items_fts ON public.feature_items USING GIN(search_vector);
```

### Cursor Pagination

**Status**: Current codebase uses offset pagination (default).

**Offset pagination** (current pattern): OK for small tables (<10k rows).

**Cursor pagination** (recommended for scale):

```typescript
// Cursor-based query
static async getFeaturesCursor(
  supabase: DbClient,
  organizationId: string,
  cursor?: { createdAt: string; id: string },
  limit = 50
): Promise<FeatureRow[]> {
  let query = supabase
    .from("feature_items")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},` +
      `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  return data ?? [];
}
```

**When to consider**:

- Tables expected to grow >10k rows
- User-facing lists with frequent pagination
- Real-time data with concurrent inserts

### Import Boundary Rules

Enforce architectural boundaries through import discipline. Actions are the ONLY allowed bridge between client and server layers.

| Layer             | Can Import From                                  | Cannot Import From           |
| ----------------- | ------------------------------------------------ | ---------------------------- |
| Client Components | hooks, lib/types, lib/validations, components/ui | server/_, app/actions/_      |
| Server Actions    | server/services, lib/\*, utils/supabase/server   | React, client hooks          |
| Services          | lib/types, supabase types                        | React, Next.js APIs, actions |
| Hooks             | app/actions, lib/validations, lib/types          | server/\* directly           |

**Architectural rule**: Actions are the ONLY layer that bridges client and server. Client components NEVER import directly from server/.

### Data Classification for Read Permissions

Not all data should be visible to all org members. Classify data and apply appropriate SELECT policies:

| Class              | SELECT Policy                                                | Example Tables                   |
| ------------------ | ------------------------------------------------------------ | -------------------------------- |
| **A (Open)**       | `is_org_member()` only                                       | products, locations, news        |
| **B (Sensitive)**  | `is_org_member() AND has_permission(..., 'module.read')`     | members, roles, audit_logs       |
| **C (Restricted)** | `user_id = auth.uid() OR has_permission(..., 'module.read')` | user_preferences, personal_notes |

**Server action rule**: For Class B/C modules, SHOULD also check read permission in server actions as defense-in-depth. RLS remains the hard enforcement boundary.

---

## Quick Start Template

To create a new module, create files in this order:

1. `supabase/migrations/[timestamp]_create_[module]_table.sql`
2. `src/lib/validations/[module].ts`
3. `src/server/services/[module].service.ts`
4. `src/app/actions/[module]/index.ts`
5. `src/hooks/queries/[module]/index.ts`
6. `src/app/[locale]/dashboard/[module]/page.tsx`
7. `src/app/[locale]/dashboard/[module]/loading.tsx`
8. `src/app/[locale]/dashboard/[module]/error.tsx`
9. `src/app/[locale]/dashboard/[module]/_components/[module]-page-client.tsx`
10. `src/modules/[module]/config.ts`
11. Update `src/modules/index.ts`
12. Update `messages/en.json` and `messages/pl.json`

---

_Last updated: February 6, 2026_
_Verified against codebase and live Supabase database on phase-2-user-prefrences branch_
