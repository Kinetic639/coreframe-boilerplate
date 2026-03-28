import { useAppContext } from "@/contexts/app-context";
import { useBranchesQuery } from "@/hooks/queries/branches/use-branches-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveBranch {
  /** UUID of the active branch, or null when none is selected. */
  id: string | null;
  /** Display name of the active branch, or null when unavailable or loading. */
  name: string | null;
  /** True while the branch list is being fetched. */
  isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns display-ready data for the current active branch.
 *
 * Reads activeBranchId and accessibleBranchIds from AppContext, then
 * resolves the branch name via useBranchesQuery (React Query cache — no
 * additional network call if the branch list is already loaded).
 *
 * Never throws. Returns { id: null, name: null, isLoading: false } when
 * no branch is active. Returns isLoading: true while the branch list is
 * in flight. Returns name: null when the active branch ID cannot be matched
 * in the fetched list (deleted branch, stale JWT).
 */
export function useActiveBranch(): ActiveBranch {
  const { appState } = useAppContext();
  const { activeBranchId, accessibleBranchIds } = appState;

  const result = useBranchesQuery(accessibleBranchIds);

  if (activeBranchId === null) {
    return { id: null, name: null, isLoading: false };
  }

  if (result.kind === "loading") {
    return { id: activeBranchId, name: null, isLoading: true };
  }

  if (result.kind === "data") {
    const branch = result.data.find((b) => b.id === activeBranchId);
    return { id: activeBranchId, name: branch?.name ?? null, isLoading: false };
  }

  // error or forbidden
  return { id: activeBranchId, name: null, isLoading: false };
}
