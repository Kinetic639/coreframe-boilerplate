import { useState } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
} from "@repo/contracts/modules";
import { LIMIT_KEYS } from "@repo/contracts/entitlements";

import { Brand, Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOrgProfileQuery } from "@/hooks/queries/organization/use-org-profile-query";
import { useOrgMembersSummary } from "@/hooks/queries/organization/use-org-members-summary";
import { QueryStateRenderer } from "@/components/query/QueryStateRenderer";

// ─── Types ───────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  expanded,
  onToggle,
  scheme,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { borderBottomColor: c.border }]}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${title}`}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.textMuted} />
    </TouchableOpacity>
  );
}

function DataRow({
  label,
  value,
  scheme,
  valueColor,
}: {
  label: string;
  value: string;
  scheme: ColorScheme;
  valueColor?: string;
}) {
  const c = Colors[scheme];
  return (
    <View style={styles.dataRow}>
      <Text style={[styles.dataLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: valueColor ?? c.text }]} selectable>
        {value}
      </Text>
    </View>
  );
}

function KindPill({ kind, scheme }: { kind: string; scheme: ColorScheme }) {
  const c = Colors[scheme];
  let bg = c.surface;
  let fg = c.text;

  if (kind === "data" || kind === "resolved") {
    bg = "#D1FAE5";
    fg = "#065F46";
  } else if (kind === "loading" || kind === "resolving") {
    bg = "#DBEAFE";
    fg = "#1E40AF";
  } else if (kind === "forbidden" || kind === "error" || kind === "invalid-session") {
    bg = "#FEE2E2";
    fg = "#991B1B";
  } else if (kind === "empty" || kind === "authenticated-unresolved") {
    bg = "#FEF3C7";
    fg = "#92400E";
  }

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{kind}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DiagnosticsScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];

  const { bootstrapState, appState } = useAppContext();
  const { hasModuleAccess, getEffectiveLimit } = useEntitlements();

  const orgProfile = useOrgProfileQuery(appState.activeOrgId);
  const membersSummary = useOrgMembersSummary(appState.activeOrgId);

  // ── Collapse state — all sections expanded by default ────────────────────
  type SectionKey =
    | "bootstrap"
    | "session"
    | "roles"
    | "permissions"
    | "branchContext"
    | "branchPermissions"
    | "entitlementsRaw"
    | "entitlementsInterpreted"
    | "organization"
    | "queryHealth";

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    bootstrap: true,
    session: true,
    roles: true,
    permissions: true,
    branchContext: true,
    branchPermissions: true,
    entitlementsRaw: true,
    entitlementsInterpreted: true,
    organization: true,
    queryHealth: true,
  });

  const toggle = (key: SectionKey) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Derived values ────────────────────────────────────────────────────────
  const {
    permissions,
    branchPermissions: branchPerms,
    entitlements,
    roles,
    activeBranchId,
    branchRoles,
  } = appState;
  const allowSlugs = permissions ? [...permissions.allow].sort() : [];
  const denySlugs = permissions ? [...permissions.deny].sort() : [];
  const branchAllowSlugs = branchPerms ? [...branchPerms.allow].sort() : [];

  const CHECKED_MODULES = [
    MODULE_WAREHOUSE,
    MODULE_TEAMS,
    MODULE_ORGANIZATION_MANAGEMENT,
    MODULE_ANALYTICS,
    MODULE_DEVELOPMENT,
  ] as const;

  const CHECKED_LIMITS = [
    LIMIT_KEYS.ORGANIZATION_MAX_USERS,
    LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS,
    LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
    LIMIT_KEYS.WAREHOUSE_MAX_BRANCHES,
    LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS,
  ] as const;

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
        >
          <Ionicons name="chevron-back" size={22} color={c.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Diagnostics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── 1. Bootstrap State ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Bootstrap State"
            expanded={expanded.bootstrap}
            onToggle={() => toggle("bootstrap")}
            scheme={colorScheme}
          />
          {expanded.bootstrap && (
            <View style={styles.sectionContent}>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: c.textMuted }]}>state</Text>
                <KindPill kind={bootstrapState} scheme={colorScheme} />
              </View>
            </View>
          )}
        </View>

        {/* ── 2. Session ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Session"
            expanded={expanded.session}
            onToggle={() => toggle("session")}
            scheme={colorScheme}
          />
          {expanded.session && (
            <View style={styles.sectionContent}>
              <DataRow label="userId" value={appState.userId} scheme={colorScheme} />
              <DataRow label="email" value={appState.email} scheme={colorScheme} />
              <DataRow
                label="activeOrgId"
                value={appState.activeOrgId ?? "(null)"}
                scheme={colorScheme}
              />
              <DataRow label="orgName" value={appState.orgName ?? "(null)"} scheme={colorScheme} />
              <DataRow
                label="orgName2"
                value={appState.orgName2 ?? "(null)"}
                scheme={colorScheme}
              />
            </View>
          )}
        </View>

        {/* ── 3. Roles ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title={`Roles (${roles.length})`}
            expanded={expanded.roles}
            onToggle={() => toggle("roles")}
            scheme={colorScheme}
          />
          {expanded.roles && (
            <View style={styles.sectionContent}>
              {roles.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>No roles</Text>
              ) : (
                roles.map((role, i) => (
                  <View
                    key={`${role.role_id}-${i}`}
                    style={[styles.roleRow, { borderBottomColor: c.border }]}
                  >
                    <DataRow label="name" value={role.name} scheme={colorScheme} />
                    <DataRow label="scope" value={role.scope} scheme={colorScheme} />
                    <DataRow
                      label="scope_type"
                      value={role.scope_type ?? "(null)"}
                      scheme={colorScheme}
                    />
                    <DataRow label="is_basic" value={String(role.is_basic)} scheme={colorScheme} />
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── 4. Permissions ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title={`Permissions (${allowSlugs.length} allow, ${denySlugs.length} deny)`}
            expanded={expanded.permissions}
            onToggle={() => toggle("permissions")}
            scheme={colorScheme}
          />
          {expanded.permissions && (
            <View style={styles.sectionContent}>
              {permissions === null ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No permission snapshot
                </Text>
              ) : (
                <>
                  {allowSlugs.length === 0 ? (
                    <Text style={[styles.emptyText, { color: c.textMuted }]}>No allow slugs</Text>
                  ) : (
                    allowSlugs.map((slug) => (
                      <Text key={`allow-${slug}`} style={[styles.monoRow, { color: c.text }]}>
                        {slug}
                      </Text>
                    ))
                  )}
                  {denySlugs.length > 0 && (
                    <>
                      <Text style={[styles.subGroupLabel, { color: c.textMuted }]}>deny</Text>
                      {denySlugs.map((slug) => (
                        <Text key={`deny-${slug}`} style={[styles.monoRow, { color: "#B45309" }]}>
                          {slug}
                        </Text>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── 5. Branch Context ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title={`Branch Context (${branchRoles.length} branch role${branchRoles.length === 1 ? "" : "s"})`}
            expanded={expanded.branchContext}
            onToggle={() => toggle("branchContext")}
            scheme={colorScheme}
          />
          {expanded.branchContext && (
            <View style={styles.sectionContent}>
              <DataRow
                label="activeBranchId"
                value={activeBranchId ?? "(none)"}
                scheme={colorScheme}
              />
              {branchRoles.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>No branch roles</Text>
              ) : (
                branchRoles.map((role, i) => (
                  <View
                    key={`${role.role_id}-${i}`}
                    style={[styles.roleRow, { borderBottomColor: c.border }]}
                  >
                    <DataRow label="name" value={role.name} scheme={colorScheme} />
                    <DataRow
                      label="scope_type"
                      value={role.scope_type ?? "(null)"}
                      scheme={colorScheme}
                    />
                    <DataRow label="scope_id" value={role.scope_id} scheme={colorScheme} />
                    <DataRow label="is_basic" value={String(role.is_basic)} scheme={colorScheme} />
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── 6. Branch Permissions ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title={`Branch Permissions (${branchAllowSlugs.length} allow)`}
            expanded={expanded.branchPermissions}
            onToggle={() => toggle("branchPermissions")}
            scheme={colorScheme}
          />
          {expanded.branchPermissions && (
            <View style={styles.sectionContent}>
              {activeBranchId === null ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>No active branch</Text>
              ) : branchPerms === null ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>Loading…</Text>
              ) : branchAllowSlugs.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No branch permissions
                </Text>
              ) : (
                branchAllowSlugs.map((slug) => (
                  <Text key={`branch-allow-${slug}`} style={[styles.monoRow, { color: c.text }]}>
                    {slug}
                  </Text>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── 7. Entitlements — Raw ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Entitlements — Raw"
            expanded={expanded.entitlementsRaw}
            onToggle={() => toggle("entitlementsRaw")}
            scheme={colorScheme}
          />
          {expanded.entitlementsRaw && (
            <View style={styles.sectionContent}>
              {entitlements === null ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No entitlements loaded
                </Text>
              ) : (
                <>
                  <DataRow
                    label="plan_id"
                    value={entitlements.plan_id ?? "(null)"}
                    scheme={colorScheme}
                  />
                  <DataRow
                    label="updated_at"
                    value={entitlements.updated_at}
                    scheme={colorScheme}
                  />
                  <DataRow
                    label="enabled_modules"
                    value={
                      entitlements.enabled_modules.length === 0
                        ? "(empty)"
                        : entitlements.enabled_modules.join(", ")
                    }
                    scheme={colorScheme}
                  />
                  {Object.keys(entitlements.limits).length === 0 ? (
                    <DataRow label="limits" value="(empty)" scheme={colorScheme} />
                  ) : (
                    Object.entries(entitlements.limits).map(([key, val]) => (
                      <DataRow key={key} label={key} value={String(val)} scheme={colorScheme} />
                    ))
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── 8. Entitlements — Interpreted ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Entitlements — Interpreted"
            expanded={expanded.entitlementsInterpreted}
            onToggle={() => toggle("entitlementsInterpreted")}
            scheme={colorScheme}
          />
          {expanded.entitlementsInterpreted && (
            <View style={styles.sectionContent}>
              <Text style={[styles.subGroupLabel, { color: c.textMuted }]}>module access</Text>
              {CHECKED_MODULES.map((slug) => {
                const has = hasModuleAccess(slug);
                return (
                  <View key={slug} style={styles.dataRow}>
                    <Text style={[styles.dataLabel, { color: c.textMuted }]}>{slug}</Text>
                    <Text style={{ color: has ? "#065F46" : c.textMuted, fontFamily: MONO_FONT }}>
                      {has ? "✓ yes" : "– no"}
                    </Text>
                  </View>
                );
              })}
              <Text style={[styles.subGroupLabel, { color: c.textMuted, marginTop: 10 }]}>
                limits
              </Text>
              {CHECKED_LIMITS.map((key) => {
                const val = getEffectiveLimit(key);
                return (
                  <DataRow
                    key={key}
                    label={key}
                    value={val === -1 ? "unlimited" : String(val)}
                    scheme={colorScheme}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── 9. Organization ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Organization"
            expanded={expanded.organization}
            onToggle={() => toggle("organization")}
            scheme={colorScheme}
          />
          {expanded.organization && (
            <View style={styles.sectionContent}>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: c.textMuted }]}>query kind</Text>
                <KindPill kind={orgProfile.kind} scheme={colorScheme} />
              </View>
              <QueryStateRenderer
                result={orgProfile}
                loading={
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>Loading profile…</Text>
                }
                forbidden={
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>Access denied</Text>
                }
                empty={
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>No profile row</Text>
                }
                error={(msg) => (
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>{msg}</Text>
                )}
              >
                {(profile) => (
                  <>
                    <DataRow label="name" value={profile.name ?? "(null)"} scheme={colorScheme} />
                    <DataRow
                      label="name_2"
                      value={profile.name_2 ?? "(null)"}
                      scheme={colorScheme}
                    />
                    <DataRow label="slug" value={profile.slug ?? "(null)"} scheme={colorScheme} />
                    <DataRow
                      label="website"
                      value={profile.website ?? "(null)"}
                      scheme={colorScheme}
                    />
                  </>
                )}
              </QueryStateRenderer>
            </View>
          )}
        </View>

        {/* ── 10. Live Query Health ── */}
        <View
          style={[styles.section, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
        >
          <SectionHeader
            title="Live Query Health"
            expanded={expanded.queryHealth}
            onToggle={() => toggle("queryHealth")}
            scheme={colorScheme}
          />
          {expanded.queryHealth && (
            <View style={styles.sectionContent}>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: c.textMuted }]}>useOrgProfileQuery</Text>
                <KindPill kind={orgProfile.kind} scheme={colorScheme} />
              </View>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: c.textMuted }]}>useOrgMembersSummary</Text>
                <KindPill kind={membersSummary.kind} scheme={colorScheme} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO_FONT = Platform.OS === "ios" ? "Courier New" : "monospace";

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
  headerSpacer: { width: 38 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2, textTransform: "uppercase" },
  sectionContent: { paddingHorizontal: 14, paddingVertical: 10 },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 4,
    gap: 12,
  },
  dataLabel: { fontSize: 12, flex: 1, fontFamily: MONO_FONT },
  dataValue: { fontSize: 12, flex: 2, textAlign: "right", fontFamily: MONO_FONT },
  monoRow: { fontSize: 12, paddingVertical: 2, fontFamily: MONO_FONT },
  subGroupLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  emptyText: { fontSize: 12, paddingVertical: 4 },
  roleRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 6, marginBottom: 6 },
  pill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: "600" },
  bottomSpacer: { height: 32 },
});
