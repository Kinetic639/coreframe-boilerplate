import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_CREATE, QR_EXPORT } from "@/lib/constants/permissions";
import type { LabelConfig } from "@/lib/qr/label-config";
import { PRIMARY_FIELD_KEY, TOKEN_FIELD_KEY, SCAN_URL_FIELD_KEY } from "@/lib/qr/label-config";
import { labelConfigSchema } from "@/lib/qr/label-config-schema";
import { buildQrScanUrl } from "@/lib/qr/generate";
import type { QrCode } from "@/server/services/qr.service";
import {
  QrLabelLayoutsService,
  QrPrintBatchesService,
  zplSizeForConfig,
} from "@/server/services/qr-labels.service";
import { renderQrLabels, labelsResponse } from "@/server/qr/render-labels";
import { parseZplSize, type ZplLabelSize } from "@/lib/qr/label-templates";
import { verifiedTemplateId } from "@/server/qr/record-print";
import { eventService } from "@/server/services/event.service";

export const dynamic = "force-dynamic";

/** Blank labels per print run. The batch table allows 1000; PDFs get slow. */
export const MAX_PRINT_QUANTITY = 500;

const requestSchema = z.discriminatedUnion("mode", [
  // New blank labels: the codes are made now, as one batch.
  z.object({
    mode: z.literal("new"),
    quantity: z.number().int().min(1).max(MAX_PRINT_QUANTITY),
    name: z.string().trim().max(120).nullish(),
    templateId: z.string().uuid().nullish(),
    format: z.enum(["pdf", "zpl"]),
    labelConfig: labelConfigSchema,
    zplSize: z
      .string()
      .refine((value) => parseZplSize(value) !== null, "Unsupported ZPL label size.")
      .optional(),
  }),
  // The same print run again: same codes, same layout, no new tokens.
  z.object({
    mode: z.literal("again"),
    batchId: z.string().uuid(),
  }),
]);

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function itemsFor(codes: QrCode[]) {
  return codes.map((qr) => ({
    id: qr.id,
    token: qr.token,
    primaryText: qr.label ?? "",
    fields: {
      [PRIMARY_FIELD_KEY]: qr.label ?? "",
      [TOKEN_FIELD_KEY]: qr.token.slice(0, 10),
      [SCAN_URL_FIELD_KEY]: buildQrScanUrl(qr.token),
    },
  }));
}

/**
 * POST /api/qr/print -- blank QR labels from the label generator.
 *
 * "new" needs qr.create + qr.export and makes `quantity` codes as one print
 * batch with the layout (and template) recorded. "again" re-renders a batch
 * from its stored layout with the codes it made (qr.export).
 */
export async function POST(request: NextRequest) {
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

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return jsonError("Unauthorized", 401);
  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? null;
  const snapshot = context.user.permissionSnapshot;

  if (!checkPermission(snapshot, QR_EXPORT)) {
    return jsonError("You do not have permission to print QR labels.", 403);
  }

  const supabase = await createClient();
  const input = parsed.data;

  if (input.mode === "again") {
    const batch = await QrPrintBatchesService.get(supabase, orgId, input.batchId);
    if (!batch.success) return jsonError("Failed to load the print run.", 500);
    if (!batch.data || batch.data.kind !== "new") {
      return jsonError("Print run not found.", 404);
    }
    if (!batch.data.layout) return jsonError("The layout of this print run is gone.", 409);

    const codes = await QrPrintBatchesService.listCodes(supabase, orgId, batch.data.id);
    if (!codes.success) return jsonError("Failed to load QR codes.", 500);
    if (codes.data.length === 0) {
      return jsonError("No active codes are left in this print run.", 409);
    }

    try {
      const layout = batch.data.layout;
      const rendered = await renderQrLabels(
        itemsFor(codes.data),
        layout.format,
        layout.config,
        zplSizeForConfig(layout.config)
      );
      return labelsResponse(rendered, "qr-labels", { "X-Qr-Batch-Id": batch.data.id });
    } catch (err) {
      console.error("[POST /api/qr/print] Generation failed:", err);
      return jsonError("Label generation failed. Please try again.", 500);
    }
  }

  if (!checkPermission(snapshot, QR_CREATE)) {
    return jsonError("You do not have permission to create QR codes.", 403);
  }

  const labelConfig = input.labelConfig as LabelConfig;
  const zplSize = (input.zplSize as ZplLabelSize | undefined) ?? zplSizeForConfig(labelConfig);

  const layout = await QrLabelLayoutsService.ensure(orgId, input.format, labelConfig, userId);
  if (!layout.success) return jsonError("Failed to save the label layout.", 500);

  const created = await QrPrintBatchesService.createNew(supabase, orgId, {
    quantity: input.quantity,
    name: input.name ?? null,
    layoutId: layout.data,
    templateId: await verifiedTemplateId(supabase, orgId, input.templateId),
    userId,
  });
  if (!created.success) {
    console.error("[POST /api/qr/print] Batch failed:", (created as { error: string }).error);
    return jsonError("Failed to create QR codes.", 500);
  }

  const { batch, codes } = created.data;

  eventService
    .emit({
      actionKey: "qr.labels.exported",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      entityType: "qr_export",
      entityId: orgId,
      metadata: {
        batch_id: batch.id,
        qr_code_ids: codes.map((qr) => qr.id),
        label_count: codes.length,
        label_size: `${input.format}:${labelConfig.dimension.width}x${labelConfig.dimension.height}mm`,
        branch_id: null,
      },
      eventTier: "baseline",
    })
    .catch((err) => console.error("[POST /api/qr/print] Event emit failed:", err));

  try {
    const rendered = await renderQrLabels(itemsFor(codes), input.format, labelConfig, zplSize);
    return labelsResponse(rendered, "qr-labels", { "X-Qr-Batch-Id": batch.id });
  } catch (err) {
    // The codes exist; the run can be printed again from the batch list.
    console.error("[POST /api/qr/print] Generation failed:", err);
    return jsonError("Codes were created but the labels failed. Print the run again.", 500);
  }
}
