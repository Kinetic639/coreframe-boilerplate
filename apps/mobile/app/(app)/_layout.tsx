import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { AppProvider } from "@/contexts/app-context";
import { useAuth } from "@/contexts/auth-context";

/**
 * Authenticated app route group layout.
 *
 * Bootstrap states handled here:
 *   "bootstrapping"   → show spinner (session restoration in progress)
 *   "unauthenticated" → redirect to /(auth)/welcome
 *   authenticated     → mount AppProvider, render child routes (tabs shell)
 *
 * AppProvider derives org/role context from the JWT access token.
 * Phase 5 is auth-ready and role-aware, but not yet permission/entitlement-
 * enforced. permissions and entitlements remain null until Phase 6.
 */
export default function AppLayout() {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <AppProvider session={session}>
      <Slot />
    </AppProvider>
  );
}
