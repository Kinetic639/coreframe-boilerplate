# Creating a New Feature Module

This guide walks you through creating a complete feature module from scratch using the SSR-first architecture. We'll build an "Apps" module as an example.

## Overview

Creating a new module involves 6 steps in order:

1. **Database**: Create migration with tables + RLS policies
2. **Schema**: Define Zod validation schemas for inputs
3. **Service**: Implement business logic layer
4. **Actions**: Create server actions for client communication
5. **Hooks**: Build React Query hooks for data fetching (optional if using stores)
6. **UI**: Create pages and components using hooks or actions

## Example: Apps Module

Let's build an "Apps" module that allows organizations to manage third-party app integrations.

### Step 1: Create Database Migration

**File**: `supabase/migrations/[timestamp]_create_apps.sql`

```sql
-- =============================================
-- Apps Module Database Schema
-- =============================================

-- Create apps table
CREATE TABLE IF NOT EXISTS public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- App details
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  category TEXT NOT NULL, -- integration, productivity, analytics, etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'inactive', -- active, inactive, error
  is_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Configuration
  config JSONB DEFAULT '{}',
  api_key TEXT,
  webhook_url TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(organization_id, slug)
);

-- Create app_logs table for tracking events
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,

  log_level TEXT NOT NULL, -- info, warning, error
  event_type TEXT NOT NULL, -- sync, api_call, webhook, etc.
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_organization_id ON public.apps(organization_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON public.apps(status);
CREATE INDEX IF NOT EXISTS idx_app_logs_app_id ON public.app_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_apps_updated_at
  BEFORE UPDATE ON public.apps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Apps policies
CREATE POLICY "Users can view their organization's apps"
  ON public.apps FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create apps in their organization"
  ON public.apps FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('org_owner', 'org_admin')
    )
  );

CREATE POLICY "Users can update their organization's apps"
  ON public.apps FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('org_owner', 'org_admin')
    )
  );

CREATE POLICY "Users can delete their organization's apps"
  ON public.apps FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'org_owner'
    )
  );

-- App logs policies (read-only for users)
CREATE POLICY "Users can view logs for their organization's apps"
  ON public.app_logs FOR SELECT
  USING (
    app_id IN (
      SELECT id FROM public.apps
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apps TO authenticated;
GRANT SELECT ON public.app_logs TO authenticated;
```

**Apply migration**:

```bash
npm run supabase:migration:up
```

**Generate TypeScript types**:

```bash
npm run supabase:gen:types
```

### Step 2: Create Zod Schemas

**File**: `src/lib/schemas/apps.schemas.ts`

```typescript
import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const appCategorySchema = z.enum([
  "integration",
  "productivity",
  "analytics",
  "communication",
  "storage",
  "other",
]);

export const appStatusSchema = z.enum(["active", "inactive", "error"]);

export const logLevelSchema = z.enum(["info", "warning", "error"]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating an app
 */
export const createAppSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(500).optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
  category: appCategorySchema,
  config: z.record(z.any()).optional().default({}),
  api_key: z.string().optional().nullable(),
  webhook_url: z.string().url().optional().nullable(),
});

/**
 * Schema for updating an app
 */
export const updateAppSchema = createAppSchema.partial().extend({
  is_enabled: z.boolean().optional(),
  status: appStatusSchema.optional(),
});

/**
 * Schema for filtering apps
 */
export const appFiltersSchema = z.object({
  category: appCategorySchema.optional(),
  status: appStatusSchema.optional(),
  is_enabled: z.boolean().optional(),
  search: z.string().optional(),
});

/**
 * Schema for creating an app log
 */
export const createAppLogSchema = z.object({
  app_id: z.string().uuid(),
  log_level: logLevelSchema,
  event_type: z.string().min(1).max(50),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional().default({}),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type AppCategory = z.infer<typeof appCategorySchema>;
export type AppStatus = z.infer<typeof appStatusSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export type CreateAppInput = z.infer<typeof createAppSchema>;
export type UpdateAppInput = z.infer<typeof updateAppSchema>;
export type AppFilters = z.infer<typeof appFiltersSchema>;
export type CreateAppLogInput = z.infer<typeof createAppLogSchema>;
```

### Step 3: Create Service Layer

**File**: `src/server/services/apps.service.ts`

