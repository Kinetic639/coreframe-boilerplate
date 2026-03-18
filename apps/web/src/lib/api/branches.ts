import { createClient } from "@/utils/supabase/client";
import { Database } from "../../../supabase/types/types";
import { BranchData } from "@/lib/stores/app-store";

type Tables = Database["public"]["Tables"];
type Branch = Tables["branches"]["Row"];
type BranchInsert = Tables["branches"]["Insert"];
type BranchUpdate = Tables["branches"]["Update"];

export interface BranchWithStats extends Branch {
  userCount: number;
  productCount: number;
}

export interface CreateBranchData {
  name: string;
  slug?: string;
  organization_id: string;
}

export interface UpdateBranchData {
  name?: string;
  slug?: string;
}

/**
 * Fetch all branches for an organization with statistics
 */
export async function fetchBranchesWithStats(organizationId: string): Promise<BranchWithStats[]> {
  const supabase = createClient();

  // Fetch branches
  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (branchesError) {
    throw new Error(`Failed to fetch branches: ${branchesError.message}`);
  }

  if (!branches || branches.length === 0) {
    return [];
  }

  // Fetch user counts for each branch
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, default_branch_id")
    .is("deleted_at", null);

  if (usersError) {
    console.warn("Failed to fetch user counts:", usersError.message);
  }

  // Fetch product inventory counts for each branch
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("product_inventory_summary")
    .select("branch_id, quantity");

  if (inventoryError) {
    console.warn("Failed to fetch inventory counts:", inventoryError.message);
  }

  // Calculate stats for each branch
  const userCounts = Object.fromEntries(
    branches.map((b) => [b.id, users?.filter((u) => u.default_branch_id === b.id).length ?? 0])
  );

  const productCounts = Object.fromEntries(
    branches.map((b) => [
      b.id,
      inventoryData
        ?.filter((i) => i.branch_id === b.id)
        .reduce((acc, i) => acc + (i.quantity || 0), 0) ?? 0,
    ])
  );

  return branches.map((branch) => ({
    ...branch,
    userCount: userCounts[branch.id] ?? 0,
    productCount: productCounts[branch.id] ?? 0,
  }));
}

/**
 * Create a new branch
 */
export async function createBranch(data: CreateBranchData): Promise<Branch> {
  const supabase = createClient();

  const branchData: BranchInsert = {
    name: data.name.trim(),
    slug: data.slug?.trim() || null,
    organization_id: data.organization_id,
  };

  const { data: branch, error } = await supabase
    .from("branches")
    .insert(branchData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create branch: ${error.message}`);
  }

  return branch;
}

/**
 * Update an existing branch
 */
export async function updateBranch(branchId: string, data: UpdateBranchData): Promise<Branch> {
  const supabase = createClient();

  const updateData: BranchUpdate = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.slug !== undefined) {
    updateData.slug = data.slug?.trim() || null;
  }

  const { data: branch, error } = await supabase
    .from("branches")
    .update(updateData)
    .eq("id", branchId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update branch: ${error.message}`);
  }

  return branch;
}

/**
 * Soft delete a branch
 */
export async function deleteBranch(branchId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("branches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", branchId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to delete branch: ${error.message}`);
  }
}

/**
 * Get a single branch by ID
 */
export async function fetchBranchById(branchId: string): Promise<Branch | null> {
  const supabase = createClient();

  const { data: branch, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Branch not found
    }
    throw new Error(`Failed to fetch branch: ${error.message}`);
  }

  return branch;
}

/**
 * Check if branch slug is available in organization
 */
export async function checkBranchSlugAvailability(
  organizationId: string,
  slug: string,
  excludeBranchId?: string
): Promise<boolean> {
  const supabase = createClient();

  let query = supabase
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("slug", slug.trim().toLowerCase())
    .is("deleted_at", null);

  if (excludeBranchId) {
    query = query.neq("id", excludeBranchId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check slug availability: ${error.message}`);
  }

  return !data || data.length === 0;
}

/**
 * Fetch available branches for an organization (for branch selector)
 */
export async function fetchAvailableBranches(organizationId: string): Promise<BranchData[]> {
  const supabase = createClient();

  const { data: branches, error } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch available branches: ${error.message}`);
  }

  // Convert to format expected by the app store (with branch_id compatibility)
  return (branches || []).map((branch) => ({
    ...branch,
    branch_id: branch.id, // Add branch_id for compatibility
    bio: null, // Add optional fields for compatibility
    logo_url: null,
    website: null,
  }));
}

/**
 * Get branch statistics for dashboard
 */
export async function fetchBranchStatistics(organizationId: string) {
  const supabase = createClient();

  // Get total branches count
  const { count: totalBranches, error: branchesCountError } = await supabase
    .from("branches")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (branchesCountError) {
    throw new Error(`Failed to fetch branches count: ${branchesCountError.message}`);
  }

  // Get total users across all branches
  const { data: userAssignments, error: usersError } = await supabase
    .from("users")
    .select("default_branch_id")
    .not("default_branch_id", "is", null)
    .is("deleted_at", null);

  if (usersError) {
    throw new Error(`Failed to fetch user assignments: ${usersError.message}`);
  }

  // Get total inventory across all branches
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("product_inventory_summary")
    .select("quantity")
    .not("branch_id", "is", null);

  const totalInventory = inventoryData?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  if (inventoryError) {
    console.warn("Failed to fetch inventory data:", inventoryError.message);
  }

  return {
    totalBranches: totalBranches || 0,
    totalUsers: userAssignments?.length || 0,
    totalInventory,
  };
}
