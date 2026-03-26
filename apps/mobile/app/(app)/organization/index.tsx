import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOrgProfileQuery } from "@/hooks/queries/organization/use-org-profile-query";
import { useOrgMembersList } from "@/hooks/queries/organization/use-org-members-list";
import type { OrgMemberItem } from "@/hooks/queries/organization/use-org-members-list";
import { QueryStateRenderer } from "@/components/query/QueryStateRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, scheme }: { member: OrgMemberItem; scheme: ColorScheme }) {
  const c = Colors[scheme];
  const initials =
    member.firstName && member.lastName
      ? `${member.firstName[0]}${member.lastName[0]}`.toUpperCase()
      : (member.email?.[0] ?? "?").toUpperCase();

  const displayName =
    member.firstName || member.lastName
      ? [member.firstName, member.lastName].filter(Boolean).join(" ")
      : member.email;

  return (
    <View style={[styles.memberRow, { borderBottomColor: c.border }]}>
      <View style={[styles.avatar, { backgroundColor: c.surface }]}>
        <Text style={[styles.avatarText, { color: c.tint }]}>{initials}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: c.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        {displayName !== member.email && member.email ? (
          <Text style={[styles.memberEmail, { color: c.textMuted }]} numberOfLines={1}>
            {member.email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrganizationScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as ColorScheme;
  const c = Colors[colorScheme];

  const { appState } = useAppContext();
  const orgProfile = useOrgProfileQuery(appState.activeOrgId);
  const membersList = useOrgMembersList(appState.activeOrgId);

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
        <Text style={[styles.headerTitle, { color: c.text }]}>Organizacja</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Org profile card ── */}
        <QueryStateRenderer
          result={orgProfile}
          loading={
            <View
              style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            >
              <Text style={[styles.mutedText, { color: c.textMuted }]}>Ładowanie profilu…</Text>
            </View>
          }
          forbidden={
            <View
              style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            >
              <Text style={[styles.mutedText, { color: c.textMuted }]}>
                Brak dostępu do profilu
              </Text>
            </View>
          }
          empty={null}
          error={(msg) => (
            <View
              style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            >
              <Text style={[styles.mutedText, { color: c.textMuted }]}>{msg}</Text>
            </View>
          )}
        >
          {(profile) => (
            <View
              style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            >
              <Text style={[styles.cardTitle, { color: c.text }]}>
                {profile.name ?? appState.orgName ?? "—"}
              </Text>
              {profile.slug ? (
                <Text style={[styles.cardSub, { color: c.textMuted }]}>{profile.slug}</Text>
              ) : null}
              {profile.website ? (
                <Text style={[styles.cardSub, { color: c.textMuted }]}>{profile.website}</Text>
              ) : null}
            </View>
          )}
        </QueryStateRenderer>

        {/* ── Members section ── */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Członkowie</Text>

        <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
          <QueryStateRenderer
            result={membersList}
            loading={
              <Text style={[styles.mutedText, { color: c.textMuted }]}>Ładowanie członków…</Text>
            }
            forbidden={<Text style={[styles.mutedText, { color: c.textMuted }]}>Brak dostępu</Text>}
            empty={<Text style={[styles.mutedText, { color: c.textMuted }]}>Brak członków</Text>}
            error={(msg) => <Text style={[styles.mutedText, { color: c.textMuted }]}>{msg}</Text>}
          >
            {(members) => (
              <>
                {members.map((member) => (
                  <MemberRow key={member.userId} member={member} scheme={colorScheme} />
                ))}
              </>
            )}
          </QueryStateRenderer>
        </View>

        <View style={styles.bottomSpacer} />
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
  headerSpacer: { width: 38 },
  scrollContent: { padding: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSub: { fontSize: 13, marginTop: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  mutedText: { fontSize: 14 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberEmail: { fontSize: 12, marginTop: 1 },
  bottomSpacer: { height: 32 },
});
