import type { SupabaseClient } from "@supabase/supabase-js";

export type VmiSupabaseClient = SupabaseClient;

export type VmiServiceResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
};
