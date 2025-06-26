"use server";

import { createClient } from "@/utils/supabase/server";
import { TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

export async function createLocation(data: TablesInsert<"locations">) {
  const supabase = await createClient();
  return await supabase.from("locations").insert(data).select().single();
}

export async function updateLocation(id: string, data: TablesUpdate<"locations">) {
  const supabase = await createClient();
  return await supabase.from("locations").update(data).eq("id", id).single();
}
