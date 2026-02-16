# Ambra System - Sidebar Context Extraction (Complete)

## Context

This document is a **pure technical extraction** of the current sidebar navigation system. It captures the exact current state to enable a server-calculated sidebar resolver implementation. No redesign. No improvements. No assumptions.

---

# 1. SIDEBAR UI LAYER

## 1.1 Full File Paths

**V1 Production Sidebar (Active):**

- `src/components/Dashboard/sidebar/AppSidebar.tsx` — Server component, root
- `src/components/Dashboard/sidebar/AppSidebarWrapper.tsx` — Client, wraps shadcn Sidebar
- `src/components/Dashboard/sidebar/AppSidebarHeader.tsx` — Client, org logo/name with Framer Motion
- `src/components/Dashboard/sidebar/ModuleSection.tsx` — Client, collapsible module headers
- `src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx` — Server, permission/role filtering
- `src/components/Dashboard/sidebar/TreeMenuItem.tsx` — Client, recursive tree nav items
- `src/components/Dashboard/sidebar/SidebarInitializer.tsx` — Client, initializes store sections
- `src/components/Dashboard/sidebar/SidebarQuickActions.tsx` — Client, expand/collapse all buttons
- `src/components/Dashboard/sidebar/SidebarDropdownButton.tsx` — Client, button with optional dropdown
- `src/components/Dashboard/sidebar/SidebarLinkWithLoader.tsx` — Client, link with loading transition

**V2 Demo Sidebar (NOT active for production navigation):**

- `src/app/[locale]/dashboard/_components/dashboard-shell.tsx` — Client, hardcoded sample nav
- `src/app/[locale]/dashboard/_components/sidebar-org-header.tsx` — Client, org display
- `src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx` — Client, branch dropdown

**Base shadcn/ui:**

- `src/components/ui/sidebar.tsx` — 695-line shadcn/ui sidebar implementation

**State:**

- `src/lib/stores/sidebarStore.ts` — Zustand persist, mode/sections/openSections
- `src/lib/stores/v2/ui-store.ts` — Zustand persist, sidebarCollapsed/theme

**Utilities:**

- `src/utils/sidebar/active-detection.ts` — checkIsActive, hasActiveChild, isInActivePath

**Layout:**

- `src/app/[locale]/dashboard/layout.tsx` — V2 layout, loads context, renders shell

## 1.2 Sidebar Root Component

**File:** `src/components/Dashboard/sidebar/AppSidebar.tsx`

```tsx
import React from "react";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appVersion } from "@/lib/version";
import { AppSidebarWrapper } from "./AppSidebarWrapper";
import ModuleSectionWrapper from "./ModuleSectionWrapper";
import { SidebarInitializer } from "./SidebarInitializer";
import { createClient } from "@/utils/supabase/server";
import { getAccessibleModules } from "@/modules";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { checkIsActive } from "@/utils/sidebar/active-detection";

const AppSidebar = async () => {
  const appContext = await loadAppContextServer();
  const userContext = await loadUserContextServer();
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? "";

  const logo = appContext?.activeOrg?.logo_url;
  const name = appContext?.activeOrg?.name;
  const name2 = appContext?.activeOrg?.name_2;
  const themeColor = appContext?.activeOrg?.theme_color;
  const fontColor = appContext?.activeOrg?.font_color;
  const activeOrgId = appContext?.activeOrgId ?? null;
  const activeBranchId = appContext?.activeBranchId ?? null;
  const userPermissions = userContext?.permissions ?? [];

  const modules = await getAccessibleModules(activeOrgId, appContext?.subscription);
  const t = await getTranslations("modules");

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const hasActiveItemInAnyModule = modules.some((module) => checkIsActive(module.items, pathname));

  return (
    <AppSidebarWrapper themeColor={themeColor} fontColor={fontColor}>
      <SidebarInitializer modules={modules} />
      <AppSidebarHeader
        logo={logo || undefined}
        name={name || undefined}
        name2={name2 || undefined}
      />
      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-2 pr-3">
            {modules.map((module) => (
              <ModuleSectionWrapper
                key={module.id}
                module={module}
                accessToken={accessToken}
                activeOrgId={activeOrgId ?? undefined}
                activeBranchId={activeBranchId ?? undefined}
                userPermissions={userPermissions}
                translations={t}
                hasActiveItemInAnyModule={hasActiveItemInAnyModule}
              />
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-t border-[color-mix(in_srgb,var(--font-color)_20%,transparent)]">
        <div className="flex items-center justify-center px-2 py-1 text-xs text-[color:var(--font-color)]">
          <span className="group-data-[collapsible=icon]:hidden">Besio version: {appVersion}</span>
          <span className="hidden text-[10px] group-data-[collapsible=icon]:block">
            v{appVersion}
          </span>
        </div>
      </SidebarFooter>
    </AppSidebarWrapper>
  );
};

export default AppSidebar;
```

