import { Redirect, Stack } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";

import { AppProvider } from "@/contexts/app-context";
import { useAuth } from "@/contexts/auth-context";
import { createMobileQueryClient } from "@/lib/query-client";

/**
 * Authenticated app route group layout.
 *
 * Bootstrap states handled here:
 *   "bootstrapping"   → show spinner (session restoration in progress)
 *   "unauthenticated" → redirect to /(auth)/welcome
 *   authenticated     → mount QueryClientProvider + AppProvider, render children
 *
 * QueryClientProvider is placed here (inside the authenticated tree) rather
 * than at the root layout. This means the React Query cache is created fresh
 * on each sign-in and automatically destroyed when the user signs out —
 * React unmounts the (app) tree, taking the QueryClientProvider and its entire
 * cache with it. No explicit cache-clearing code is required in the sign-out
 * path; org-scoped and user-scoped data cannot leak across sessions.
 *
 * useMemo prevents a new QueryClient from being created on every render while
 * keeping the instance scoped to the lifetime of this layout component.
 */
export default function AppLayout() {
  const { session, bootstrapping } = useAuth();
  const queryClient = useMemo(() => createMobileQueryClient(), []);

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
    <QueryClientProvider client={queryClient}>
      <AppProvider session={session}>
        {/*
         * Stack navigator for the authenticated app shell.
         *
         * Screens:
         *   (tabs) — the launcher + diagnostics tab navigator (initial screen)
         *   organization — Organization module; pushed from launcher tile tap
         *
         * Using Stack (not Slot) ensures that navigating from a tab screen to
         * a module screen creates a proper stack entry: the module screen slides
         * on top of the tab screen, the tab bar disappears, and pressing back
         * returns to the launcher tab. Slot does not create a navigator and
         * cannot guarantee this drill-down behavior.
         */}
        <Stack screenOptions={{ headerShown: false }} />
      </AppProvider>
    </QueryClientProvider>
  );
}
