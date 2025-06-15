import { useAppStore } from "@/lib/stores/app-store";

export function useAppContext() {
  const {
    isLoaded,
    activeOrg,
    activeBranch,
    activeOrgId,
    activeBranchId,
    availableBranches,
    userModules,
  } = useAppStore();

  if (!isLoaded) {
    throw new Error("❌ App context is not loaded. Did you forget <AppInitProvider>?");
  }

  return {
    activeOrg,
    activeBranch,
    activeOrgId,
    activeBranchId,
    availableBranches,
    userModules,
  };
}
