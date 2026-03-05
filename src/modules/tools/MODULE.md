# Module Passport: Tools

**Module ID:** `tools`
**Module Slug:** `tools`
**Status:** ✅ Active
**Plan-gated:** ❌ — Always available; not in `subscription_plans.enabled_modules` or `organization_entitlements.enabled_modules`. No entitlement check is performed in the layout or anywhere else.
**Color Theme:** `#f59e0b` (Amber)

---

## Overview

The Tools module gives every org member access to a personal catalog of productivity tools and integrations. Users can browse the global catalog, enable/disable individual tools, and pin favourites for quick access. All state is per-user (`user_enabled_tools` table); the catalog itself is global and managed only by admins via direct DB access.

---

## Routes

| Route                     | File                                               | Description                                      |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `/dashboard/tools`        | `src/app/[locale]/dashboard/tools/page.tsx`        | My Tools — lists user's enabled tools            |
| `/dashboard/tools/all`    | `src/app/[locale]/dashboard/tools/all/page.tsx`    | Full catalog with search/filter + enable toggles |
| `/dashboard/tools/[slug]` | `src/app/[locale]/dashboard/tools/[slug]/page.tsx` | Tool detail — enable/disable/pin                 |

All routes are registered in `src/i18n/routing.ts`:

- `/dashboard/tools` → EN: `/dashboard/tools` / PL: `/dashboard/narzedzia`
- `/dashboard/tools/all` → EN: `/dashboard/tools/all` / PL: `/dashboard/narzedzia/wszystkie`
- `/dashboard/tools/[slug]` → EN: `/dashboard/tools/[slug]` / PL: `/dashboard/narzedzia/[slug]`

---

## Permissions

| Permission     | Constant                  | Granted To                | Purpose                                  |
| -------------- | ------------------------- | ------------------------- | ---------------------------------------- |
| `tools.read`   | `PERMISSION_TOOLS_READ`   | `org_owner`, `org_member` | View catalog, tool detail, my-tools list |
| `tools.manage` | `PERMISSION_TOOLS_MANAGE` | `org_owner`, `org_member` | Enable/disable/pin/settings mutations    |

Constants defined in: `src/lib/constants/permissions.ts`

**Security layers:**

1. **Layout SSR gate** (`tools/layout.tsx`): checks `PERMISSION_TOOLS_READ` via `checkPermission`; redirects to `/dashboard/access-denied?reason=tools_read_required` on failure.
2. **Server actions** (`src/app/actions/tools/index.ts`): all read actions check `PERMISSION_TOOLS_READ`; all mutations check `PERMISSION_TOOLS_MANAGE`. Never trust client-supplied `user_id`.
3. **RLS** (see below): ultimate enforcement layer.

---

## Database Tables

### `public.tools_catalog`

| Column                      | Type                   | Notes                                                              |
| --------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `slug`                      | `text PK`              | Unique tool identifier (e.g. `qr-generator`)                       |
| `name`                      | `text NOT NULL`        | Human-readable name                                                |
| `description`               | `text`                 | Short description                                                  |
| `category`                  | `text`                 | Category (productivity, data, analytics, integrations, compliance) |
| `icon_key`                  | `text`                 | Icon hint for UI                                                   |
| `is_active`                 | `boolean DEFAULT true` | Soft-disable without deleting                                      |
| `sort_order`                | `int DEFAULT 0`        | Display order                                                      |
| `metadata`                  | `jsonb DEFAULT '{}'`   | Arbitrary tool config                                              |
| `created_at` / `updated_at` | `timestamptz`          | Timestamps                                                         |

**RLS:**

- `ENABLE ROW LEVEL SECURITY`
- `SELECT` allowed for all `authenticated` users (`USING (true)`)
- No INSERT/UPDATE/DELETE policies (app users cannot write; admin-only via direct DB)

### `public.user_enabled_tools`

| Column                      | Type                                                             | Notes                  |
| --------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `id`                        | `uuid PK DEFAULT gen_random_uuid()`                              | Row identifier         |
| `user_id`                   | `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`      | Owner                  |
| `tool_slug`                 | `text NOT NULL REFERENCES tools_catalog(slug) ON DELETE CASCADE` | FK                     |
| `enabled`                   | `boolean NOT NULL DEFAULT true`                                  | Enabled state          |
| `pinned`                    | `boolean NOT NULL DEFAULT false`                                 | Pinned state           |
| `settings`                  | `jsonb NOT NULL DEFAULT '{}'`                                    | Per-tool user settings |
| `created_at` / `updated_at` | `timestamptz`                                                    | Timestamps             |

**Indexes:**

- `user_enabled_tools_user_enabled_idx` on `(user_id, enabled)`
- `user_enabled_tools_tool_slug_idx` on `(tool_slug)`
- Unique constraint on `(user_id, tool_slug)`

**RLS (fail-closed, mirrors USING/WITH CHECK):**

