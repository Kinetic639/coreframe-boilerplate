// lib/api/load-product-types.ts
import { createClient } from "@/lib/supabase/server";

export async function loadProductTypes(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_types")
    .select("*")
    .eq("organization_id", orgId);

  if (error) {
    console.error("Błąd ładowania typów produktów:", error);
    return [];
  }

  return data;
}
