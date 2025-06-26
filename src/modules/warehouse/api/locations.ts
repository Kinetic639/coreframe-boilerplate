"use server";

import { createClient } from "@/utils/supabase/server";
import { TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

export async function loadLocations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(
      `*,
      children:locations!locations_parent_id_fkey(
        *,
        children:locations!locations_parent_id_fkey(*)
      )`
    )
    .eq("organization_id", orgId)
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading locations:", error);
    return [];
  }

  return data;
}

export async function createLocation(data: TablesInsert<"locations">) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.from("locations").insert(data).select().single();

  if (error) {
    console.error("Error creating location:", error);
    throw error;
  }

  return result;
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
    console.error("Error updating location:", error);
    throw error;
  }

  return result;
}

export async function deleteLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("Error deleting location:", error);
    throw error;
  }

  return true;
}
