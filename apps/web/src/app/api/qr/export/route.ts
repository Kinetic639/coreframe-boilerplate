import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_EXPORT } from "@/lib/constants/permissions";
import { QrCodesService } from "@/server/services/qr.service";
import type { QrCode } from "@/server/services/qr.service";
import { generateStyledQrPngDataUrl, buildQrScanUrl } from "@/lib/qr/generate";
import type { LabelConfig } from "@/lib/qr/label-config";
import { PRIMARY_FIELD_KEY, TOKEN_FIELD_KEY, SCAN_URL_FIELD_KEY } from "@/lib/qr/label-config";
import { generateQrLabelsPdfWithConfig } from "@/server/qr/label-pdf";
import type { QrLabelPdfItem } from "@/server/qr/label-pdf";
import { generateZplLabels } from "@/lib/qr/zpl";
import type { ZplLabelItem, ZplLabelSize } from "@/lib/qr/zpl";
import { eventService } from "@/server/services/event.service";
import { labelConfigSchema } from "@/lib/qr/label-config-schema";

export const dynamic = "force-dynamic";

const MAX_IDS = 200;
const QR_PREVIEW_CONCURRENCY = 8;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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

  const { qrCodeIds, format, zplSize } = parsed.data;
  const labelConfig = parsed.data.labelConfig as LabelConfig;

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

  const qrResult = await QrCodesService.getByIds(supabase, orgId, uniqueIds);
  if (!qrResult.success) {
    return jsonError("Failed to load QR codes.", 500);
  }

  const qrById = new Map(qrResult.data.map((qr) => [qr.id, qr] as const));
  const qrCodes: QrCode[] = [];

  for (const id of uniqueIds) {
    const qr = qrById.get(id);
    if (!qr) return jsonError(`QR code not found: ${id}`, 404);
    if (qr.status !== "active") {
      return jsonError(`QR code is revoked and cannot be exported: ${id}`, 400);
    }
    qrCodes.push(qr);
  }

  // ─── 4. Generate output ────────────────────────────────────────────────────
  try {
    if (format === "pdf") {
      const items: QrLabelPdfItem[] = await mapWithConcurrency(
        qrCodes,
        QR_PREVIEW_CONCURRENCY,
        async (qr) => ({
          qrCodeId: qr.id,
          token: qr.token,
          qrDataUrl: await generateStyledQrPngDataUrl(qr.token, labelConfig.qrStyle),
          primaryText: qr.label ?? "QR Code",
          fields: {
            [PRIMARY_FIELD_KEY]: qr.label ?? "QR Code",
            [TOKEN_FIELD_KEY]: qr.token.slice(0, 10),
            [SCAN_URL_FIELD_KEY]: buildQrScanUrl(qr.token),
          },
        })
      );

      const buffer = await generateQrLabelsPdfWithConfig(items, labelConfig);

      emitExportEvent(userId, orgId, qrCodes, format, labelConfig.dimension, labelConfig);

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
      fields: {
        [PRIMARY_FIELD_KEY]: qr.label ?? "QR Code",
        [TOKEN_FIELD_KEY]: qr.token.slice(0, 10),
        [SCAN_URL_FIELD_KEY]: buildQrScanUrl(qr.token),
      },
    }));

    const thermalBaseDimension =
      zplSize === "50x30" ? { width: 50, height: 30 } : { width: 70, height: 40 };

    const zpl = await generateZplLabels(items, zplSize as ZplLabelSize, {
      ...labelConfig,
      dimension: {
        width:
          labelConfig.orientation === "portrait"
            ? thermalBaseDimension.height
            : thermalBaseDimension.width,
        height:
          labelConfig.orientation === "portrait"
            ? thermalBaseDimension.width
            : thermalBaseDimension.height,
      },
    });

    emitExportEvent(userId, orgId, qrCodes, format, labelConfig.dimension, labelConfig);

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
  labelConfig: LabelConfig
) {
  const hasTokenLine = labelConfig.textLines.some(
    (line) => line.source === "field" && line.fieldKey === TOKEN_FIELD_KEY
  );
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
        token_text_enabled: hasTokenLine,
        branch_id: null,
      },
      eventTier: "baseline",
    })
    .catch((err) => console.error("[POST /api/qr/export] Event emit failed:", err));
}
