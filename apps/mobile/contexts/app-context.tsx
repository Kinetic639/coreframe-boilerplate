import { createContext, useContext, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthService } from "@repo/auth";
import type { TokenRole } from "@repo/contracts/auth";
import type { PermissionSnapshot } from "@repo/contracts/permissions";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";

// Phase 6: import { checkPermission } from "@repo/domain/permissions";
// checkPermission will become the active guard once permissions are loaded
// from the backend. In Phase 5, permissions remain null — do not call it as
// an enforcement mechanism.

// ─── Bootstrap State ─────────────────────────────────────────────────────────

/**
 * Post-authentication bootstrap state.
 *
 * This enum covers only the authenticated sub-states. The full lifecycle
 * (including session restoration and unauthenticated state) is managed by
 * AuthContext and consumed by route layouts.
 *
 *   "bootstrapping"             → AuthContext.bootstrapping === true
 *   "unauthenticated"           → AuthContext.session === null
 *   "authenticated-unresolved"  → session exists, but no org-scoped roles
 *                                 found in JWT (user has no org membership
 *                                 or only branch-scoped roles)
 *   "authenticated-provisional" → session exists, at least one org-scoped
 *                                 role found; activeOrgId is set to the
 *                                 first org (provisional — no backend fetch)
 *
 * Phase 5 is auth-ready and role-aware, but NOT permission/entitlement-
 * enforced. permissions and entitlements remain null until Phase 6 loads
 * them from the backend.
 */
export type AppBootstrapState = "authenticated-unresolved" | "authenticated-provisional";

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  /** Supabase user UUID */
  userId: string;
  /** User email from session */
  email: string;
  /**
   * All roles decoded from the JWT access token via @repo/auth AuthService.
   * Includes both org-scoped and branch-scoped roles.
   */
  roles: TokenRole[];
  /**
   * Provisional active org ID — first org from org-scoped JWT roles.
   * Null when no org-scoped roles are present (unresolved state).
   * Org switching and persistence are Phase 6 concerns.
   */
  activeOrgId: string | null;
  /**
   * JWT roles scoped to activeOrgId (org scope only).
   * Empty when activeOrgId is null.
   */
  orgRoles: TokenRole[];
  /**
   * Phase 6: permission snapshot loaded from the backend.
   * Null in Phase 5 — do not use as an enforcement gate.
   * checkPermission() from @repo/domain is available for Phase 6.
   */
  permissions: PermissionSnapshot | null;
  /**
   * Phase 6: entitlement snapshot loaded from the backend.
   * Null in Phase 5.
   */
  entitlements: OrganizationEntitlements | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppContextValue {
  bootstrapState: AppBootstrapState;
  appState: AppState;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * AppProvider derives org/role context from the current JWT access token.
 *
 * Must be mounted inside the authenticated route group, after the session
 * guard has confirmed a non-null session. Accepts session as a prop so it
 * re-derives state on token refresh without an additional useEffect.
 *
 * Org derivation rules:
 *   - Only org-scoped roles (scope === "org") are used to determine activeOrgId.
 *   - Branch-scoped roles do NOT imply an org context in Phase 5.
 *   - If no org-scoped roles exist, bootstrapState is "authenticated-unresolved"
 *     and activeOrgId is null. The app must handle this state explicitly.
 */
export function AppProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const value = useMemo<AppContextValue>(() => {
    // Decode JWT roles using the platform-neutral @repo/auth AuthService.
    // AuthService.getUserRoles handles target and legacy token shapes.
    const roles = AuthService.getUserRoles(session.access_token);

    // Org context derives exclusively from org-scoped roles.
    // Branch-only users have no provisional org context in Phase 5.
    const orgRoles = roles.filter((r) => r.scope === "org");
    const firstOrgRole = orgRoles[0];
    const activeOrgId = firstOrgRole ? (firstOrgRole.org_id ?? firstOrgRole.scope_id) : null;

    const appState: AppState = {
      userId: session.user.id,
      email: session.user.email ?? "",
      roles,
      activeOrgId,
      orgRoles: activeOrgId
        ? orgRoles.filter((r) => r.org_id === activeOrgId || r.scope_id === activeOrgId)
        : [],
      permissions: null, // Phase 6: load from backend
      entitlements: null, // Phase 6: load from backend
    };

    const bootstrapState: AppBootstrapState =
      activeOrgId !== null ? "authenticated-provisional" : "authenticated-unresolved";

    return { bootstrapState, appState };
  }, [session.access_token, session.user.id, session.user.email]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
