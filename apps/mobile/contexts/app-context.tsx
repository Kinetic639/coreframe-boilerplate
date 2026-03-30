import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import { AuthService } from "@repo/auth";
import type { TokenRole } from "@repo/contracts/auth";
import { BRANCHES_VIEW_ANY, BRANCHES_VIEW_UPDATE_ANY } from "@repo/contracts/permissions";
import type { PermissionSnapshot } from "@repo/contracts/permissions";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";
import { resolveActiveBranch } from "@repo/domain/branch";

import { mobileSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { loadBootstrapData } from "@/lib/loaders/bootstrap-loader";
import { loadBranchPermissionsData } from "@/lib/loaders/branch-permissions-loader";
import { BootstrapFallback } from "@/components/app/BootstrapFallback";
import { Colors } from "@/constants/theme";

// ─── Bootstrap State ──────────────────────────────────────────────────────────

/**
 * Post-authentication bootstrap state for the authenticated app shell.
 *
 * Lifecycle (happy path):
 *   "resolving" → "resolved"
 *
 * Failure paths:
 *   "resolving" → "invalid-session"  (401 / expired token — auto sign-out)
 *   "resolving" → "forbidden"        (403 / RLS denied — show access-denied UI)
 *   "resolving" → "error"            (unexpected failure — retry available)
 *
 * Key semantic rule:
 *   "resolved" with appState.entitlements === null means the org has no
 *   subscription row in organization_entitlements. This is a valid resolved
 *   state, NOT a failure. Do not conflate it with "error" or "forbidden".
 */
export type AppBootstrapState =
  | "resolving" // Backend load in progress; show loading indicator
  | "resolved" // Backend queries succeeded; permissions + entitlements loaded
  | "authenticated-unresolved" // Authenticated but no org-scoped JWT role found; no backend call made
  | "forbidden" // 403 / RLS denied — authenticated but not org-authorized
  | "invalid-session" // 401 / token expired — auto sign-out in progress
  | "error"; // Unexpected server/network error — retry available

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  /** Supabase user UUID */
  userId: string;
  /** User email from session */
  email: string;
  /** All roles decoded from the JWT access token via @repo/auth AuthService */
  roles: TokenRole[];
  /**
   * Active org UUID — first org-scoped JWT role.
   * Null if the user has no org memberships in their JWT.
   * When null, bootstrapState is "authenticated-unresolved" and no backend
   * call is made. permissions and entitlements remain null.
   */
  activeOrgId: string | null;
  /** JWT roles scoped to activeOrgId (org scope only). Empty when activeOrgId is null. */
  orgRoles: TokenRole[];
  /**
   * Active branch UUID — initialized per bootstrap cycle from:
   *   1. user_preferences.default_branch_id (if it is in accessibleBranchIds)
   *   2. else the first ID in accessibleBranchIds
   *   3. else null (user has no accessible branches)
   *
   * Updated at runtime by switchBranch(). Cleared and re-initialized on every
   * bootstrap cycle (JWT refresh, retryBootstrap).
   *
   * This is real React state — not derived from JWT. accessibleBranchIds is
   * the authoritative set of branches the user may switch to; this field is
   * the currently active selection within that set.
   * accessibleBranchIds may come from a wildcard permission (BRANCHES_VIEW_ANY
   * or BRANCHES_VIEW_UPDATE_ANY) or from JWT branch-scoped roles.
   */
  activeBranchId: string | null;
  /**
   * Raw branch-scoped JWT roles (not filtered to activeBranchId).
   * This is raw JWT data only — it is NOT the source of truth for which
   * branches the user can access. accessibleBranchIds is authoritative.
   * Used only for the explicit-role path when no wildcard permission is held.
   * Empty when the user has no branch-scoped JWT roles.
   */
  branchRoles: TokenRole[];
  /**
   * Branch IDs the user can switch to. Source-of-truth for switchBranch validation.
   *
   * Computed at bootstrap resolution time from the permission snapshot:
   *   BRANCHES_VIEW_ANY or BRANCHES_VIEW_UPDATE_ANY → all org branch IDs (wildcard path)
   *   Neither wildcard permission                    → branch-scoped JWT role IDs (explicit-role path)
   *
   * Empty during bootstrap resolution and when the user has no accessible branches.
   */
  accessibleBranchIds: string[];
  /**
   * Org-scope permission snapshot loaded from user_effective_permissions.
   * Non-null when bootstrapState === "resolved" (allow may be empty).
   * Null in all other bootstrap states.
   *
   * Use checkPermission() from @repo/domain/permissions for UI gating.
   * This snapshot is NOT authoritative — server-side RLS is the source of truth.
   */
  permissions: PermissionSnapshot | null;
  /**
   * Branch-scope permission snapshot for activeBranchId.
   * Loaded by a dedicated branch-reload effect whenever activeBranchId changes.
   * Null when activeBranchId is null (no branch context), or while the
   * branch-reload query is in flight.
   *
   * NEVER merged with `permissions` (org-scope). Consumers must check the
   * correct snapshot for their context:
   *   org-level gates    → checkPermission(appState.permissions, SLUG)
   *   branch-level gates → checkPermission(appState.branchPermissions, SLUG)
   */
  branchPermissions: PermissionSnapshot | null;
  /**
   * Org entitlement snapshot from organization_entitlements.
   * null when bootstrapState !== "resolved", OR when no subscription row exists.
   *
   * null within "resolved" = free-tier / no plan row. This is semantically
   * distinct from a load failure ("error", "forbidden", "invalid-session").
   */
  entitlements: OrganizationEntitlements | null;
  /**
   * Display name from organization_profiles.name.
   * Non-null when bootstrapState === "resolved" and a profile row exists.
   * null when the org has no profile row yet, or when not yet resolved.
   */
  orgName: string | null;
  /** Secondary display name from organization_profiles.name_2. null when not set. */
  orgName2: string | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  bootstrapState: AppBootstrapState;
  appState: AppState;
  /** Trigger a fresh backend load (e.g. after a transient network error). */
  retryBootstrap: () => void;
  /**
   * Switch the active branch for the current session.
   *
   * Immediately updates activeBranchId in local state and clears
   * branchPermissions (which reloads asynchronously via the branch-reload
   * effect). The state update is optimistic — it is never rolled back.
   *
   * Persists the selection to user_preferences.default_branch_id as a
   * best-effort write. If the write fails, the switch remains active for
   * the current session (state is NOT reverted), Alert.alert is shown
   * to inform the user, and the preference will not survive app restart.
   *
   * Guard: if branchId is not in accessibleBranchIds, this is a no-op.
   */
  switchBranch: (branchId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * AppProvider manages the full post-authentication bootstrap lifecycle.
 *
 * Phase 1 (sync): derives userId, email, roles, activeOrgId, branchRoles from
 *   the JWT access token via @repo/auth AuthService. No I/O.
 *
 * Phase 2 (async): loads org-scoped permissions, entitlements, org profile, and
 *   branch preference from the backend via loadBootstrapData. On resolution,
 *   computes accessibleBranchIds from the permission snapshot and initializes
 *   activeBranchId from the saved preference validated against accessibleBranchIds.
 *
 * Phase 3 (reactive): a branch-reload effect independently loads branchPermissions
 *   whenever activeBranchId changes (from bootstrap init or switchBranch).
 *
 * Render gates:
 * - "authenticated-unresolved"      → no-org screen + sign-out button
 * - "resolving" / "invalid-session" → spinner (sign-out propagates asynchronously)
 * - "forbidden"                     → access-denied screen + sign-out button
 * - "error"                         → error screen + retry button
 * - "resolved"                      → AppContext.Provider wrapping children
 *
 * Screens rendered as children always run with bootstrapState === "resolved"
 * and may assume appState.permissions is a non-null PermissionSnapshot.
 *
 * Must be mounted inside AuthProvider (calls useAuth() for signOut access).
 */
export function AppProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const { signOut } = useAuth();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const c = Colors[scheme];

  // ── Phase 1: Sync JWT derivation ──────────────────────────────────────────
  const jwtDerived = useMemo(() => {
    const roles = AuthService.getUserRoles(session.access_token);

    // Org context
    const orgRoles = roles.filter((r) => r.scope === "org");
    const firstOrgRole = orgRoles[0];
    const activeOrgId = firstOrgRole ? (firstOrgRole.org_id ?? firstOrgRole.scope_id) : null;

    // Branch context — raw branch-scoped roles from JWT.
    // Used only for the explicit-role path in the bootstrap resolved handler.
    // Do NOT use AuthService.getUserBranches(roles, activeOrgId): for target-format
    // tokens, org_id is null on branch-scoped roles, making that filter always empty.
    // Instead, mirror the same direct-filter pattern used for org context above.
    const branchRoles = roles.filter((r) => r.scope === "branch");

    return {
      userId: session.user.id,
      email: session.user.email ?? "",
      roles,
      activeOrgId,
      orgRoles: activeOrgId
        ? orgRoles.filter((r) => r.org_id === activeOrgId || r.scope_id === activeOrgId)
        : [],
      branchRoles,
      accessToken: session.access_token,
    };
  }, [session.access_token, session.user.id, session.user.email]);

  // ── Phase 2: Async bootstrap state ────────────────────────────────────────
  const [bootstrapState, setBootstrapState] = useState<AppBootstrapState>("resolving");
  const [permissions, setPermissions] = useState<PermissionSnapshot | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  /**
   * Branch IDs the user can switch to. Set once per bootstrap cycle.
   *
   * Two paths:
   *   BRANCHES_VIEW_ANY or BRANCHES_VIEW_UPDATE_ANY → all org branch IDs (from bootstrap Query 5)
   *   Neither wildcard permission                   → branch-scoped JWT role IDs
   *
   * Stored as state (not a useMemo) because the correct value depends on the
   * permission snapshot, which is only known after the async bootstrap resolves.
   * [] during bootstrap resolution; populated in the resolved handler.
   */
  const [accessibleBranchIds, setAccessibleBranchIds] = useState<string[]>([]);
  const [branchPermissions, setBranchPermissions] = useState<PermissionSnapshot | null>(null);
  const [entitlements, setEntitlements] = useState<OrganizationEntitlements | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgName2, setOrgName2] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Incrementing retryKey re-triggers the load without requiring userId/orgId to change.
  const [retryKey, setRetryKey] = useState(0);

  const retryBootstrap = useCallback(() => {
    setBootstrapState("resolving");
    setRetryKey((k) => k + 1);
  }, []);

  // ── Bootstrap effect: loads org-scope data and initializes activeBranchId ─
  useEffect(() => {
    const { userId, activeOrgId } = jwtDerived;

    // No org context — user is authenticated but has no org-scoped JWT roles.
    // This is "authenticated-unresolved": distinct from "resolved" (which requires
    // a successful backend fetch), "forbidden" (RLS denial), and "error".
    // No backend calls are made; permissions and entitlements stay null.
    if (!activeOrgId) {
      setBootstrapState("authenticated-unresolved");
      return;
    }

    let cancelled = false;

    // Clear all bootstrap-derived state at the start of every new load cycle.
    // This ensures stale data from a previous resolved state never survive a
    // failed, forbidden, or retrying bootstrap transition.
    setBootstrapState("resolving");
    setErrorMessage(null);
    setPermissions(null);
    setActiveBranchId(null);
    setAccessibleBranchIds([]);
    setBranchPermissions(null);
    setEntitlements(null);
    setOrgName(null);
    setOrgName2(null);

    loadBootstrapData(mobileSupabase, userId, activeOrgId)
      .then((result) => {
        if (cancelled) return;

        if (result.kind === "resolved") {
          setPermissions(result.permissions);

          // Compute accessible branch IDs from the permission snapshot + bootstrap data.
          //
          // Wildcard path (BRANCHES_VIEW_ANY or BRANCHES_VIEW_UPDATE_ANY):
          //   User holds a wildcard org-scope permission granting access to all
          //   non-deleted org branches. allOrgBranchIds (from bootstrap Query 5)
          //   is used directly. If the branches query soft-failed, allOrgBranchIds
          //   is [] — the user sees no branch context for this session, recoverable
          //   on next app launch.
          //
          // Explicit-role path:
          //   Neither wildcard permission is held. accessibleBranchIds is derived
          //   from branch-scoped JWT roles only.
          const hasBranchesViewAny =
            result.permissions.allow.includes(BRANCHES_VIEW_ANY) ||
            result.permissions.allow.includes(BRANCHES_VIEW_UPDATE_ANY);
          const accessibleIds: string[] = hasBranchesViewAny
            ? result.allOrgBranchIds
            : jwtDerived.branchRoles
                .map((r) => r.branch_id ?? r.scope_id)
                .filter((id): id is string => id !== null);

          setAccessibleBranchIds(accessibleIds);

          // Resolve activeBranchId from saved preference against the final accessible set.
          // resolvePreference: savedBranchId (if in accessibleIds) → first accessibleId → null
          setActiveBranchId(resolveActiveBranch(result.savedBranchId, accessibleIds));
          // result.entitlements may be null — intentional. null = free-tier / no plan row.
          setEntitlements(result.entitlements);
          setOrgName(result.orgName);
          setOrgName2(result.orgName2);
          setBootstrapState("resolved");
        } else if (result.kind === "invalid-session") {
          setBootstrapState("invalid-session");
        } else if (result.kind === "forbidden") {
          setBootstrapState("forbidden");
        } else {
          setErrorMessage(result.message);
          setBootstrapState("error");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "An unexpected error occurred";
        setErrorMessage(msg);
        setBootstrapState("error");
      });

    return () => {
      cancelled = true;
    };
    // retryKey triggers a fresh load without requiring userId/activeOrgId/accessToken
    // to change (manual retry path). accessToken ensures a silent token refresh
    // (same user, same org, new JWT) triggers a fresh permission load.
    // activeBranchId is NOT in this dep array — it is state set BY this effect,
    // not a trigger for it. Branch permission reloads are handled by the
    // dedicated branch-reload effect below.
  }, [jwtDerived.userId, jwtDerived.activeOrgId, jwtDerived.accessToken, retryKey]);

  // ── Branch-reload effect: loads branch-scope permissions ──────────────────
  // Fires whenever activeBranchId changes:
  //   - After bootstrap resolves and setActiveBranchId is called
  //   - After switchBranch updates activeBranchId
  //   - When activeBranchId is cleared to null (at start of bootstrap cycle)
  //
  // Org-scope permissions (from loadBootstrapData) are NOT reloaded on branch
  // switch — they are branch-independent and already in state.
  useEffect(() => {
    const { userId, activeOrgId } = jwtDerived;

    if (!userId || !activeOrgId || !activeBranchId) {
      setBranchPermissions(null);
      return;
    }

    let cancelled = false;

    loadBranchPermissionsData(mobileSupabase, userId, activeOrgId, activeBranchId).then(
      (result) => {
        if (cancelled) return;
        // On forbidden/invalid-session/error: set null rather than crashing.
        // The session-level auth layer handles 401 independently via onAuthStateChange.
        setBranchPermissions(result.kind === "resolved" ? result.branchPermissions : null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [jwtDerived.userId, jwtDerived.activeOrgId, activeBranchId]);

  // Auto sign-out when the session token is expired or revoked.
  // signOut() → session becomes null → _layout.tsx redirects to welcome.
  useEffect(() => {
    if (bootstrapState === "invalid-session") {
      signOut().catch(() => {
        // Non-fatal: AuthContext cleans up session state even if the RPC fails.
      });
    }
  }, [bootstrapState, signOut]);

  // ── switchBranch ──────────────────────────────────────────────────────────
  const switchBranch = useCallback(
    (branchId: string) => {
      // Guard: only switch to branches the user is authorized for in this JWT.
      if (!accessibleBranchIds.includes(branchId)) return;

      // Clear stale branch permissions immediately so screens don't show
      // permissions from the previous branch while the reload is in flight.
      setBranchPermissions(null);

      // Update activeBranchId — triggers the branch-reload effect on next render.
      setActiveBranchId(branchId);

      // Persist preference so the selection survives app restart.
      // The switch is already live (optimistic). If the write fails, the switch
      // remains active for this session but will not be restored on next launch.
      mobileSupabase
        .from("user_preferences")
        .update({ default_branch_id: branchId })
        .eq("user_id", jwtDerived.userId)
        .then(({ error }: { error: unknown }) => {
          if (error) {
            if (__DEV__) {
              console.warn("[switchBranch] Preference write failed:", error);
            }
            Alert.alert(
              "Uwaga",
              "Zmiana oddziału jest aktywna, ale nie udało się jej zapisać. Przy następnym uruchomieniu aplikacji powróci poprzedni oddział.",
              [{ text: "OK" }]
            );
          }
        });
    },
    [accessibleBranchIds, jwtDerived.userId]
  );

  // ── Context value (all hooks above; conditional returns follow) ───────────
  const appState: AppState = useMemo(
    () => ({
      userId: jwtDerived.userId,
      email: jwtDerived.email,
      roles: jwtDerived.roles,
      activeOrgId: jwtDerived.activeOrgId,
      orgRoles: jwtDerived.orgRoles,
      activeBranchId,
      branchRoles: jwtDerived.branchRoles,
      accessibleBranchIds,
      permissions,
      branchPermissions,
      entitlements,
      orgName,
      orgName2,
    }),
    [
      jwtDerived,
      activeBranchId,
      accessibleBranchIds,
      permissions,
      branchPermissions,
      entitlements,
      orgName,
      orgName2,
    ]
  );

  const value = useMemo<AppContextValue>(
    () => ({ bootstrapState, appState, retryBootstrap, switchBranch }),
    [bootstrapState, appState, retryBootstrap, switchBranch]
  );

  // ── Render gates ──────────────────────────────────────────────────────────
  // Only "resolved" renders children inside AppContext.Provider.

  if (bootstrapState === "authenticated-unresolved") {
    return <BootstrapFallback variant="no-org" onSignOut={signOut} />;
  }

  if (bootstrapState === "resolving" || bootstrapState === "invalid-session") {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: c.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={c.tint} />
      </SafeAreaView>
    );
  }

  if (bootstrapState === "forbidden") {
    return <BootstrapFallback variant="forbidden" onSignOut={signOut} />;
  }

  if (bootstrapState === "error") {
    return (
      <BootstrapFallback
        variant="error"
        message={errorMessage ?? undefined}
        onRetry={retryBootstrap}
        onSignOut={signOut}
      />
    );
  }

  // bootstrapState === "resolved"
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the resolved app context. Only callable from components mounted
 * inside AppProvider. Since AppProvider only renders children when
 * bootstrapState === "resolved", consumers may assume permissions is non-null.
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
