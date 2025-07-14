import { getBranchesWithStats } from "@/lib/mock/branches";
import BranchHeader from "@/modules/organization-managment/components/branches/BranchHeader";
import BranchStats from "@/modules/organization-managment/components/branches/BranchStats";
import BranchTable from "@/modules/organization-managment/components/branches/BranchTable";

export default async function BranchesPage() {
  const branchesWithStats = getBranchesWithStats();

  return (
    <div className="space-y-6">
      <BranchHeader />
      <BranchStats branches={branchesWithStats} />
      <BranchTable initialBranches={branchesWithStats} />
    </div>
  );
}
