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
import { useOrgProfileQuery } from "@/hooks/queries/organization/use-org-profile-query";
import { useUpdateOrgProfileMutation } from "@/hooks/mutations/organization/use-update-org-profile-mutation";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Field ────────────────────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  disabled,
  scheme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
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
          multiline && styles.inputMultiline,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            color: c.text,
          },
          disabled && { opacity: 0.5 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        editable={!disabled}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditOrgProfileScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];

  const { appState } = useAppContext();
  const orgId = appState.activeOrgId ?? "";

  const profileResult = useOrgProfileQuery(orgId || null);
  const mutation = useUpdateOrgProfileMutation(orgId);

  // ── Form state ──────────────────────────────────────────────────────────────

  const [name, setName] = useState("");
  const [name2, setName2] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  // Tracks whether we've seeded the form from the loaded profile.
  // useRef avoids re-initializing on background refetches.
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (profileResult.kind !== "data") return;
    const p = profileResult.data;
    setName(p.name ?? "");
    setName2(p.name_2 ?? "");
    setBio(p.bio ?? "");
    setWebsite(p.website ?? "");
    initialized.current = true;
  }, [profileResult]);

  // ── isDirty ─────────────────────────────────────────────────────────────────

  const isDirty =
    profileResult.kind === "data" &&
    (name !== (profileResult.data.name ?? "") ||
      name2 !== (profileResult.data.name_2 ?? "") ||
      bio !== (profileResult.data.bio ?? "") ||
      website !== (profileResult.data.website ?? ""));

  // ── Navigate back after success ─────────────────────────────────────────────

  useEffect(() => {
    if (mutation.isSuccess) {
      router.back();
    }
  }, [mutation.isSuccess, router]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    mutation.mutate({
      name: name || null,
      name_2: name2 || null,
      bio: bio || null,
      website: website || null,
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
          accessibilityLabel="Go back"
          disabled={isPending}
        >
          <Ionicons name="chevron-back" size={22} color={isPending ? c.textMuted : c.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Edytuj profil</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          accessibilityLabel="Save"
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

          {/* ── Error state (load failure) ── */}
          {profileResult.kind === "error" && (
            <Text style={[styles.stateText, { color: c.textMuted }]}>{profileResult.message}</Text>
          )}

          {/* ── Form ── */}
          {profileResult.kind === "data" && (
            <>
              <FormField
                label="Nazwa"
                value={name}
                onChangeText={setName}
                placeholder="Nazwa organizacji"
                disabled={isPending}
                scheme={colorScheme}
              />
              <FormField
                label="Nazwa dodatkowa"
                value={name2}
                onChangeText={setName2}
                placeholder="np. oddział, podtytuł"
                disabled={isPending}
                scheme={colorScheme}
              />
              <FormField
                label="Opis"
                value={bio}
                onChangeText={setBio}
                placeholder="Krótki opis organizacji"
                multiline
                disabled={isPending}
                scheme={colorScheme}
              />
              <FormField
                label="Strona www"
                value={website}
                onChangeText={setWebsite}
                placeholder="https://..."
                disabled={isPending}
                scheme={colorScheme}
              />

              {/* ── Mutation error ── */}
              {mutation.isError && (
                <Text style={[styles.errorText, styles.errorColor]}>{mutation.error.message}</Text>
              )}
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
  inputMultiline: { minHeight: 90, paddingTop: 11 },
  stateText: { fontSize: 14, textAlign: "center", marginTop: 40 },
  errorText: { fontSize: 14, marginTop: 4, marginBottom: 4 },
  errorColor: { color: "#EF4444" },
  bottomSpacer: { height: 32 },
});
