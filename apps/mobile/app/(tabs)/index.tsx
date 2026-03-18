import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ─── Types ───────────────────────────────────────────────────────────────────

type ColorScheme = 'light' | 'dark';

interface StatCardProps {
  value: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent?: boolean;
  scheme: ColorScheme;
}

interface QuickActionProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
  scheme: ColorScheme;
  primary?: boolean;
}

interface ActivityItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  time: string;
  scheme: ColorScheme;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ value, label, icon, accent, scheme }: StatCardProps) {
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: accent ? Brand.primary : c.surfaceElevated,
          borderColor: accent ? Brand.primary : c.border,
        },
      ]}>
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={accent ? '#fff' : Brand.primary}
        style={styles.statIcon}
      />
      <Text style={[styles.statValue, { color: accent ? '#fff' : c.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: accent ? 'rgba(255,255,255,0.75)' : c.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, scheme, primary }: QuickActionProps) {
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      style={[
        styles.quickAction,
        {
          backgroundColor: primary ? Brand.primary : c.surfaceElevated,
          borderColor: primary ? Brand.primary : c.border,
        },
      ]}
      activeOpacity={0.75}
      onPress={onPress}>
      <View
        style={[
          styles.quickActionIcon,
          { backgroundColor: primary ? 'rgba(255,255,255,0.2)' : Brand.primaryLight },
        ]}>
        <MaterialCommunityIcons name={icon} size={24} color={primary ? '#fff' : Brand.primary} />
      </View>
      <Text style={[styles.quickActionLabel, { color: primary ? '#fff' : c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityItem({ icon, title, subtitle, time, scheme }: ActivityItemProps) {
  const c = Colors[scheme];
  return (
    <View style={[styles.activityItem, { borderBottomColor: c.border }]}>
      <View style={[styles.activityIconWrap, { backgroundColor: Brand.primaryLight }]}>
        <Ionicons name={icon} size={18} color={Brand.primary} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.activitySubtitle, { color: c.textMuted }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.activityTime, { color: c.textMuted }]}>{time}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const c = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.background}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View>
          <View style={styles.brandRow}>
            <View style={[styles.brandDot, { backgroundColor: Brand.primary }]} />
            <Text style={[styles.brandAmbra, { color: Brand.primary }]}>Ambra</Text>
            <Text style={[styles.brandSystem, { color: c.textMuted }]}>system</Text>
          </View>
          <Text style={[styles.headerGreeting, { color: c.textMuted }]}>Cześć, Jan!</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: c.surface }]}>
            <Ionicons name="notifications-outline" size={22} color={c.icon} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.avatar, { backgroundColor: Brand.primary }]}>
            <Text style={styles.avatarText}>J</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* ── Date Banner ── */}
        <View style={[styles.dateBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="calendar-outline" size={15} color={c.textMuted} />
          <Text style={[styles.dateBannerText, { color: c.textMuted }]}>Środa, 18 marca 2026</Text>
          <View style={styles.flex1} />
          <View style={[styles.pill, { backgroundColor: Brand.primaryLight }]}>
            <Text style={[styles.pillText, { color: Brand.primaryDark }]}>Aktywny</Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Przegląd</Text>
        <View style={styles.statsRow}>
          <StatCard value="5" label="Magazyny" icon="warehouse" scheme={colorScheme} />
          <StatCard
            value="1 247"
            label="Produkty"
            icon="package-variant-closed"
            accent
            scheme={colorScheme}
          />
          <StatCard value="2" label="Alerty" icon="alert-circle-outline" scheme={colorScheme} />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Szybkie akcje</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction icon="qrcode-scan" label="Skanuj QR" primary scheme={colorScheme} />
          <QuickAction icon="package-variant" label="Ekwipunek" scheme={colorScheme} />
          <QuickAction icon="map-marker-outline" label="Lokalizacje" scheme={colorScheme} />
          <QuickAction icon="chart-bar" label="Raporty" scheme={colorScheme} />
        </View>

        {/* ── Alerts Banner ── */}
        <View style={[styles.alertBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <Ionicons name="warning-outline" size={18} color={Brand.primaryDark} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#92400E' }]}>Niski stan magazynowy</Text>
            <Text style={[styles.alertSubtitle, { color: '#B45309' }]}>
              3 produkty wymagają uzupełnienia
            </Text>
          </View>
          <TouchableOpacity>
            <Text style={[styles.alertLink, { color: Brand.primaryDark }]}>Zobacz</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.text, marginBottom: 0 }]}>
            Ostatnia aktywność
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAll, { color: Brand.primary }]}>Wszystkie</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
          <ActivityItem
            icon="cube-outline"
            title="Dodano produkt"
            subtitle='Kabel HDMI 2m — Magazyn A, Regał 3'
            time="14:22"
            scheme={colorScheme}
          />
          <ActivityItem
            icon="swap-horizontal-outline"
            title="Przesunięto paletę"
            subtitle="Paleta #P-0047 — Strefa B → Strefa D"
            time="12:05"
            scheme={colorScheme}
          />
          <ActivityItem
            icon="checkmark-circle-outline"
            title="Inwentaryzacja zakończona"
            subtitle="Magazyn B — 342 pozycje zweryfikowane"
            time="09:30"
            scheme={colorScheme}
          />
          <ActivityItem
            icon="person-add-outline"
            title="Nowy użytkownik"
            subtitle="anna.kowalska@firma.pl dołączyła do zespołu"
            time="Wczoraj"
            scheme={colorScheme}
          />
        </View>

        {/* ── Bottom spacer ── */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  brandAmbra: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSystem: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  headerGreeting: {
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Date banner
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  dateBannerText: {
    fontSize: 13,
  },
  flex1: {
    flex: 1,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },

  // Quick actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickAction: {
    width: '47.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // Alert banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  alertSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  alertLink: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Activity
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    flexShrink: 0,
  },

  bottomSpacer: {
    height: 32,
  },
});
