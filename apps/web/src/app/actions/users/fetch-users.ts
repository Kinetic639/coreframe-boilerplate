import { createClient } from "@/utils/supabase/server";

interface User {
  id: string;
  username: string;
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .order("username", { ascending: false });
    if (error) {
      console.error("Error fetching users:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Unexpected error in fetchUsers:", error);
    return [];
  }
}
