import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/contexts/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

interface UtilityRow {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: string;
  accessibilityLabel: string;
}

// ─── Utility rows ─────────────────────────────────────────────────────────────

/**
 * Secondary utility destinations — items that are intentionally NOT launcher-
 * visible but still need a reachable entry point.
 *
 * Add future items here (Tools, Settings, Sign Out) as their screens are built.
 * No access-gating at this layer: all rows are navigable by any authenticated user.
 */
const UTILITY_ROWS: UtilityRow[] = [
  {
    label: "Diagnostyka",
    icon: "bug-outline",
    route: "/(app)/diagnostics",
    accessibilityLabel: "Open Diagnostics",
  },
];

// ─── Row component ────────────────────────────────────────────────────────────

function UtilityRowItem({
  row,
  onPress,
  scheme,
  isLast,
}: {
  row: UtilityRow;
  onPress: () => void;
  scheme: ColorScheme;
  isLast: boolean;
}) {
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: c.border }, isLast && styles.rowLast]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
    >
      <Ionicons name={row.icon} size={20} color={c.icon} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, { color: c.text }]}>{row.label}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={c.background}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Więcej</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Utility destinations ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          {UTILITY_ROWS.map((row, index) => (
            <UtilityRowItem
              key={row.route}
              row={row}
              onPress={() => router.push(row.route as Parameters<typeof router.push>[0])}
              scheme={colorScheme}
              isLast={index === UTILITY_ROWS.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Sign out — pinned to bottom ── */}
      <View style={[styles.signOutWrap, { borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[styles.signOutRow, { backgroundColor: c.surfaceElevated }]}
          onPress={() => signOut()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" style={styles.rowIcon} />
          <Text style={[styles.rowLabel, { color: "#DC2626" }]}>Wyloguj się</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 8 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 24, textAlign: "center" },
  rowLabel: { fontSize: 15, flex: 1 },
  signOutWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 100,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
});
