import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Slot } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/auth-context";
import { WELCOME_SEEN_KEY } from "./welcome";

/**
 * Auth route group layout — the single decision point for the unauthenticated flow.
 *
 * Bootstrap states:
 *   bootstrapping || checkingWelcome  →  spinner
 *   session exists                    →  redirect to (app)
 *   !welcomeSeen                      →  redirect to /(auth)/welcome  (first launch)
 *   default (welcomeSeen, no session) →  <Slot /> renders sign-in
 *
 * Loop-safety: the welcome redirect only fires when welcomeSeen is false.
 * Once welcome.tsx sets welcome_seen and navigates to sign-in, this layout
 * re-evaluates with welcomeSeen=true and falls through to <Slot />.
 * No cycle is possible.
 *
 * welcome_seen flag is never reset on sign-out — a returning signed-out user
 * goes directly to sign-in, not back to the welcome screen.
 */
export default function AuthLayout() {
  const { session, bootstrapping } = useAuth();
  const [welcomeSeen, setWelcomeSeen] = useState(false);
  const [checkingWelcome, setCheckingWelcome] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((val) => setWelcomeSeen(val === "true"))
      .finally(() => setCheckingWelcome(false));
  }, []);

  if (bootstrapping || checkingWelcome) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(app)" />;
  }

  if (!welcomeSeen) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Slot />;
}
