import { Ionicons } from "@expo/vector-icons";
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
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppContext } from "@/contexts/app-context";
import { useBranchesQuery } from "@/hooks/queries/branches/use-branches-query";
import type { BranchData } from "@/lib/queries/branches/branches";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Branch row ───────────────────────────────────────────────────────────────

function BranchRow({
  branch,
  isActive,
  onPress,
  scheme,
  isLast,
}: {
  branch: BranchData;
  isActive: boolean;
  onPress: () => void;
  scheme: ColorScheme;
  isLast: boolean;
}) {
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: c.border }, isLast && styles.rowLast]}
      onPress={onPress}
      activeOpacity={isActive ? 1 : 0.7}
      accessibilityRole="button"
      accessibilityLabel={`Select branch ${branch.name}`}
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
        {branch.name}
      </Text>
      {isActive && <Ionicons name="checkmark" size={18} color={c.tint} />}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Branch selection screen.
 *
 * Lists all branches accessible to the current user (derived from JWT branch
 * roles). Tapping a branch calls switchBranch and navigates back. The active
 * branch is indicated with a checkmark.
 *
 * Only reachable when appState.accessibleBranchIds.length > 0 (guarded by the
 * More screen). An empty list is not expected in practice.
 */
export default function BranchSelectScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];
  const { appState, switchBranch } = useAppContext();

  const result = useBranchesQuery(appState.accessibleBranchIds);

  function handleSelect(branchId: string) {
    if (branchId === appState.activeBranchId) {
      // Already active — navigate back without switching.
      router.back();
      return;
    }
    switchBranch(branchId);
    router.back();
  }

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
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={c.tint} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Wybierz oddział</Text>
      </View>

      {/* ── Content ── */}
      {result.kind === "loading" && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.tint} />
        </View>
      )}

      {result.kind === "error" && (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: c.textMuted }]}>
            Nie udało się załadować oddziałów
          </Text>
        </View>
      )}

      {result.kind === "forbidden" && (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: c.textMuted }]}>Brak dostępu do oddziałów</Text>
        </View>
      )}

      {result.kind === "data" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
          >
            {result.data.map((branch, index) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                isActive={branch.id === appState.activeBranchId}
                onPress={() => handleSelect(branch.id)}
                scheme={colorScheme}
                isLast={index === result.data.length - 1}
              />
            ))}
            {result.data.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  Brak dostępnych oddziałów
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 15 },
  scrollContent: { padding: 16 },
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
  rowLabel: { fontSize: 15, flex: 1 },
  emptyRow: { paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 14 },
});
