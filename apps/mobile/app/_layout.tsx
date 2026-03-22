import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthProvider } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Root layout — mounts AuthProvider around the entire navigation tree.
 *
 * Route groups:
 *   (auth)  — unauthenticated screens (sign-in)
 *   (app)   — authenticated shell (tabs + future screens)
 *
 * Auth routing is handled by each group's own _layout.tsx using useAuth().
 * This root layout is intentionally thin: theme + session provider only.
 */
export const unstable_settings = {
  anchor: "(app)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", headerShown: true, title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
