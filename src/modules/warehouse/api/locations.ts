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
  const { data: result, error } = await supabase
    .from("locations")
    .insert(data)
    .select()
    .single();

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

export async function deleteLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("Błąd usuwania lokalizacji:", error);
    return false;
  }

  return true;
}