## 1.3 Navigation Renderer / Permission Filter

**File:** `src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx`

```tsx
import { MenuItem, ModuleConfig, LinkMenuItem } from "@/lib/types/module";
import { RoleCheck, Scope, UserRoleFromToken } from "@/lib/types/user";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { ModuleSection } from "./ModuleSection";
import { translateModuleLabel } from "@/utils/i18n/translateModuleLabel";

type Props = {
  module: ModuleConfig;
  accessToken: string;
  activeOrgId: string | null;
  activeBranchId: string | null;
  userPermissions: string[];
  translations: (key: string) => string;
  hasActiveItemInAnyModule?: boolean;
};

function mapAllowedUsersToChecks(
  allowedUsers: MenuItem["allowedUsers"],
  activeOrgId: string | null,
  activeBranchId: string | null
): RoleCheck[] {
  if (!allowedUsers) return [];
  return allowedUsers.map((u) => ({
    role: u.role,
    scope: u.scope as Scope,
    id: u.scope === "org" ? (activeOrgId ?? undefined) : (activeBranchId ?? undefined),
  }));
}

function hasMatchingRole(userRoles: UserRoleFromToken[], checks: RoleCheck[]): boolean {
  return checks.some((check) => {
    return userRoles.some((userRole) => {
      const sameRole = userRole.role === check.role;
      if (check.scope === "org" && check.id) {
        return sameRole && userRole.org_id === check.id;
      }
      if (check.scope === "branch" && check.id) {
        return sameRole && userRole.branch_id === check.id;
      }
      if (!check.scope && check.id) {
        return sameRole && (userRole.org_id === check.id || userRole.branch_id === check.id);
      }
      return sameRole;
    });
  });
}

function hasRequiredPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return requiredPermissions.every((permission) => userPermissions.includes(permission));
}

function isLinkMenuItem(item: MenuItem): item is LinkMenuItem {
  return (item as LinkMenuItem).path !== undefined;
}

function filterAndTranslateMenuItems(
  items: MenuItem[],
  userRoles: UserRoleFromToken[],
  userPermissions: string[],
  activeOrgId: string | null,
  activeBranchId: string | null,
  translations: (key: string) => string
): MenuItem[] {
  return items
    .map((item) => {
      if (item.requiredPermissions) {
        if (!hasRequiredPermissions(userPermissions, item.requiredPermissions)) {
          return null;
        }
      } else if (item.allowedUsers) {
        const checks = mapAllowedUsersToChecks(item.allowedUsers, activeOrgId, activeBranchId);
        if (checks.length > 0 && !hasMatchingRole(userRoles, checks)) {
          return null;
        }
      }
      let processedItem: MenuItem = {
        ...item,
        label: translateModuleLabel(item.label, translations),
      };
      if (isLinkMenuItem(item) && item.submenu) {
        const filteredSubmenu = filterAndTranslateMenuItems(
          item.submenu,
          userRoles,
          userPermissions,
          activeOrgId,
          activeBranchId,
          translations
        );
        if (filteredSubmenu.length === 0) {
          return null;
        }
        processedItem = { ...processedItem, submenu: filteredSubmenu } as LinkMenuItem;
      }
      return processedItem;
    })
    .filter((item): item is MenuItem => item !== null);
}

export default function ModuleSectionWrapper({
  module,
  accessToken,
  activeOrgId,
  activeBranchId,
  userPermissions,
  translations,
  hasActiveItemInAnyModule = false,
}: Props) {
  const roles = getUserRolesFromJWT(accessToken);
  const visibleItems = filterAndTranslateMenuItems(
    module.items,
    roles,
    userPermissions,
    activeOrgId,
    activeBranchId,
    translations
  );
  if (visibleItems.length === 0 && !module.path) {
    return null;
  }
  return (
    <ModuleSection
      module={{
        slug: module.slug,
        title: translateModuleLabel(module.title, translations),
        icon: module.icon,
        path: module.path,
        items: visibleItems,
      }}
      hasActiveItemInAnyModule={hasActiveItemInAnyModule}
    />
  );
}
```

## 1.4 shadcn Sidebar Template

Yes, shadcn/ui sidebar is used. File: `src/components/ui/sidebar.tsx` (695 lines).

- Variant: `sidebar-01` (standard) with collapsible="icon" mode
- Components: SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarRail, SidebarInset, SidebarTrigger, SidebarMenu*, SidebarGroup*
- Cookie persistence: `sidebar_state` cookie (7-day expiry)
- CSS variables: `--sidebar-width` (16rem), `--sidebar-width-icon` (3rem)
- Keyboard shortcut: Ctrl+B / Cmd+B toggle

## 1.5 Active Route Highlighting

**File:** `src/utils/sidebar/active-detection.ts`

