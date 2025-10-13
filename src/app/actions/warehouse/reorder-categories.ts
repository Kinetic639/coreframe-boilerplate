"use server";

import { createClient } from "@/utils/supabase/server";

export interface CategoryReorderItem {
  id: string;
  sort_order: number;
}

export async function reorderCategories(
  organizationId: string,
  parentId: string | null,
  items: CategoryReorderItem[]
) {
  const supabase = await createClient();

  try {
    // Update each category's sort_order
    for (const item of items) {
      const { error } = await supabase
        .from("product_categories")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
        .eq("organization_id", organizationId)
        .eq("parent_id", parentId || null);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to reorder categories:", error);
    throw error;
  }
}
