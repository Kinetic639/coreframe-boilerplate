"use server";

import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createClientClient } from "@/utils/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

export async function loadLocationsServer(
  orgId: string,
  branchId: string
): Promise<Tables<"locations">[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .is("deleted_at", null);

  if (error) {
    console.error("Error loading locations:", error.message);
    return [];
  }

  return data;
}

export async function loadLocations(orgId: string, branchId: string) {
  const supabase = createClientClient();

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return data;
}

export async function createLocation(data: TablesInsert<"locations">) {
  const supabase = await createServerClient();
  const { data: result, error } = await supabase.from("locations").insert(data).select().single();

  if (error) {
    console.error("Błąd tworzenia lokalizacji:", error);
    return null;
  }

  return result as Tables<"locations">;
}

export async function updateLocation(id: string, data: TablesUpdate<"locations">) {
  const supabase = await createServerClient();
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
  const supabase = await createServerClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("Błąd usuwania lokalizacji:", error);
    return false;
  }

  return true;
}