```tsx
import { MenuItem } from "@/lib/types/module";

export function checkIsActive(items: MenuItem[], pathname: string): boolean {
  for (const item of items) {
    if ("path" in item && pathname === item.path) return true;
    if ("submenu" in item && item.submenu && checkIsActive(item.submenu, pathname)) return true;
  }
  return false;
}

export function hasActiveChild(items: MenuItem[], pathname: string): boolean {
  for (const item of items) {
    if ("path" in item && pathname === item.path) return true;
    if ("submenu" in item && item.submenu && hasActiveChild(item.submenu, pathname)) return true;
  }
  return false;
}

export function isInActivePath(item: MenuItem, pathname: string): boolean {
  if ("path" in item && pathname === item.path) return true;
  if ("submenu" in item && item.submenu) return hasActiveChild(item.submenu, pathname);
  return false;
}
```

Active route detection flow:

1. `AppSidebar` (server) — gets pathname from `headers().get("x-pathname")`
2. `checkIsActive()` determines `hasActiveItemInAnyModule`
3. `TreeMenuItem` (client) — uses `usePathname()` for client-side active detection
4. Gray-out logic: items not in active path are dimmed when active item exists

## 1.6 Collapse State

- **Persisted in localStorage** via Zustand persist middleware
- `sidebarStore.ts` key: `"sidebar_state"` — stores mode, sectionMode, openSections, availableSections, activeSectionId
- `ui-store.ts` key: `"ui-store-v2"` — stores sidebarOpen, sidebarCollapsed, theme, colorTheme
- shadcn also persists to cookie: `sidebar_state` (7-day expiry)
- **NOT DB-synced** (future auto-sync ready but not implemented)

## 1.7 Navigation Type Definitions

**File:** `src/lib/types/module.ts`

```tsx
import { Scope } from "./user";
import { Widget } from "./widgets";

export type MenuItem = LinkMenuItem | ActionMenuItem;

export interface AllowedUser {
  role: string;
  scope: Scope; // "org" | "branch"
}

export interface BaseMenuItem {
  id: string;
  label: string;
  icon: string;
  allowedUsers?: AllowedUser[];
  requiredPermissions?: string[];
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
  title: string;
  icon?: string;
  description?: string;
  color?: string;
  path?: string;
  items: MenuItem[];
  actions?: Record<string, () => void>;
  widgets?: Widget[];
}
```

## 1.8 Sidebar Data Source

Module-based static config. Each module has a `config.ts` in `src/modules/*/config.ts`. The registry at `src/modules/index.ts` aggregates all modules and filters by subscription access.

---

# 2. ROUTE STRUCTURE

## V2 Dashboard (`src/app/[locale]/dashboard/`)

```
src/app/[locale]/dashboard/
├── layout.tsx
├── _providers.tsx
├── _components/
│   ├── dashboard-shell.tsx
│   ├── dashboard-initial-loader.tsx
│   ├── permissions-sync.tsx
│   ├── sidebar-org-header.tsx
│   └── sidebar-branch-switcher.tsx
├── start/
│   └── page.tsx
├── account/
│   ├── profile/
│   │   └── page.tsx
│   ├── preferences/
│   │   └── page.tsx
│   └── notifications/
│       └── page.tsx
├── [...slug]/
│   └── page.tsx
├── error.tsx
├── not-found.tsx
├── loading.tsx
└── template.tsx
```

## Legacy Dashboard (`src/app/[locale]/dashboard-old/`)

