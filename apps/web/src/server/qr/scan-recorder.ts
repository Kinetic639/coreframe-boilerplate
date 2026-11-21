import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Records one scan of a QR code (last_scanned_at + scan_count) through the
 * service-role-only qr_record_scan() RPC. Best effort: a failed write never
 * breaks the scan itself, so errors are logged and swallowed.
 *
 * Callers must have identified the code themselves (public resolver by
 * token, /api/qr/scans after an RLS read) -- this does no access check.
 */
export async function recordQrScan(qrCodeId: string, client?: SupabaseClient): Promise<void> {
  try {
    const supabase = client ?? (createServiceClient() as unknown as SupabaseClient);
    const { error } = await supabase.rpc("qr_record_scan", { p_qr_code_id: qrCodeId });
    if (error) console.error("[recordQrScan] failed:", error.message);
  } catch (err) {
    console.error("[recordQrScan] failed:", err);
  }
}
