"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

export async function loadLocations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order");

  if (error) {
    console.error("Błąd ładowania lokalizacji:", error);
    return [] as Tables<"locations">[];
  }

  return data as Tables<"locations">[];
}

export async function createLocation(data: TablesInsert<"locations">) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.from("locations").insert(data).select().single();

  if (error) {
    console.error("Błąd tworzenia lokalizacji:", error);
    return null;
  }

  return result as Tables<"locations">;
}

export async function updateLocation(id: string, data: TablesUpdate<"locations">) {
  const supabase = await createClient();
  const { data: result, error } = await supabase
    .from("locations")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Błąd aktualizacji lokalizacji:", error);
    return null;
  }

  return result as Tables<"locations">;
}

export async function loadLocation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").select("*").eq("id", id).single();

  if (error) {
    console.error("Błąd ładowania lokalizacji:", error);
    return null;
  }

  return data as Tables<"locations">;
}

export async function isLocationEmpty(id: string) {
  const supabase = await createClient();

  const { data: children, error: childError } = await supabase
    .from("locations")
    .select("id")
    .eq("parent_id", id)
    .limit(1);

  if (childError) {
    console.error("Błąd sprawdzania dzieci lokalizacji:", childError);
    return false;
  }

  if (children && children.length > 0) return false;

  const { data: stock, error: stockError } = await supabase
    .from("product_stock_locations")
    .select("id")
    .eq("location_id", id)
    .is("deleted_at", null)
    .limit(1);

  if (stockError) {
    console.error("Błąd sprawdzania stanu lokalizacji:", stockError);
    return false;
  }

  return (stock?.length ?? 0) === 0;
}

export async function deleteLocation(id: string) {
  const empty = await isLocationEmpty(id);
  if (!empty) return false;

  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("Błąd usuwania lokalizacji:", error);
    return false;
  }

  return true;
}
