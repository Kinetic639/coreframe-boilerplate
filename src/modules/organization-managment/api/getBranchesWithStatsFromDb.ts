// lib/data/branches.ts

import { createClient } from "@/utils/supabase/server";
import { Tables } from "../../../../supabase/types/types";

type BranchWithStats = Tables<"branches"> & {
  userCount: number;
  productCount: number;
};

export async function getBranchesWithStatsFromDb(activeOrgId: string): Promise<BranchWithStats[]> {
  const supabase = await createClient();

  // 1. Pobierz oddziały tej organizacji
  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", activeOrgId)
    .is("deleted_at", null);

  if (branchesError || !branches) {
    console.error("Błąd pobierania oddziałów:", branchesError);
    return [];
  }

  // 2. Pobierz liczbę użytkowników przypisanych do każdego oddziału
  const { data: users } = await supabase.from("users").select("id, default_branch_id");

  const userCounts = Object.fromEntries(
    branches.map((b) => [b.id, users?.filter((u) => u.default_branch_id === b.id).length ?? 0])
  );

  // 3. Pobierz liczbę produktów per oddział (np. z product_inventory_summary)
  const { data: inventoryData } = await supabase
    .from("product_inventory_summary")
    .select("branch_id, quantity");

  const productCounts = Object.fromEntries(
    branches.map((b) => [
      b.id,
      inventoryData?.filter((i) => i.branch_id === b.id).reduce((acc, i) => acc + i.quantity, 0) ??
        0,
    ])
  );

  return branches.map(
    (branch): BranchWithStats => ({
      ...branch,
      userCount: userCounts[branch.id] ?? 0,
      productCount: productCounts[branch.id] ?? 0,
    })
  );
}
