import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/auth-context";

/**
 * Auth route group layout.
 *
 * Bootstrap states handled here:
 *   "bootstrapping"   → show spinner (session restoration in progress)
 *   "unauthenticated" → render Slot (sign-in screen)
 *   authenticated     → redirect to (app) (already signed in)
 */
export default function AuthLayout() {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}
