import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { mobileSupabase } from "@/lib/supabase/client";

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SignInScreen() {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const c = Colors[colorScheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const { error } = await mobileSupabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }
    // On success, AuthContext.onAuthStateChange fires → session is set →
    // (auth)/_layout.tsx Redirect to /(app) triggers automatically.
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {/* ── Brand ── */}
          <View style={styles.brandRow}>
            <View style={[styles.brandDot, { backgroundColor: Brand.primary }]} />
            <Text style={[styles.brandAmbra, { color: Brand.primary }]}>Ambra</Text>
            <Text style={[styles.brandSystem, { color: c.textMuted }]}>system</Text>
          </View>

          <Text style={[styles.title, { color: c.text }]}>Zaloguj się</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>Wprowadź dane swojego konta</Text>

          {/* ── Fields ── */}
          <View style={styles.fields}>
            <Text style={[styles.label, { color: c.textMuted }]}>Adres e-mail</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="jan@firma.pl"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={[styles.label, { color: c.textMuted }]}>Hasło</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={c.textMuted}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={handleSignIn}
              returnKeyType="go"
            />
          </View>

          {/* ── Error ── */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
              <Text style={[styles.errorText, { color: "#DC2626" }]}>{error}</Text>
            </View>
          )}

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Brand.primary },
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Zaloguj się</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 32,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 2,
  },
  brandAmbra: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  brandSystem: {
    fontSize: 22,
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
  },
  fields: {
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
