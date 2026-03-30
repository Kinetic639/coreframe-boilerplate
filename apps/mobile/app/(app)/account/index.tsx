import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTabBarBottomInset } from "@/hooks/use-tab-bar-inset";
import { useAccountProfileQuery } from "@/hooks/queries/account/use-account-profile-query";
import { useUpdateThemePreferenceMutation } from "@/hooks/mutations/account/use-update-theme-preference-mutation";
import { QueryStateRenderer } from "@/components/query/QueryStateRenderer";
import type { AccountProfile } from "@/lib/queries/account/account-profile";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";
type ThemeOption = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeOption;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { value: "light", label: "Jasny", icon: "sunny-outline" },
  { value: "dark", label: "Ciemny", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function InitialsAvatar({
  firstName,
  lastName,
  email,
  scheme,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  const initials =
    firstName && lastName
      ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
      : firstName
        ? firstName.charAt(0).toUpperCase()
        : email.charAt(0).toUpperCase();

  return (
    <View style={[styles.avatar, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.avatarText, { color: c.tint }]}>{initials}</Text>
    </View>
  );
}

function ThemePicker({
  currentTheme,
  onSelect,
  isPending,
  scheme,
}: {
  currentTheme: ThemeOption;
  onSelect: (theme: ThemeOption) => void;
  isPending: boolean;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  return (
    <View style={[styles.themeRow, isPending && styles.dimmed]}>
      {THEME_OPTIONS.map((opt) => {
        const selected = currentTheme === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.themeTile,
              { backgroundColor: c.surface, borderColor: selected ? c.tint : c.border },
            ]}
            onPress={() => onSelect(opt.value)}
            disabled={isPending}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Ustaw motyw: ${opt.label}`}
            accessibilityState={{ selected }}
          >
            <Ionicons name={opt.icon} size={20} color={selected ? c.tint : c.icon} />
            <Text style={[styles.themeTileLabel, { color: selected ? c.tint : c.text }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AccountContent({
  data,
  email,
  scheme,
}: {
  data: AccountProfile;
  email: string;
  scheme: ColorScheme;
}) {
  const router = useRouter();
  const { appState } = useAppContext();
  const themeMutation = useUpdateThemePreferenceMutation(appState.userId);

  // Local theme state for immediate UI feedback before DB write completes
  const [localTheme, setLocalTheme] = useState<ThemeOption>(data.theme);

  const handleThemeSelect = (theme: ThemeOption) => {
    setLocalTheme(theme);
    themeMutation.mutate({
      theme,
      currentDashboardSettings: data.rawDashboardSettings,
    });
  };

  const c = Colors[scheme];
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ") || null;

  return (
    <>
      {/* ── Profile card ── */}
      <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
        <View style={styles.profileHeader}>
          <InitialsAvatar
            firstName={data.firstName}
            lastName={data.lastName}
            email={email}
            scheme={scheme}
          />
          <View style={styles.profileInfo}>
            {fullName ? (
              <Text style={[styles.profileName, { color: c.text }]}>{fullName}</Text>
            ) : null}
            {data.displayName ? (
              <Text style={[styles.profileDisplayName, { color: c.textMuted }]}>
                {data.displayName}
              </Text>
            ) : null}
            <Text style={[styles.profileEmail, { color: c.textMuted }]} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.border }]} />

        <TouchableOpacity
          style={styles.editRow}
          onPress={() => router.push("/(app)/account/edit")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Edytuj profil"
        >
          <Text style={[styles.editRowLabel, { color: c.tint }]}>Edytuj profil</Text>
          <Ionicons name="chevron-forward" size={16} color={c.tint} />
        </TouchableOpacity>
      </View>

      {/* ── Preferences section ── */}
      <View style={styles.sectionGroup}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Wygląd</Text>
        <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
          <ThemePicker
            currentTheme={localTheme}
            onSelect={handleThemeSelect}
            isPending={themeMutation.isPending}
            scheme={scheme}
          />
          {themeMutation.isError && (
            <Text style={styles.mutationError}>{themeMutation.error.message}</Text>
          )}
        </View>
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];
  const { appState } = useAppContext();
  const tabBarInset = useTabBarBottomInset();

  const result = useAccountProfileQuery(appState.userId);

  const errorNode = (msg: string) => (
    <Text style={[styles.stateText, { color: c.textMuted }]}>{msg}</Text>
  );

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
        >
          <Ionicons name="chevron-back" size={22} color={c.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Konto</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset + 16 }]}
      >
        <QueryStateRenderer
          result={result}
          loading={
            <ActivityIndicator size="small" color={c.tint} style={styles.loadingIndicator} />
          }
          error={errorNode}
          forbidden={errorNode("Błąd ładowania danych konta")}
        >
          {(data) => <AccountContent data={data} email={appState.email} scheme={colorScheme} />}
        </QueryStateRenderer>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1 },
  headerSpacer: { width: 32 },
  scrollContent: { padding: 16, gap: 16 },
  loadingIndicator: { marginTop: 40 },
  stateText: { fontSize: 14, textAlign: "center", marginTop: 40 },
  sectionGroup: { gap: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: "700" },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: "600" },
  profileDisplayName: { fontSize: 13 },
  profileEmail: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  editRowLabel: { fontSize: 15, fontWeight: "500", flex: 1 },
  themeRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  dimmed: { opacity: 0.6 },
  themeTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  themeTileLabel: { fontSize: 12, fontWeight: "500" },
  mutationError: {
    fontSize: 13,
    color: "#EF4444",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
});
