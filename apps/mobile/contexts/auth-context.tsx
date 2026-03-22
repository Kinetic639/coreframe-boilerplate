import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { mobileSupabase } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /**
   * Current Supabase session, or null if unauthenticated.
   * Populated from secure storage on startup and kept in sync via
   * the onAuthStateChange listener.
   */
  session: Session | null;
  /**
   * True while the initial session restoration from secure storage is
   * in progress. Consumers must treat this as "bootstrapping" and show
   * a loading state instead of redirecting.
   */
  bootstrapping: boolean;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // Restore persisted session from expo-secure-store on startup.
    // This is async; keep bootstrapping=true until it resolves so
    // route layouts don't redirect before the session is known.
    mobileSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setBootstrapping(false);
    });

    // Keep session in sync across token refreshes, sign-in, and sign-out.
    const {
      data: { subscription },
    } = mobileSupabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await mobileSupabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, bootstrapping, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
