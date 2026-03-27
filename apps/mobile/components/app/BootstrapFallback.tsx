import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BootstrapFallbackVariant = "no-org" | "forbidden" | "error";

interface Props {
  variant: BootstrapFallbackVariant;
  /** Error message displayed in the "error" variant. Ignored for other variants. */
  message?: string;
  /** Called when the retry button is pressed. Required in the "error" variant. */
  onRetry?: () => void;
  /** Called when the sign-out button is pressed. */
  onSignOut: () => void;
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY: Record<
  BootstrapFallbackVariant,
  { heading: string; body: string; action: "retry" | "signout" }
> = {
  "no-org": {
    heading: "Brak kontekstu organizacji",
    body: "Twoje konto nie jest powiązane z żadną organizacją. Skontaktuj się z administratorem.",
    action: "signout",
  },
  forbidden: {
    heading: "Brak dostępu",
    body: "Twoje konto nie ma uprawnień do tej organizacji.",
    action: "signout",
  },
  error: {
    heading: "Nie udało się załadować",
    body: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
    action: "retry",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen fallback rendered by AppProvider for non-resolved bootstrap states:
 *   "no-org"    → user is authenticated but has no org membership in their JWT
 *   "forbidden" → 403 / RLS denied access to the org
 *   "error"     → unexpected server / network failure
 *
 * Uses the app brand color, Polish copy, SafeAreaView, and respects dark mode —
 * consistent with all other screens in the app.
 */
export function BootstrapFallback({ variant, message, onRetry, onSignOut }: Props) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const c = Colors[colorScheme];
  const copy = COPY[variant];

  const bodyText = variant === "error" && message ? message : copy.body;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <View style={styles.inner}>
        <Text style={[styles.heading, { color: c.text }]}>{copy.heading}</Text>
        <Text style={[styles.body, { color: c.textMuted }]}>{bodyText}</Text>

        {copy.action === "retry" ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: Brand.primary }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Spróbuj ponownie"
          >
            <Text style={styles.buttonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: Brand.primary }]}
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Wyloguj się"
          >
            <Text style={styles.buttonText}>Wyloguj się</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  inner: {
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
    marginBottom: 28,
  },
  button: {
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