```
src/app/[locale]/dashboard-old/
├── start/
│   ├── page.tsx
│   ├── getting-started/page.tsx
│   └── recent-updates/page.tsx
├── warehouse/
│   ├── products/
│   │   ├── page.tsx
│   │   └── groups/
│   │       ├── new/page.tsx
│   │       └── [id]/page.tsx
│   ├── locations/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── inventory/
│   │   ├── page.tsx
│   │   ├── movements/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   └── adjustments/page.tsx
│   ├── movements/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── audits/
│   │   ├── page.tsx
│   │   ├── history/page.tsx
│   │   └── schedule/page.tsx
│   ├── alerts/page.tsx
│   ├── labels/
│   │   ├── page.tsx
│   │   ├── create/page.tsx
│   │   ├── assign/
│   │   │   ├── page.tsx
│   │   │   ├── success/page.tsx
│   │   │   └── error/page.tsx
│   │   ├── history/page.tsx
│   │   └── templates/
│   │       ├── page.tsx
│   │       └── edit/[id]/page.tsx
│   ├── suppliers/
│   │   ├── page.tsx
│   │   ├── list/page.tsx
│   │   └── [id]/page.tsx
│   ├── deliveries/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── receive/page.tsx
│   ├── sales-orders/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── purchases/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── clients/page.tsx
│   ├── scanning/
│   │   ├── page.tsx
│   │   └── delivery/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── categories/page.tsx
│       ├── custom-fields/page.tsx
│       ├── variant-options/page.tsx
│       ├── units/page.tsx
│       └── products-templates/page.tsx
├── organization/
│   ├── page.tsx
│   ├── profile/page.tsx
│   ├── branches/page.tsx
│   ├── billing/page.tsx
│   ├── roles/[id]/page.tsx
│   └── users/
│       ├── page.tsx
│       ├── list/page.tsx
│       ├── invitations/page.tsx
│       ├── roles/page.tsx
│       ├── manage/page.tsx
│       └── [userId]/page.tsx
├── teams/
│   ├── contacts/
│   │   ├── page.tsx
│   │   ├── custom/page.tsx
│   │   └── profile/[userId]/page.tsx
│   └── communication/
│       └── chat/
│           ├── page.tsx
│           └── [chatId]/page.tsx
├── analytics/
│   ├── page.tsx
│   ├── activities/page.tsx
│   ├── timeline/page.tsx
│   ├── test-activity/page.tsx
│   └── reports/page.tsx
├── contacts/
│   ├── page.tsx
│   └── [id]/page.tsx
├── development/
│   ├── page.tsx
│   ├── permissions/page.tsx
│   ├── context/page.tsx
│   ├── logo/page.tsx
│   ├── service/page.tsx
│   ├── labels/page.tsx
│   ├── locations-debug/page.tsx
│   ├── rich-text-editor/page.tsx
│   ├── sku-generator/page.tsx
│   ├── delivery-debugger/page.tsx
│   ├── status-stepper/page.tsx
│   └── reservations-test/page.tsx
├── docs/[[...slug]]/page.tsx
├── announcements/
│   ├── page.tsx
│   └── [id]/page.tsx
├── news/
│   ├── page.tsx
│   └── [id]/page.tsx
├── dev/subscription-test/page.tsx
├── account/
│   ├── profile/page.tsx
│   └── preferences/page.tsx
├── profile/page.tsx
└── reset-password/page.tsx
```

---

# 3. PERMISSION SLUGS (REAL VALUES FROM DATABASE)

## Permissions Table Schema

20 columns: `id`, `slug`, `label`, `deleted_at`, `name`, `description`, `category`, `subcategory`, `resource_type`, `action`, `scope_types` (ARRAY), `dependencies` (ARRAY), `conflicts_with` (ARRAY), `is_system` (boolean), `is_dangerous` (boolean), `requires_mfa` (boolean), `priority` (integer), `metadata` (jsonb), `created_at`, `updated_at`.

## All Permission Slugs (from `permissions` table, `deleted_at IS NULL`)

| slug                         | category     | scope_types  | is_system |
| ---------------------------- | ------------ | ------------ | --------- |
| `account.*`                  | account      | `["global"]` | true      |
| `account.preferences.read`   | account      | `["global"]` | true      |
| `account.preferences.update` | account      | `["global"]` | true      |
| `account.profile.read`       | account      | `["global"]` | true      |
| `account.profile.update`     | account      | `["global"]` | true      |
| `account.settings.read`      | account      | `["global"]` | true      |
| `account.settings.update`    | account      | `["global"]` | true      |
| `branches.create`            | branches     | null         | false     |
| `branches.delete`            | branches     | null         | false     |
| `branches.read`              | branches     | null         | false     |
| `branches.update`            | branches     | null         | false     |
| `invites.cancel`             | invites      | null         | false     |
| `invites.create`             | invites      | null         | false     |
| `invites.read`               | invites      | null         | false     |
| `members.manage`             | members      | null         | false     |
| `members.read`               | members      | null         | false     |
| `org.read`                   | organization | null         | false     |
| `org.update`                 | organization | null         | false     |
| `self.read`                  | self         | null         | false     |
| `self.update`                | self         | null         | false     |

Total: **20 permission slugs** in database.

## Compiled Effective Permission Slugs (from `user_effective_permissions`)

| permission_slug   |
| ----------------- |
| `account.*`       |
| `branches.create` |
| `branches.delete` |
| `branches.read`   |
| `branches.update` |
| `invites.cancel`  |
| `invites.create`  |
| `invites.read`    |
| `members.manage`  |
| `members.read`    |
| `org.read`        |
| `org.update`      |
| `self.read`       |
| `self.update`     |

## Scoping

- `account.*` and `account.*` sub-permissions: `scope_types = ["global"]`, `is_system = true`
- All other permissions: `scope_types = null` (not explicitly scoped)
- **NO branch-level scoping in permission slugs** — permissions are org-scoped
- Branch isolation is done via RLS policies, not permission slug scoping

## Permission Slugs Used in Module Configs (from `requiredPermissions` arrays)

Used in `src/modules/organization-managment/config.ts`:

