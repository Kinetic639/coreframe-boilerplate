/**
 * Sidebar V2 Type Definitions
 *
 * Pure, JSON-serializable types for SSR sidebar model.
 * NO React components, NO client-only imports.
 */

/**
 * Visibility rules for nav items (ALL must be satisfied to show item)
 */
export interface SidebarVisibilityRules {
  /** ALL of these permissions must be satisfied (AND) */
  requiresPermissions?: string[];

  /** AT LEAST ONE of these permissions must be satisfied (OR) */
  requiresAnyPermissions?: string[];

  /** ALL of these modules must be enabled (AND) */
  requiresModules?: string[];

  /** AT LEAST ONE of these modules must be enabled (OR) */
  requiresAnyModules?: string[];
}

/**
 * Valid icon keys for sidebar items
 * Maps to lucide-react icon components on client side
 */
export type IconKey =
  | "home"
  | "warehouse"
  | "users"
  | "settings"
  | "analytics"
  | "documentation"
  | "chat"
  | "calendar"
  | "products"
  | "locations"
  | "support"
  | "development"
  | "profile"
  | "preferences";

/**
 * Active route matching rules (strict discriminated union)
 * Prevents invalid combinations like both exact and startsWith
 */
export type SidebarMatchRules =
  | { exact: string; startsWith?: never }
  | { startsWith: string; exact?: never };

/**
 * Reason an item is disabled (for UX feedback)
 */
export type SidebarDisabledReason = "permission" | "entitlement" | "coming_soon";

/**
 * Base sidebar item (recursive structure)
 */
export interface SidebarItem {
  /** Stable unique ID (used for keys, tracking) */
  id: string;

  /**
   * Display title — fallback when titleKey is absent.
   * Always present so the model is renderable without next-intl.
   */
  title: string;

  /**
   * Optional next-intl translation key for the display label.
   * When present, client-side rendering resolves the label via useTranslations().
   * When absent, `title` is used directly.
   * Must NOT be used server-side (translation is a client-side concern).
   */
  titleKey?: string;

  /** Icon key (maps to lucide icon name) */
  iconKey: IconKey;

  /** Href for navigation (optional for groups) */
  href?: string;

  /** Child items (for groups/nested nav) */
  children?: SidebarItem[];

  /** Active route matching rules */
  match?: SidebarMatchRules;

  /** Visibility rules (if missing, item is always visible) */
  visibility?: SidebarVisibilityRules;

  /** Why item is disabled (optional UX hint) */
  disabledReason?: SidebarDisabledReason;

  /** Badge text (e.g., "New", "Beta", count) */
  badge?: string;

  /**
   * IMPORTANT: Active state is NOT in this model.
   * Active highlighting is a CLIENT-SIDE concern computed using router pathname.
   * Server-side model only contains VISIBILITY data (permissions/entitlements).
   */
}

/**
 * Sidebar model (root structure)
 *
 * CRITICAL: This type must be DETERMINISTIC.
 * - Same inputs → identical output (every time)
 * - No timestamps, no random IDs, no side effects
 * - Required for: snapshot tests, memoization, hydration consistency
 */
export interface SidebarModel {
  /** Main navigation sections */
  main: SidebarItem[];

  /** Footer navigation (settings, help, etc.) - always present, may be empty array */
  footer: SidebarItem[];
}

/**
 * Resolver input (everything needed to compute VISIBILITY)
 *
 * IMPORTANT: This input contains ONLY data needed for VISIBILITY decisions.
 * - Permissions → what user can access
 * - Entitlements → what org has enabled
 * - Context → org/branch for scoping
 *
 * It does NOT contain:
 * - pathname (active state is CLIENT-SIDE concern)
 * - UI preferences (collapse state is CLIENT-SIDE concern)
 * - Any routing-related state
 */
export interface SidebarResolverInput {
  /** Current locale (for future i18n if needed) */
  locale: string;

  /** User permission snapshot (allow/deny) — non-nullable, defaults to { allow: [], deny: [] } */
  permissionSnapshot: {
    allow: string[];
    deny: string[];
  };

  /** Organization entitlements (nullable for fail-closed) */
  entitlements: {
    enabled_modules: string[];
    enabled_contexts: string[];
    features: Record<string, boolean | number | string>;
    limits: Record<string, number>;
  } | null;

  /** App context (org/branch scope) */
  context: {
    activeOrgId: string | null;
    activeBranchId: string | null;
    userModules?: Array<{ id: string; slug: string; label: string }>;
  };
}
