"use server";

import { QrService } from "@/server/services/qr.service";
import type { QrRedirectResult } from "@/server/services/qr.service";

export async function resolveQrRedirect(
  token: string,
  paths: { productTemplate: string; locationTemplate: string; assignPath: string }
): Promise<QrRedirectResult> {
  return QrService.resolveRedirect({ token, paths });
}