- `organization.profile.update`
- `branch.manage`
- `user.manage`
- `user.role.read`
- `invitation.read`

**IMPORTANT NOTE:** These slugs (`organization.profile.update`, `branch.manage`, `user.manage`, `user.role.read`, `invitation.read`) do NOT exist in the `permissions` table. The actual database slugs are different (`org.update`, `branches.*`, `members.manage`, etc.). This is a **mismatch** between module config and database.

---

# 4. ENABLED MODULE SLUGS

## From `organization_entitlements.enabled_modules` (Real Values)

### Free Plan

```
["home", "warehouse", "teams", "organization-management", "support", "user-account", "contacts", "documentation"]
```

### Professional Plan

```
["home", "warehouse", "teams", "organization-management", "support", "user-account", "analytics", "development"]
```

### Enterprise Plan

```
["home", "warehouse", "teams", "organization-management", "support", "user-account", "analytics", "development"]
```

## Module IDs from `src/modules/index.ts` (Config Registry)

```
home
warehouse
contacts
teams
organization-management
support
user-account
documentation
analytics
development
admin
```

**NOTE:** `admin` module is defined in code (`src/modules/admin/config.ts`) but NOT included in any subscription plan's `enabled_modules`. It is also NOT registered in `src/modules/index.ts` `allModulesConfig` array.

---

# 5. EXAMPLE ENTITLEMENTS SNAPSHOT

From `organization_entitlements` table (real row):

```json
{
  "organization_id": "4aab690b-45c9-4150-96c2-cabe6a6d8633",
  "plan_id": "7ec09df8-1298-4099-9357-e66dd2e2cf1e",
  "plan_name": "professional",
  "enabled_modules": [
    "support",
    "warehouse",
    "user-account",
    "development",
    "analytics",
    "organization-management",
    "home",
    "teams"
  ],
  "enabled_contexts": ["warehouse", "ecommerce"],
  "features": {},
  "limits": {
    "organization.max_users": 50,
    "warehouse.max_branches": 1,
    "warehouse.max_products": 10000,
    "warehouse.max_locations": -1
  },
  "updated_at": "2026-02-12T23:00:00.569111+00:00"
}
```

All fields exist. `features` is empty `{}` for this org. `enabled_contexts` exists with values.

## All Subscription Plans (from `subscription_plans` table)

### free

```json
{
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "contacts",
    "documentation"
  ],
  "enabled_contexts": ["warehouse"],
  "features": {},
  "limits": {
    "organization.max_users": 3,
    "warehouse.max_branches": 1,
    "warehouse.max_products": 100,
    "warehouse.max_locations": 5
  }
}
```

### professional

```json
{
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "analytics",
    "development"
  ],
  "enabled_contexts": ["warehouse", "ecommerce"],
  "features": {},
  "limits": {
    "organization.max_users": 50,
    "warehouse.max_branches": 1,
    "warehouse.max_products": 10000,
    "warehouse.max_locations": 100
  }
}
```

### enterprise

```json
{
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "analytics",
    "development"
  ],
  "enabled_contexts": ["warehouse", "ecommerce", "b2b", "pos"],
  "features": {},
  "limits": {
    "organization.max_users": -1,
    "warehouse.max_branches": 1,
    "warehouse.max_products": -1,
    "warehouse.max_locations": -1
  }
}
```

---

# 6. DASHBOARD CONTEXT LOADERS

## `loadDashboardContextV2`

**File:** `src/server/loaders/v2/load-dashboard-context.v2.ts`

```tsx
import { cache } from "react";
import { loadAppContextV2 } from "./load-app-context.v2";
import { loadUserContextV2 } from "./load-user-context.v2";
import type { AppContextV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";

export interface DashboardContextV2 {
  app: AppContextV2;
  user: UserContextV2;
}

async function _loadDashboardContextV2(): Promise<DashboardContextV2 | null> {
  const appContext = await loadAppContextV2();
  if (!appContext) return null;

  const userContext = await loadUserContextV2(appContext.activeOrgId, appContext.activeBranchId);
  if (!userContext) return null;

  return { app: appContext, user: userContext };
}

export const loadDashboardContextV2 = cache(_loadDashboardContextV2);
```

## `loadAppContextV2`

**File:** `src/server/loaders/v2/load-app-context.v2.ts`