- `SELECT USING (user_id = auth.uid())`
- `INSERT WITH CHECK (user_id = auth.uid())`
- `UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
- `DELETE USING (user_id = auth.uid())`

---

## Migration

**File:** `supabase/migrations/20260305120000_tools_module.sql`

Contains:

1. `tools_catalog` table + RLS
2. `user_enabled_tools` table + indexes + RLS
3. Seed data (6 example tools)
4. `tools.read` and `tools.manage` permissions inserted into `public.permissions`
5. `role_permissions` mappings for `org_owner` and `org_member`

---

## Key Files

| Layer                | File                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| Module config        | `src/modules/tools/config.ts`                                                           |
| Module registration  | `src/modules/index.ts`                                                                  |
| Sidebar entry        | `src/lib/sidebar/v2/registry.ts`                                                        |
| Permission constants | `src/lib/constants/permissions.ts` (`PERMISSION_TOOLS_READ`, `PERMISSION_TOOLS_MANAGE`) |
| Module constant      | `src/lib/constants/modules.ts` (`MODULE_TOOLS`)                                         |
| Zod validations      | `src/lib/validations/tools.ts`                                                          |
| Service layer        | `src/server/services/tools.service.ts`                                                  |
| Server actions       | `src/app/actions/tools/index.ts`                                                        |
| React Query hooks    | `src/hooks/queries/tools/index.ts`                                                      |
| Layout (SSR gate)    | `src/app/[locale]/dashboard/tools/layout.tsx`                                           |
| My Tools page        | `src/app/[locale]/dashboard/tools/page.tsx`                                             |
| Catalog page         | `src/app/[locale]/dashboard/tools/all/page.tsx`                                         |
| Detail page          | `src/app/[locale]/dashboard/tools/[slug]/page.tsx`                                      |
| Loading              | `src/app/[locale]/dashboard/tools/loading.tsx`                                          |
| Error                | `src/app/[locale]/dashboard/tools/error.tsx`                                            |
| My Tools client      | `src/app/[locale]/dashboard/tools/_components/tools-my-tools-client.tsx`                |
| Catalog client       | `src/app/[locale]/dashboard/tools/_components/tools-catalog-client.tsx`                 |
| Detail client        | `src/app/[locale]/dashboard/tools/_components/tool-detail-client.tsx`                   |
| i18n keys            | `messages/en.json` → `modules.tools.*`                                                  |
| i18n keys (PL)       | `messages/pl.json` → `modules.tools.*`                                                  |
| DB migration         | `supabase/migrations/20260305120000_tools_module.sql`                                   |
| Tests                | `src/server/services/__tests__/tools.service.test.ts`                                   |

---

## Sidebar Registration

**Registry:** `src/lib/sidebar/v2/registry.ts`
**Position:** First item in `MAIN_NAV_ITEMS` (before Home)
**Icon:** `tools` (maps to `Wrench` from lucide-react in icon-map)
**No `requiresModules` gate** — Tools is always visible to any user with `tools.read`.

```typescript
{
  id: "tools",
  title: "Tools",
  titleKey: "modules.tools.titleSidebar",
  iconKey: "tools",
  href: "/dashboard/tools",
  match: { startsWith: "/dashboard/tools" },
  visibility: {
    requiresPermissions: [PERMISSION_TOOLS_READ],
  },
}
```

---

## i18n Namespace

All UI strings are under `modules.tools.*` in both `messages/en.json` and `messages/pl.json`.

Key sub-namespaces:

- `modules.tools.pages.myTools.*` — My Tools page strings
- `modules.tools.pages.catalog.*` — Catalog page strings
- `modules.tools.pages.detail.*` — Detail page strings
- `modules.tools.actions.*` — Button labels
- `modules.tools.toasts.*` — Toast messages
- `modules.tools.loading.*` — Loading states
- `modules.tools.errors.*` — Error boundary strings
- `modules.tools.aria.*` — Accessibility labels

---

## Architecture Notes

- **No plan gating**: Tools module does not check `entitlements.requireModuleOrRedirect()`. The layout only calls `loadDashboardContextV2()` and `checkPermission(... PERMISSION_TOOLS_READ)`.
- **User-scoped catalog state**: The catalog (`tools_catalog`) is global; the user's personal state (`user_enabled_tools`) is user-scoped via RLS.
- **Upsert pattern**: `setToolEnabled` and `setToolPinned` use upsert with `onConflict: "user_id,tool_slug"` to handle first-time interactions without requiring a prior row.
- **SSR-first**: All pages are Server Components by default; client interactivity is delegated to `*-client.tsx` components that receive SSR initial data.
- **Primitives reuse**: UI uses `LoadingSkeleton`, `Badge`, `SearchForm` from `src/components/v2/`.
- **No org-scoped data**: `user_enabled_tools` stores only `user_id` (not `org_id`), so tool state is consistent across org switches. The layout still requires an org context (via `loadDashboardContextV2`) for permission validation.
