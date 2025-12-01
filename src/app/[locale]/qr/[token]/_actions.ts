"use server";

import { QrService } from "@/server/services/qr.service";
import type { QrLookupResult } from "@/server/services/qr.service";

export async function getQrLookupResult(token: string): Promise<QrLookupResult> {
  return QrService.fetchLabelWithEntity({ token });
}
