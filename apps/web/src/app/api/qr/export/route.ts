import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_EXPORT } from "@/lib/constants/permissions";
import { QrCodesService } from "@/server/services/qr.service";
import type { QrCode } from "@/server/services/qr.service";
import { generateQrPngDataUrl } from "@/lib/qr/generate";
import { generateQrLabelsPdfWithConfig } from "@/server/qr/label-pdf";
import type { QrLabelPdfItem } from "@/server/qr/label-pdf";
import { generateZplLabels } from "@/lib/qr/zpl";
import type { ZplLabelItem, ZplLabelSize } from "@/lib/qr/zpl";
import { eventService } from "@/server/services/event.service";

export const dynamic = "force-dynamic";

const MAX_IDS = 200;

const textLayerSchema = z.object({
  show: z.boolean(),
  size: z.number().min(4).max(24),
  bold: z.boolean(),
});

const labelConfigSchema = z.object({
  dimension: z.object({
    width: z.number().min(10).max(210),
    height: z.number().min(10).max(297),
  }),
  includeLogo: z.boolean(),
  qrHeightRatio: z.number().min(0.4).max(0.95),
  showBorder: z.boolean(),
  primaryText: textLayerSchema,
  secondaryText: textLayerSchema,
  tertiaryText: textLayerSchema,
  includeTokenPreview: z.boolean(),
});

const requestSchema = z.object({
  qrCodeIds: z
    .array(z.string().uuid())
    .min(1, "At least one qrCodeId is required.")
    .max(MAX_IDS, `Cannot export more than ${MAX_IDS} labels at once.`),
  format: z.enum(["pdf", "zpl"]),
  labelConfig: labelConfigSchema,
  /** Only used when format === "zpl" */
  zplSize: z.enum(["50x30", "70x40"]).optional().default("50x30"),
});

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

/**
 * POST /api/qr/export
 *
 * Generic QR export — returns PDF or ZPL for the requested QR codes.
 * PDF output uses LabelConfig for rich layout control.
 * ZPL uses the simpler zplSize field (Zebra thermal printers).
 *
 * Security model:
 * - Auth via loadDashboardContextV2
 * - Requires qr.export permission
 * - Only exports active QR codes belonging to the active org
 */
export async function POST(request: NextRequest) {
  // ─── 1. Parse + validate ───────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
  }

  const { qrCodeIds, format, labelConfig, zplSize } = parsed.data;

  // ─── 2. Auth ───────────────────────────────────────────────────────────────
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return jsonError("Unauthorized", 401);

  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? null;
  const snapshot = context.user.permissionSnapshot;

  if (!checkPermission(snapshot, QR_EXPORT)) {
    return jsonError("You do not have permission to export QR codes.", 403);
  }

  const supabase = await createClient();

  // ─── 3. Load + validate QR codes ──────────────────────────────────────────
  const uniqueIds = [...new Set(qrCodeIds)];

  const qrResults = await Promise.all(
    uniqueIds.map((id) => QrCodesService.getById(supabase, orgId, id))
  );

  for (let i = 0; i < qrResults.length; i++) {
    const res = qrResults[i];
    if (!res.success) return jsonError(`Failed to load QR code ${uniqueIds[i]}.`, 500);
    if (!res.data) return jsonError(`QR code not found: ${uniqueIds[i]}`, 404);
    if (res.data.status !== "active") {
      return jsonError(`QR code is revoked and cannot be exported: ${uniqueIds[i]}`, 400);
    }
  }

  const qrCodes = qrResults.map((r) => (r as { success: true; data: QrCode }).data);

  // ─── 4. Generate output ────────────────────────────────────────────────────
  try {
    if (format === "pdf") {
      const items: QrLabelPdfItem[] = await Promise.all(
        qrCodes.map(async (qr) => ({
          qrCodeId: qr.id,
          token: qr.token,
          qrDataUrl: await generateQrPngDataUrl(qr.token),
          primaryText: qr.label ?? "QR Code",
          secondaryText: labelConfig.includeTokenPreview ? qr.token.slice(0, 8) : undefined,
        }))
      );

      const buffer = await generateQrLabelsPdfWithConfig(items, labelConfig);

      emitExportEvent(
        userId,
        orgId,
        qrCodes,
        format,
        labelConfig.dimension,
        labelConfig.includeTokenPreview
      );

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="qr-export.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    // format === "zpl"
    const items: ZplLabelItem[] = qrCodes.map((qr) => ({
      token: qr.token,
      label: qr.label ?? undefined,
      includeTokenPreview: labelConfig.includeTokenPreview,
    }));

    const zpl = generateZplLabels(items, zplSize as ZplLabelSize);

    emitExportEvent(
      userId,
      orgId,
      qrCodes,
      format,
      labelConfig.dimension,
      labelConfig.includeTokenPreview
    );

    return new Response(new TextEncoder().encode(zpl), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="qr-labels.zpl"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[POST /api/qr/export] Generation failed:", err);
    return jsonError("Export generation failed. Please try again.", 500);
  }
}

function emitExportEvent(
  userId: string | null,
  orgId: string,
  qrCodes: QrCode[],
  format: string,
  dimension: { width: number; height: number },
  includeTokenPreview: boolean
) {
  eventService
    .emit({
      actionKey: "qr.labels.exported",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      entityType: "qr_export",
      entityId: orgId,
      metadata: {
        qr_code_ids: qrCodes.map((q) => q.id),
        label_count: qrCodes.length,
        label_size: `${format}:${dimension.width}x${dimension.height}mm`,
        branch_id: null,
      },
      eventTier: "baseline",
    })
    .catch((err) => console.error("[POST /api/qr/export] Event emit failed:", err));
}
