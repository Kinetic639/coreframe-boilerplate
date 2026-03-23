import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/auth-context";

/**
 * Auth route group layout — the single decision point for the unauthenticated flow.
 *
 * Bootstrap states:
 *   bootstrapping  →  spinner (session restoration in progress)
 *   session exists →  redirect to /(app)/(tabs)
 *   !session       →  <Slot /> — welcome or sign-in render based on navigation
 *
 * Unauthenticated entry always lands on /(auth)/welcome because (app)/_layout.tsx
 * redirects to /(auth)/welcome when no session is present. Navigation from
 * welcome to sign-in is imperative (CTA button). No segment-based redirect
 * logic is needed — the layout is not responsible for choosing between welcome
 * and sign-in.
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
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Slot />;
}
