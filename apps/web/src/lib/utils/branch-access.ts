import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_VIEW_UPDATE_ANY } from "@/lib/constants/permissions";
import type { BranchDataV2 } from "@/lib/stores/v2/app-store";
import type { PermissionSnapshot } from "@/lib/types/permissions";

/**
 * Zone 1 / Phase 6 correction: the single authoritative "may this user access
 * this branch" check, extracted from `changeBranch()` (apps/web/src/app/actions/shared/changeBranch.ts)
 * so the QR resolver's UX-hint logic and the actual authorization check can
 * never drift apart. `changeBranch()` remains the only place that ACTS on
 * this decision (it still re-validates fully server-side on every call) --
 * this helper only answers the question, it never authorizes anything by
 * itself.
 */
export function isBranchAccessible(
  branchId: string,
  accessibleBranches: BranchDataV2[],
  permissionSnapshot: PermissionSnapshot
): boolean {
  return (
    checkPermission(permissionSnapshot, BRANCHES_VIEW_UPDATE_ANY) ||
    accessibleBranches.some((b) => b.id === branchId)
  );
}
