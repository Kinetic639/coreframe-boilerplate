import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getVisibleModules } from "@/lib/modules/launcher-registry";
import { useTabBarBottomInset } from "@/hooks/use-tab-bar-inset";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Module tile ──────────────────────────────────────────────────────────────

function ModuleTile({
  icon,
  title,
  onPress,
  scheme,
}: {
  icon: string;
  title: string;
  onPress: () => void;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.tileIconWrap, { backgroundColor: c.surface }]}>
        <MaterialCommunityIcons
          name={icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
          size={28}
          color={c.tint}
        />
      </View>
      <Text style={[styles.tileTitle, { color: c.text }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={14} color={c.textMuted} style={styles.tileChevron} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LauncherScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];

  const { appState } = useAppContext();
  const tabBarInset = useTabBarBottomInset();

  const visibleModules = getVisibleModules({
    permissions: appState.permissions,
    entitlements: appState.entitlements,
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={c.background}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.orgName, { color: c.text }]} numberOfLines={1}>
            {appState.orgName ?? appState.activeOrgId?.slice(0, 8) ?? "—"}
          </Text>
          {appState.orgName2 ? (
            <Text style={[styles.orgName2, { color: c.textMuted }]} numberOfLines={1}>
              {appState.orgName2}
            </Text>
          ) : null}
          <Text style={[styles.headerSub, { color: c.textMuted }]}>Wybierz moduł</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset }]}
      >
        {visibleModules.length === 0 ? (
          /* ── Empty state ── */
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="lock-outline" size={40} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>Brak dostępnych modułów</Text>
          </View>
        ) : (
          /* ── Module grid ── */
          <View style={styles.grid}>
            {visibleModules.map((mod) => (
              <ModuleTile
                key={mod.slug}
                icon={mod.icon}
                title={mod.title}
                scheme={colorScheme}
                onPress={() => router.push(mod.route as Parameters<typeof router.push>[0])}
              />
            ))}
          </View>
        )}
      </ScrollView>
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
  orgName: { fontSize: 20, fontWeight: "700" },
  orgName2: { fontSize: 14, fontWeight: "500", marginTop: 1 },
  headerSub: { fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    // Two columns with 12px gap: (100% - 12) / 2 per column.
    // Expressed as a percentage minus half the gap.
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
    gap: 10,
  },
  tileIconWrap: {
    borderRadius: 10,
    padding: 10,
  },
  tileTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  tileChevron: { alignSelf: "flex-end" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: { fontSize: 15 },
});