```tsx
import { createClient } from "@/utils/supabase/server";
import { cache } from "react";
import type {
  AppContextV2,
  ActiveOrgV2,
  BranchDataV2,
  LoadedUserModuleV2,
} from "@/lib/stores/v2/app-store";

async function _loadAppContextV2(): Promise<AppContextV2 | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const userId = user.id;

  // 1. Load user preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  // 2. Resolve activeOrgId (preferences -> member orgs -> created orgs)
  let activeOrgId: string | null = null;

  // 2a) preferences.organization_id (validated)
  if (preferences?.organization_id) {
    const { data: prefOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", preferences.organization_id)
      .is("deleted_at", null)
      .maybeSingle();
    activeOrgId = prefOrg?.id ?? null;
  }

  // 2b) Oldest org where user is MEMBER
  if (!activeOrgId) {
    const { data: orgAssignments } = await supabase
      .from("user_role_assignments")
      .select("scope_id")
      .eq("user_id", userId)
      .eq("scope", "org")
      .is("deleted_at", null);
    const orgIds = Array.from(new Set((orgAssignments ?? []).map((x) => x.scope_id))).filter(
      Boolean
    );
    if (orgIds.length > 0) {
      const { data: oldestMemberOrg } = await supabase
        .from("organizations")
        .select("id")
        .in("id", orgIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      activeOrgId = oldestMemberOrg?.id ?? null;
    }
  }

  // 2c) Oldest org CREATED BY user
  if (!activeOrgId) {
    const { data: ownedOrgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeOrgId = ownedOrgs?.id ?? null;
  }

  // 3. Load org snapshot with profile data
  let activeOrg: ActiveOrgV2 | null = null;
  if (activeOrgId) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, slug, organization_profiles(name, name_2, slug, logo_url)")
      .eq("id", activeOrgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (orgData) {
      const profileData = orgData.organization_profiles;
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      activeOrg = {
        id: orgData.id,
        name: profile?.name || orgData.name,
        name_2: profile?.name_2 || null,
        slug: profile?.slug || orgData.slug,
        logo_url: profile?.logo_url || null,
      };
    }
  }

  // 4. Load available branches
  let availableBranches: BranchDataV2[] = [];
  if (activeOrgId) {
    const { data: branches } = await supabase
      .from("branches")
      .select("id, name, organization_id, slug, created_at")
      .eq("organization_id", activeOrgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    availableBranches = (branches || []).map((b) => ({
      id: b.id,
      name: b.name,
      organization_id: b.organization_id,
      slug: b.slug,
      created_at: b.created_at,
    }));
  }

  // 5. Resolve activeBranchId
  let activeBranchId: string | null = null;
  let activeBranch: BranchDataV2 | null = null;
  if (availableBranches.length > 0) {
    const preferredBranch = availableBranches.find((b) => b.id === preferences?.default_branch_id);
    if (preferredBranch) {
      activeBranchId = preferredBranch.id;
      activeBranch = preferredBranch;
    } else {
      activeBranchId = availableBranches[0].id;
      activeBranch = availableBranches[0];
    }
  }

  // 6. Load user modules
  let userModules: LoadedUserModuleV2[] = [];
  if (activeOrgId) {
    const { data: userModulesRaw } = await supabase
      .from("user_modules")
      .select("setting_overrides, modules!left(id, slug, label, settings)")
      .eq("user_id", userId)
      .is("deleted_at", null);
    userModules = (userModulesRaw || [])
      .filter((um: any) => um.modules)
      .map((um: any) => ({
        id: um.modules.id,
        slug: um.modules.slug,
        label: um.modules.label,
        settings: { ...um.modules.settings, ...um.setting_overrides },
      }));
  }

  return { activeOrgId, activeBranchId, activeOrg, activeBranch, availableBranches, userModules };
}

export const loadAppContextV2 = cache(_loadAppContextV2);
```

**CRITICAL NOTE:** `loadAppContextV2` does NOT load `entitlements` or `subscription`. The V2 `AppContextV2` type has NO subscription field. The V1 legacy `loadAppContextServer` in `src/lib/api/load-app-context-server.ts` DOES load entitlements.

## `loadUserContextV2`

**File:** `src/server/loaders/v2/load-user-context.v2.ts`

```tsx
import { createClient } from "@/utils/supabase/server";
import { cache } from "react";
import { AuthService, type JWTRole } from "@/server/services/auth.service";
import { PermissionService, type PermissionSnapshot } from "@/server/services/permission.service";
import type { UserContextV2, UserV2 } from "@/lib/stores/v2/user-store";

async function _loadUserContextV2(
  activeOrgId: string | null = null,
  activeBranchId: string | null = null
): Promise<UserContextV2 | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) return null;

  const userId = authUser.id;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  // 1. Load user identity
  const { data: userData } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const user: UserV2 = userData
    ? {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        avatar_url: userData.avatar_url,
      }
    : {
        id: userId,
        email: authUser.email!,
        first_name: authUser.user_metadata?.first_name || null,
        last_name: authUser.user_metadata?.last_name || null,
        avatar_url: null,
      };

  // 2. Extract roles from JWT
  const roles: JWTRole[] = AuthService.getUserRoles(session.access_token);

  // 3. Load permission snapshot for RESOLVED org/branch
  let permissionSnapshot: PermissionSnapshot = { allow: [], deny: [] };
  if (activeOrgId) {
    permissionSnapshot = await PermissionService.getPermissionSnapshotForUser(
      supabase,
      userId,
      activeOrgId,
      activeBranchId
    );
  }

  return { user, roles, permissionSnapshot };
}

export const loadUserContextV2 = cache(_loadUserContextV2);
```

