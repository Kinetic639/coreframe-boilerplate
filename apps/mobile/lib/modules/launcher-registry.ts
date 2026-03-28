import { hasModuleAccess } from "@repo/domain/entitlements";
import { checkPermission } from "@repo/domain/permissions";
import type { PermissionSnapshot } from "@repo/contracts/permissions";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@repo/contracts/modules";
import { MODULE_ORGANIZATION_MANAGEMENT_ACCESS } from "@repo/contracts/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Contextual data available at launcher render time.
 * Sourced from AppContext — no network calls required.
 */
export interface AccessContext {
  permissions: PermissionSnapshot | null;
  entitlements: OrganizationEntitlements | null;
}

/**
 * Definition of a single module entry in the mobile launcher.
 *
 * - `implemented`    — false excludes the module regardless of access.
 *                      Set false for modules without a mobile screen yet.
 * - `showInLauncher` — false excludes utility modules (tools, admin) that are
 *                      navigable elsewhere but should not appear as primary tiles.
 * - `accessCheck`    — pure function; no hooks, no async, no side effects.
 *                      Returns true only when the user has earned access.
 */
export interface LauncherModule {
  slug: string;
  title: string;
  icon: string; // MaterialCommunityIcons name
  route: string; // Expo Router push target (full group path)
  implemented: boolean;
  showInLauncher: boolean;
  accessCheck: (ctx: AccessContext) => boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * App-local module registry.
 *
 * Add future modules here with `implemented: false` until their screens exist.
 * The launcher will not show them until `implemented` is flipped to true.
 *
 * IMPORTANT: Do not add web-sidebar concepts here (nested children, active
 * matching, coming_soon status). This registry is flat and launcher-specific.
 */
const LAUNCHER_MODULES: LauncherModule[] = [
  {
    slug: MODULE_ORGANIZATION_MANAGEMENT,
    title: "Organizacja",
    icon: "account-group",
    route: "/(app)/organization",
    implemented: true,
    showInLauncher: true,
    /**
     * Gate mirrors the web sidebar:
     *   1. entitlement: org-management must be in enabled_modules
     *      (fail-closed when entitlements === null — matches web resolver)
     *   2. permission: module.organization-management.access must be granted
     */
    accessCheck: ({ permissions, entitlements }) =>
      hasModuleAccess(entitlements, MODULE_ORGANIZATION_MANAGEMENT) &&
      permissions !== null &&
      checkPermission(permissions, MODULE_ORGANIZATION_MANAGEMENT_ACCESS),
  },
  // ─── Future modules (not yet implemented) ─────────────────────────────────
  // {
  //   slug: MODULE_WAREHOUSE,
  //   title: "Magazyn",
  //   icon: "warehouse",
  //   route: "/(app)/warehouse",
  //   implemented: false,   ← keeps it hidden until mobile data layer exists
  //   showInLauncher: true,
  //   accessCheck: ({ entitlements }) =>
  //     hasModuleAccess(entitlements, MODULE_WAREHOUSE),
  // },
];

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Returns the subset of LAUNCHER_MODULES that should be shown to this user.
 *
 * A module is visible if and only if ALL three conditions hold:
 *   1. implemented === true
 *   2. showInLauncher === true
 *   3. accessCheck(ctx) === true
 *
 * This is a pure, synchronous function — safe to call directly in render.
 * No hooks, no async, no side effects.
 */
export function getVisibleModules(ctx: AccessContext): LauncherModule[] {
  return LAUNCHER_MODULES.filter((m) => m.implemented && m.showInLauncher && m.accessCheck(ctx));
}
