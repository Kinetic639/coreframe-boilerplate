import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import BranchHeader from "@/modules/organization-managment/components/branches/BranchHeader";
import BranchStats from "@/modules/organization-managment/components/branches/BranchStats";
import BranchTable from "@/modules/organization-managment/components/branches/BranchTable";

export default async function BranchesPage() {
  const context = await loadAppContextServer();

  if (!context?.activeOrgId) {
    return <div>Brak aktywnej organizacji</div>;
  }

  const branchesWithStats = await getBranchesWithStatsFromDb(context.activeOrgId);

  return (
    <div className="space-y-6">
      <BranchHeader />
      <BranchStats branches={branchesWithStats} />
      <BranchTable initialBranches={branchesWithStats} />
    </div>
  );
}