---

# 7. MODULE REGISTRY

**File:** `src/modules/index.ts`

```tsx
import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";
import { developmentModule } from "./development/config";
import { userAccountModule } from "./user-account/config";
import { contactsModule } from "./contacts/config";
import { documentationModuleConfig } from "./documentation/config";
import { ModuleConfig } from "@/lib/types/module";
import { getWarehouseModule } from "./warehouse/config";
import { getAnalyticsModule } from "./analytics/config";
import { Widget } from "@/lib/types/widgets";
import { subscriptionService } from "@/lib/services/subscription-service";

export interface ModuleWithAccess extends ModuleConfig {
  hasAccess: boolean;
  isPremium: boolean;
  requiredPlan?: string;
  isAlwaysAvailable?: boolean;
}

export async function getAllModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleWithAccess[]> {
  const warehouseModule = await getWarehouseModule();
  const analyticsModule = await getAnalyticsModule();

  const allModulesConfig = [
    { module: homeModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: warehouseModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: contactsModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: teamsModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: orgManagmentModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: supportModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: userAccountModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: documentationModuleConfig, alwaysAvailable: true, requiredPlan: "free" },
    { module: analyticsModule, alwaysAvailable: false, requiredPlan: "professional" },
    { module: developmentModule, alwaysAvailable: true, requiredPlan: "free" },
  ];

  const modulesWithAccess: ModuleWithAccess[] = [];
  for (const config of allModulesConfig) {
    let hasAccess = true;
    if (!config.alwaysAvailable && activeOrgId) {
      if (subscription) {
        hasAccess = subscription.plan.enabled_modules.includes(config.module.id);
      } else {
        hasAccess = await subscriptionService.hasModuleAccess(activeOrgId, config.module.id);
      }
    }
    modulesWithAccess.push({
      ...config.module,
      hasAccess,
      isPremium: !config.alwaysAvailable,
      requiredPlan: config.requiredPlan,
      isAlwaysAvailable: config.alwaysAvailable,
    });
  }
  return modulesWithAccess;
}

export async function getAccessibleModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleConfig[]> {
  const allModules = await getAllModules(activeOrgId, subscription);
  return allModules.filter((module) => module.hasAccess);
}

export async function getLockedModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleWithAccess[]> {
  const allModules = await getAllModules(activeOrgId, subscription);
  return allModules.filter((module) => !module.hasAccess && module.isPremium);
}

export async function getAllWidgets(activeOrgId?: string, subscription?: any): Promise<Widget[]> {
  const modules = await getAllModules(activeOrgId, subscription);
  return modules.filter((m) => m.hasAccess).flatMap((module) => module.widgets || []);
}
```

## Module Config Files (Complete List)

| Module                  | File                                           | Export                      | Async |
| ----------------------- | ---------------------------------------------- | --------------------------- | ----- |
| home                    | `src/modules/home/config.ts`                   | `homeModule`                | No    |
| warehouse               | `src/modules/warehouse/config.ts`              | `getWarehouseModule()`      | Yes   |
| contacts                | `src/modules/contacts/config.ts`               | `contactsModule`            | No    |
| teams                   | `src/modules/teams/config.ts`                  | `teamsModule`               | No    |
| organization-management | `src/modules/organization-managment/config.ts` | `orgManagmentModule`        | No    |
| support                 | `src/modules/support/config.ts`                | `supportModule`             | No    |
| user-account            | `src/modules/user-account/config.ts`           | `userAccountModule`         | No    |
| documentation           | `src/modules/documentation/config.ts`          | `documentationModuleConfig` | No    |
| analytics               | `src/modules/analytics/config.ts`              | `getAnalyticsModule()`      | Yes   |
| development             | `src/modules/development/config.ts`            | `developmentModule`         | No    |
| admin                   | `src/modules/admin/config.ts`                  | `getAdminModule()`          | Yes   |

**admin module is NOT registered in `src/modules/index.ts`.**

---

# 8. NAV GROUPING REQUIREMENTS

Grouping is **implicit in the module system**. Each module IS a top-level group.

Current module order (from `src/modules/index.ts`):