```typescript
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import type {
  CreateAppInput,
  UpdateAppInput,
  AppFilters,
  CreateAppLogInput,
} from "@/lib/schemas/apps.schemas";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type App = Database["public"]["Tables"]["apps"]["Row"];
type AppLog = Database["public"]["Tables"]["app_logs"]["Row"];

// ==========================================
// APPS SERVICE
// ==========================================

export class AppsService {
  /**
   * Get all apps for an organization with optional filters
   */
  static async getApps(organizationId: string, filters: AppFilters = {}): Promise<App[]> {
    const supabase = await createClient();

    let query = supabase
      .from("apps")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.is_enabled !== undefined) {
      query = query.eq("is_enabled", filters.is_enabled);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch apps: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single app by ID
   */
  static async getApp(appId: string, organizationId: string): Promise<App | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("id", appId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch app: ${error.message}`);
    }

    return data;
  }

  /**
   * Get app by slug
   */
  static async getAppBySlug(slug: string, organizationId: string): Promise<App | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("slug", slug)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch app: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new app
   */
  static async createApp(
    input: CreateAppInput,
    organizationId: string,
    userId: string
  ): Promise<App> {
    const supabase = await createClient();

    // Check if slug already exists
    const existing = await this.getAppBySlug(input.slug, organizationId);
    if (existing) {
      throw new Error("An app with this slug already exists");
    }

    const { data, error } = await supabase
      .from("apps")
      .insert({
        ...input,
        organization_id: organizationId,
        created_by: userId,
        status: "inactive",
        is_enabled: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create app: ${error.message}`);
    }

    // Log creation
    await this.createAppLog({
      app_id: data.id,
      log_level: "info",
      event_type: "app_created",
      message: `App "${input.name}" created`,
    });

    return data;
  }

  /**
   * Update an app
   */
  static async updateApp(
    appId: string,
    organizationId: string,
    input: UpdateAppInput
  ): Promise<App> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("apps")
      .update(input)
      .eq("id", appId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update app: ${error.message}`);
    }

    // Log update
    await this.createAppLog({
      app_id: data.id,
      log_level: "info",
      event_type: "app_updated",
      message: `App "${data.name}" updated`,
      metadata: { changes: input },
    });

    return data;
  }

  /**
   * Delete an app
   */
  static async deleteApp(appId: string, organizationId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("apps")
      .delete()
      .eq("id", appId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`Failed to delete app: ${error.message}`);
    }
  }

  /**
   * Toggle app enabled status
   */
  static async toggleAppStatus(
    appId: string,
    organizationId: string,
    isEnabled: boolean
  ): Promise<App> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("apps")
      .update({
        is_enabled: isEnabled,
        status: isEnabled ? "active" : "inactive",
      })
      .eq("id", appId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle app status: ${error.message}`);
    }

    // Log status change
    await this.createAppLog({
      app_id: data.id,
      log_level: "info",
      event_type: "status_changed",
      message: `App "${data.name}" ${isEnabled ? "enabled" : "disabled"}`,
    });

    return data;
  }

  /**
   * Get logs for an app
   */
  static async getAppLogs(appId: string, limit: number = 50): Promise<AppLog[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_logs")
      .select("*")
      .eq("app_id", appId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch app logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create an app log entry
   */
  static async createAppLog(input: CreateAppLogInput): Promise<AppLog> {
    const supabase = await createClient();

    const { data, error } = await supabase.from("app_logs").insert(input).select().single();

    if (error) {
      throw new Error(`Failed to create app log: ${error.message}`);
    }

    return data;
  }
}
```

### Step 4: Create Server Actions

**File**: `src/app/[locale]/dashboard/apps/_actions.ts`

```typescript
"use server";

import { z } from "zod";
import { AppsService } from "@/server/services/apps.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import {
  createAppSchema,
  updateAppSchema,
  appFiltersSchema,
  type CreateAppInput,
  type UpdateAppInput,
  type AppFilters,
} from "@/lib/schemas/apps.schemas";

// ==========================================
// ACTION RESPONSE TYPE
// ==========================================

type ActionResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };

// ==========================================
// APPS ACTIONS
// ==========================================

/**
 * Get all apps for the active organization
 */
export async function getApps(
  filters?: AppFilters
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.getApps>>>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const validatedFilters = filters ? appFiltersSchema.parse(filters) : {};

    const apps = await AppsService.getApps(appContext.activeOrgId, validatedFilters);

    return { success: true, data: apps };
  } catch (error) {
    console.error("Error in getApps:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch apps",
    };
  }
}

/**
 * Get a single app by ID
 */
export async function getApp(
  appId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.getApp>>>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const app = await AppsService.getApp(appId, appContext.activeOrgId);

    if (!app) {
      return { success: false, error: "App not found" };
    }

    return { success: true, data: app };
  } catch (error) {
    console.error("Error in getApp:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch app",
    };
  }
}

/**
 * Create a new app
 */
export async function createApp(
  input: CreateAppInput
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.createApp>>>> {
  try {
    // Validate input
    const validated = createAppSchema.parse(input);

    // Get context
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId || !appContext?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    // Create app
    const app = await AppsService.createApp(validated, appContext.activeOrgId, appContext.user.id);

    return { success: true, data: app };
  } catch (error) {
    console.error("Error in createApp:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create app",
    };
  }
}

/**
 * Update an app
 */
export async function updateApp(
  appId: string,
  input: UpdateAppInput
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.updateApp>>>> {
  try {
    // Validate input
    const validated = updateAppSchema.parse(input);

    // Get context
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    // Update app
    const app = await AppsService.updateApp(appId, appContext.activeOrgId, validated);

    return { success: true, data: app };
  } catch (error) {
    console.error("Error in updateApp:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update app",
    };
  }
}

/**
 * Delete an app
 */
export async function deleteApp(appId: string): Promise<ActionResponse<void>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    await AppsService.deleteApp(appId, appContext.activeOrgId);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error in deleteApp:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete app",
    };
  }
}

/**
 * Toggle app enabled status
 */
export async function toggleAppStatus(
  appId: string,
  isEnabled: boolean
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.toggleAppStatus>>>> {
  try {
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const app = await AppsService.toggleAppStatus(appId, appContext.activeOrgId, isEnabled);

    return { success: true, data: app };
  } catch (error) {
    console.error("Error in toggleAppStatus:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle app status",
    };
  }
}

/**
 * Get logs for an app
 */
export async function getAppLogs(
  appId: string,
  limit?: number
): Promise<ActionResponse<Awaited<ReturnType<typeof AppsService.getAppLogs>>>> {
  try {
    const logs = await AppsService.getAppLogs(appId, limit);
    return { success: true, data: logs };
  } catch (error) {
    console.error("Error in getAppLogs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch logs",
    };
  }
}
```

### Step 5: Create React Query Hooks (Optional)

**File**: `src/lib/hooks/queries/apps-queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  toggleAppStatus,
  getAppLogs,
} from "@/app/[locale]/dashboard/apps/_actions";
import type { CreateAppInput, UpdateAppInput, AppFilters } from "@/lib/schemas/apps.schemas";
import { toast } from "react-toastify";

// ==========================================
// QUERY KEYS
// ==========================================

export const appsKeys = {
  all: ["apps"] as const,
  lists: () => [...appsKeys.all, "list"] as const,
  list: (filters?: AppFilters) => [...appsKeys.lists(), filters] as const,
  details: () => [...appsKeys.all, "detail"] as const,
  detail: (id: string) => [...appsKeys.details(), id] as const,
  logs: (id: string) => [...appsKeys.detail(id), "logs"] as const,
};

// ==========================================
// QUERY HOOKS
// ==========================================

/**
 * Get all apps with optional filters
 */
export function useApps(filters?: AppFilters) {
  return useQuery({
    queryKey: appsKeys.list(filters),
    queryFn: async () => {
      const result = await getApps(filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

/**
 * Get a single app by ID
 */
export function useApp(appId: string) {
  return useQuery({
    queryKey: appsKeys.detail(appId),
    queryFn: async () => {
      const result = await getApp(appId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!appId,
  });
}

/**
 * Get logs for an app
 */
export function useAppLogs(appId: string, limit?: number) {
  return useQuery({
    queryKey: appsKeys.logs(appId),
    queryFn: async () => {
      const result = await getAppLogs(appId, limit);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!appId,
  });
}

// ==========================================
// MUTATION HOOKS
// ==========================================

/**
 * Create a new app
 */
export function useCreateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAppInput) => createApp(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
        toast.success("App created successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create app");
    },
  });
}

/**
 * Update an app
 */
export function useUpdateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, input }: { appId: string; input: UpdateAppInput }) =>
      updateApp(appId, input),
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: appsKeys.detail(variables.appId),
        });
        toast.success("App updated successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update app");
    },
  });
}

/**
 * Delete an app
 */
export function useDeleteApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) => deleteApp(appId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
        toast.success("App deleted successfully");
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete app");
    },
  });
}

/**
 * Toggle app enabled status
 */
export function useToggleAppStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, isEnabled }: { appId: string; isEnabled: boolean }) =>
      toggleAppStatus(appId, isEnabled),
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: appsKeys.detail(variables.appId),
        });
        toast.success(`App ${variables.isEnabled ? "enabled" : "disabled"} successfully`);
      } else {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle app status");
    },
  });
}
```

### Step 6: Create Pages and Components

#### Main Page (Server Component)

**File**: `src/app/[locale]/dashboard/apps/page.tsx`

```tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { AppsClient } from "./apps-client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";

export default async function AppsPage() {
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
          <p className="text-muted-foreground">Manage your third-party app integrations</p>
        </div>

        {appContext?.activeOrgId && (
          <HasAnyRoleServer
            checks={[
              { role: "org_owner", scope: "org", id: appContext.activeOrgId },
              { role: "org_admin", scope: "org", id: appContext.activeOrgId },
            ]}
          >
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add App
            </Button>
          </HasAnyRoleServer>
        )}
      </div>

      <AppsClient />
    </div>
  );
}
```

#### Client Component

**File**: `src/app/[locale]/dashboard/apps/apps-client.tsx`

```tsx
"use client";

import { useApps, useToggleAppStatus } from "@/lib/hooks/queries/apps-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export function AppsClient() {
  const { data: apps, isLoading, error } = useApps();
  const toggleStatus = useToggleAppStatus();

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
      <div className="text-center py-8 text-destructive">Error loading apps: {error.message}</div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No apps found. Click "Add App" to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => (
        <Card key={app.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {app.icon_url && (
                  <img src={app.icon_url} alt={app.name} className="w-10 h-10 rounded" />
                )}
                <div>
                  <CardTitle>{app.name}</CardTitle>
                  <CardDescription>{app.category}</CardDescription>
                </div>
              </div>
              <Switch
                checked={app.is_enabled}
                onCheckedChange={(checked) =>
                  toggleStatus.mutate({ appId: app.id, isEnabled: checked })
                }
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{app.description}</p>
            <div className="flex items-center gap-2">
              <Badge variant={app.status === "active" ? "default" : "secondary"}>
                {app.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Step 7: Create Module Configuration

**File**: `src/modules/apps/config.ts`

```typescript
import { ModuleConfig } from "@/lib/types/module";

export async function getAppsModule(): Promise<ModuleConfig> {
  return {
    id: "apps",
    slug: "apps",
    title: "modules.apps.title",
    icon: "AppWindow",
    description: "modules.apps.description",
    color: "#8b5cf6",
    items: [
      {
        id: "apps-overview",
        label: "modules.apps.items.overview",
        path: "/dashboard/apps",
        icon: "Grid",
      },
      {
        id: "apps-settings",
        label: "modules.apps.items.settings",
        path: "/dashboard/apps/settings",
        icon: "Settings",
      },
    ],
    widgets: [],
  };
}
```

### Step 8: Register Module

**File**: `src/modules/index.ts`

```typescript
import { getAppsModule } from "./apps/config";

export async function getAllModules(activeOrgId?: string) {
  const modules = await Promise.all([
    getHomeModule(),
    getWarehouseModule(),
    getTeamsModule(),
    getOrganizationModule(),
    getAppsModule(), // ← Add your new module
  ]);

  return modules;
}
```

## Summary

You've now created a complete feature module following the SSR-first architecture:

1. ✅ **Database**: Tables with RLS policies for security
2. ✅ **Schema**: Zod validation for type-safe inputs
3. ✅ **Service**: Business logic with database operations
4. ✅ **Actions**: Server actions for client-server communication
5. ✅ **Hooks**: React Query hooks for caching and refetching
6. ✅ **UI**: Server and client components with proper separation
7. ✅ **Module**: Configuration and registration

## Next Steps

- [Extending Services](./09-extending-services.md) - Add more methods to your service
- [Adding Endpoints](./10-adding-endpoints.md) - Quick reference for CRUD operations
- [Security Patterns](./13-security-patterns.md) - Multi-tenant security implementation
