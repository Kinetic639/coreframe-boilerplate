import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAccountProfileQuery } from "@/hooks/queries/account/use-account-profile-query";
import { useUpdateAccountProfileMutation } from "@/hooks/mutations/account/use-update-account-profile-mutation";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Field ────────────────────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  disabled,
  scheme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  disabled: boolean;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: c.border, color: c.text },
          disabled && { opacity: 0.5 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditAccountScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];

  const { appState } = useAppContext();
  const profileResult = useAccountProfileQuery(appState.userId);
  const mutation = useUpdateAccountProfileMutation(appState.userId);

  // ── Form state ──────────────────────────────────────────────────────────────

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");

  // One-time initialization from query data.
  // useRef guard prevents later refetches or cache invalidations from
  // overwriting field values that the user is actively editing.
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (profileResult.kind !== "data") return;
    const p = profileResult.data;
    setFirstName(p.firstName ?? "");
    setLastName(p.lastName ?? "");
    setDisplayName(p.displayName ?? "");
    initialized.current = true;
  }, [profileResult]);

  // ── isDirty ─────────────────────────────────────────────────────────────────

  const isDirty =
    profileResult.kind === "data" &&
    (firstName !== (profileResult.data.firstName ?? "") ||
      lastName !== (profileResult.data.lastName ?? "") ||
      displayName !== (profileResult.data.displayName ?? ""));

  // ── Navigate back after success ─────────────────────────────────────────────

  useEffect(() => {
    if (mutation.isSuccess) {
      router.back();
    }
  }, [mutation.isSuccess, router]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    mutation.mutate({
      firstName: firstName || null,
      lastName: lastName || null,
      displayName: displayName || null,
    });
  };

  const isPending = mutation.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={c.background}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Wróć"
          disabled={isPending}
        >
          <Ionicons name="chevron-back" size={22} color={isPending ? c.textMuted : c.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Edytuj profil</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          accessibilityLabel="Zapisz"
          disabled={!isDirty || isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={c.tint} />
          ) : (
            <Text style={[styles.saveText, { color: c.tint }, !isDirty && { opacity: 0.4 }]}>
              Zapisz
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Loading state ── */}
          {profileResult.kind === "loading" && (
            <Text style={[styles.stateText, { color: c.textMuted }]}>Ładowanie…</Text>
          )}

          {/* ── Error / forbidden state (treat forbidden as generic error) ── */}
          {(profileResult.kind === "error" || profileResult.kind === "forbidden") && (
            <Text style={[styles.stateText, { color: c.textMuted }]}>
              {profileResult.kind === "error"
                ? profileResult.message
                : "Błąd ładowania danych konta"}
            </Text>
          )}

          {/* ── Form (rendered once kind reaches "data"; useRef guard prevents re-init) ── */}
          {profileResult.kind === "data" && (
            <>
              <FormField
                label="Imię"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Twoje imię"
                disabled={isPending}
                scheme={colorScheme}
              />
              <FormField
                label="Nazwisko"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Twoje nazwisko"
                disabled={isPending}
                scheme={colorScheme}
              />
              <FormField
                label="Nazwa wyświetlana"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="np. Jan K."
                disabled={isPending}
                scheme={colorScheme}
              />

              {/* ── Mutation error ── */}
              {mutation.isError && <Text style={styles.errorText}>{mutation.error.message}</Text>}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1 },
  saveButton: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 52, alignItems: "flex-end" },
  saveText: { fontSize: 16, fontWeight: "600" },
  scrollContent: { padding: 16 },
  fieldWrap: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  stateText: { fontSize: 14, textAlign: "center", marginTop: 40 },
  errorText: { fontSize: 14, color: "#EF4444", marginTop: 4, marginBottom: 4 },
  bottomSpacer: { height: 32 },
});