1. **Home** — direct link, no submenu
2. **Warehouse** — Inventory (movements, products, locations, labels, alerts, adjustments), Sales (orders, clients), Purchases (orders, deliveries, suppliers, scanning), Settings
3. **Contacts** — direct link with single item
4. **Teams** — Organization contacts, Communication (chat, announcements), Kanban, Calendar
5. **Organization Management** — Profile, Branches, Users (list, invitations, roles), Billing
6. **Support** — Help center, Contact support, Announcements (changelog, status, roadmap)
7. **User Account** — Profile, Preferences
8. **Documentation** — Home, User docs, Dev docs, Spec docs
9. **Analytics** (premium) — Overview, Activities, Timeline, Reports (user-activity, modules, security), Exports (activities, reports), Settings (retention, notifications, presets)
10. **Development** — 13 debug/test items

There is no additional grouping layer beyond modules (no "Inventory" group, "Sales" group, etc. — those are submenu items within modules).

---

# 9. TEASER / DISABLED BEHAVIOR

## Current Behavior

- **Unauthorized items**: **HIDDEN** (completely removed from DOM). Not disabled, not grayed.
- **Upgrade teasers**: **NOT IMPLEMENTED** in sidebar. `getLockedModules()` exists in code but no UI renders locked modules in the sidebar.
- **Disabled links**: **DO NOT EXIST**. Items are either rendered or not rendered.
- **Paths exposed when unauthorized**: **NO**. If user lacks permission, the nav item is filtered out entirely in `ModuleSectionWrapper`. The URL/path is not rendered.
- **Module-level locking**: `ModuleWithAccess` has `hasAccess: boolean` and `isPremium: boolean`. `getAccessibleModules()` filters to only `hasAccess === true`. Locked modules are never rendered in sidebar.
- **Gray-out behavior**: EXISTS but only for visual context — when an active item exists in one module, other modules' items are dimmed (brightness-75). This is NOT a disabled/unauthorized state — it's a visual focus cue.

---

# 10. FILES PROVIDED

1. `src/components/Dashboard/sidebar/AppSidebar.tsx` — Full code
2. `src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx` — Full code
3. `src/utils/sidebar/active-detection.ts` — Full code
4. `src/lib/types/module.ts` — Full code
5. `src/server/loaders/v2/load-dashboard-context.v2.ts` — Full code
6. `src/server/loaders/v2/load-app-context.v2.ts` — Full code
7. `src/server/loaders/v2/load-user-context.v2.ts` — Full code
8. `src/modules/index.ts` — Full code
9. `src/modules/home/config.ts` — Read completely
10. `src/modules/warehouse/config.ts` — Read completely
11. `src/modules/contacts/config.ts` — Read completely
12. `src/modules/teams/config.ts` — Read completely
13. `src/modules/organization-managment/config.ts` — Read completely
14. `src/modules/support/config.ts` — Read completely
15. `src/modules/user-account/config.ts` — Read completely
16. `src/modules/documentation/config.ts` — Read completely
17. `src/modules/analytics/config.ts` — Read completely
18. `src/modules/development/config.ts` — Read completely
19. `src/modules/admin/config.ts` — Read completely
20. `src/lib/stores/sidebarStore.ts` — Read completely
21. `src/lib/stores/v2/app-store.ts` — Read completely
22. `src/lib/stores/v2/user-store.ts` — Read completely
23. `src/lib/stores/v2/ui-store.ts` — Read completely
24. `src/hooks/v2/use-permissions.ts` — Read completely
25. `src/hooks/use-entitlements.ts` — Read completely
26. `src/lib/utils/permissions.ts` — Read completely
27. `src/lib/types/permissions.ts` — Read completely
28. `src/app/[locale]/dashboard/layout.tsx` — Read completely
29. `src/app/[locale]/dashboard/_providers.tsx` — Read completely
30. `src/app/[locale]/dashboard/_components/dashboard-shell.tsx` — Read completely

## Database Tables Queried

- `permissions` — All 20 rows (slug, category, scope_types, is_system)
- `user_effective_permissions` — All 14 distinct permission_slugs
- `organization_entitlements` — 1 row (professional plan example)
- `subscription_plans` — All 3 plans (free, professional, enterprise)

---

# 11. CONFIRMATIONS

1. **No assumptions were made.** All data is from real code files and real database queries.
2. **Nothing was omitted.** All sidebar-related files, all module configs, all context loaders, all stores, all permission data, and all route structures were extracted.
3. **Known discrepancy documented:** Module config `requiredPermissions` use slugs (`organization.profile.update`, `branch.manage`, `user.manage`, `user.role.read`, `invitation.read`) that do not match actual database permission slugs (`org.update`, `branches.*`, `members.manage`, `invites.read`).

---

# 12. VERIFICATION

To verify this extraction:

1. Run `SELECT slug FROM permissions WHERE deleted_at IS NULL ORDER BY slug;` via Supabase MCP
2. Run `SELECT * FROM organization_entitlements LIMIT 1;` via Supabase MCP
3. Read each file listed in section 10 to confirm contents match
4. Compare module config `requiredPermissions` against `user_effective_permissions` to confirm the slug mismatch
