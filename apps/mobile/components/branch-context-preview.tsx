import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useAppContext } from "@/contexts/app-context";
import { useActiveBranch } from "@/hooks/use-active-branch";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorScheme = "light" | "dark";

// ─── Sub-components ───────────────────────────────────────────────────────────

function PreviewRow({
  label,
  value,
  muted,
  scheme,
}: {
  label: string;
  value: string;
  muted: boolean;
  scheme: ColorScheme;
}) {
  const c = Colors[scheme];
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: muted ? c.textMuted : c.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branch Context Preview — development proof artifact.
 *
 * Renders a read-only card showing the current branch context as seen by an
 * independent branch-aware consumer. Intentionally NOT prop-driven for branch
 * values: consumes useAppContext() and useActiveBranch() directly to prove
 * that any component can independently subscribe to branch state without
 * coordination from its parent.
 *
 * This component is a proof of the branch-aware architecture, not a
 * production-facing UI element.
 */
export function BranchContextPreview({ scheme }: { scheme: ColorScheme }) {
  const { appState } = useAppContext();
  const { name: activeBranchName, isLoading: branchNameLoading } = useActiveBranch();
  const c = Colors[scheme];

  // ── Resolve display values ──

  let branchDisplay: string;
  let branchMuted: boolean;

  if (appState.activeBranchId === null) {
    branchDisplay = "(none)";
    branchMuted = true;
  } else if (branchNameLoading) {
    branchDisplay = "(loading…)";
    branchMuted = true;
  } else if (activeBranchName !== null) {
    branchDisplay = activeBranchName;
    branchMuted = false;
  } else {
    branchDisplay = "(unresolved)";
    branchMuted = true;
  }

  const permissionsDisplay =
    appState.branchPermissions === null
      ? "(none)"
      : `${appState.branchPermissions.allow.length} allow`;
  const permissionsMuted = appState.branchPermissions === null;

  const accessibleDisplay = String(appState.accessibleBranchIds.length);

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Branch Context</Text>
      <View style={[styles.inner, { borderColor: c.border }]}>
        <PreviewRow
          label="Active Branch"
          value={branchDisplay}
          muted={branchMuted}
          scheme={scheme}
        />
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <PreviewRow
          label="Permissions"
          value={permissionsDisplay}
          muted={permissionsMuted}
          scheme={scheme}
        />
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <PreviewRow label="Accessible" value={accessibleDisplay} muted={false} scheme={scheme} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  inner: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 180,
    textAlign: "right",
  },
});
