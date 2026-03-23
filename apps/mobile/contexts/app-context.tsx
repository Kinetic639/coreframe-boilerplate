import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { AuthService } from "@repo/auth";
import type { TokenRole } from "@repo/contracts/auth";
import type { PermissionSnapshot } from "@repo/contracts/permissions";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";

import { mobileSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { loadBootstrapData } from "@/lib/loaders/bootstrap-loader";

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
   * Org-scope permission snapshot loaded from user_effective_permissions.
   * Non-null when bootstrapState === "resolved" (allow may be empty).
   * Null in all other bootstrap states.
   *
   * Use checkPermission() from @repo/domain/permissions for UI gating.
   * This snapshot is NOT authoritative — server-side RLS is the source of truth.
   */
  permissions: PermissionSnapshot | null;
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
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  bootstrapState: AppBootstrapState;
  appState: AppState;
  /** Trigger a fresh backend load (e.g. after a transient network error). */
  retryBootstrap: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * AppProvider manages the full post-authentication bootstrap lifecycle.
 *
 * Phase 1 (sync): derives userId, email, roles, activeOrgId from the JWT
 *   access token via @repo/auth AuthService. No I/O.
 *
 * Phase 2 (async): loads org-scoped permissions and entitlements from the
 *   backend via loadBootstrapData. Transitions bootstrapState accordingly.
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

  // ── Phase 1: Sync JWT derivation ──────────────────────────────────────────
  const jwtDerived = useMemo(() => {
    const roles = AuthService.getUserRoles(session.access_token);
    const orgRoles = roles.filter((r) => r.scope === "org");
    const firstOrgRole = orgRoles[0];
    const activeOrgId = firstOrgRole ? (firstOrgRole.org_id ?? firstOrgRole.scope_id) : null;

    return {
      userId: session.user.id,
      email: session.user.email ?? "",
      roles,
      activeOrgId,
      orgRoles: activeOrgId
        ? orgRoles.filter((r) => r.org_id === activeOrgId || r.scope_id === activeOrgId)
        : [],
    };
  }, [session.access_token, session.user.id, session.user.email]);

  // ── Phase 2: Async bootstrap state ────────────────────────────────────────
  const [bootstrapState, setBootstrapState] = useState<AppBootstrapState>("resolving");
  const [permissions, setPermissions] = useState<PermissionSnapshot | null>(null);
  const [entitlements, setEntitlements] = useState<OrganizationEntitlements | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Incrementing retryKey re-triggers the load without requiring userId/orgId to change.
  const [retryKey, setRetryKey] = useState(0);

  const retryBootstrap = useCallback(() => {
    setBootstrapState("resolving");
    setRetryKey((k) => k + 1);
  }, []);

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
    setBootstrapState("resolving");
    setErrorMessage(null);

    loadBootstrapData(mobileSupabase, userId, activeOrgId)
      .then((result) => {
        if (cancelled) return;

        if (result.kind === "resolved") {
          setPermissions(result.permissions);
          // result.entitlements may be null — that is intentional and correct.
          // null here means no subscription row exists, not that loading failed.
          setEntitlements(result.entitlements);
          // result.orgName may be null — org has no profile row yet.
          setOrgName(result.orgName);
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
    // retryKey is intentionally included: it triggers a fresh load without
    // requiring userId/activeOrgId to change (manual retry path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtDerived.userId, jwtDerived.activeOrgId, retryKey]);

  // Auto sign-out when the session token is expired or revoked.
  // signOut() → session becomes null → _layout.tsx redirects to welcome.
  useEffect(() => {
    if (bootstrapState === "invalid-session") {
      signOut().catch(() => {
        // Non-fatal: AuthContext cleans up session state even if the RPC fails.
      });
    }
  }, [bootstrapState, signOut]);

  // ── Context value (all hooks above; conditional returns follow) ───────────
  const appState: AppState = useMemo(
    () => ({
      userId: jwtDerived.userId,
      email: jwtDerived.email,
      roles: jwtDerived.roles,
      activeOrgId: jwtDerived.activeOrgId,
      orgRoles: jwtDerived.orgRoles,
      permissions,
      entitlements,
      orgName,
    }),
    [jwtDerived, permissions, entitlements, orgName]
  );

  const value = useMemo<AppContextValue>(
    () => ({ bootstrapState, appState, retryBootstrap }),
    [bootstrapState, appState, retryBootstrap]
  );

  // ── Render gates ──────────────────────────────────────────────────────────
  // Only "resolved" renders children inside AppContext.Provider.

  if (bootstrapState === "authenticated-unresolved") {
    // User is authenticated but has no org-scoped JWT roles.
    // No backend call was attempted. Permissions and entitlements remain null.
    // Sign-out is the only available action (the user must be added to an org
    // and re-authenticate to receive org-scoped roles in their JWT).
    return (
      <View style={styles.fill}>
        <Text style={styles.heading}>No Organisation Context</Text>
        <Text style={styles.body}>
          Your account is not associated with any organisation. Please contact your administrator.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => signOut()}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (bootstrapState === "resolving" || bootstrapState === "invalid-session") {
    return (
      <View style={styles.fill}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (bootstrapState === "forbidden") {
    return (
      <View style={styles.fill}>
        <Text style={styles.heading}>Access Denied</Text>
        <Text style={styles.body}>Your account is not authorized to access this organization.</Text>
        <TouchableOpacity style={styles.button} onPress={() => signOut()}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (bootstrapState === "error") {
    return (
      <View style={styles.fill}>
        <Text style={styles.heading}>Failed to Load</Text>
        <Text style={styles.body}>
          {errorMessage ?? "An unexpected error occurred. Please try again."}
        </Text>
        <TouchableOpacity style={styles.button} onPress={retryBootstrap}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  heading: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
