import { createClient } from "@/utils/supabase/client";
import type { Tables } from "../../../../supabase/types/types";

export async function loadLocations(): Promise<Tables<"locations">[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Błąd ładowania lokalizacji:", error);
    return [];
  }

  return data ?? [];
}
