import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
  QR_ASSIGN,
} from "@/lib/constants/permissions";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { QrAssignmentsService } from "@/server/services/qr.service";
import { generateStyledQrPngDataUrl, buildQrScanUrl } from "@/lib/qr/generate";
import type { LabelConfig } from "@/lib/qr/label-config";
import {
  PRIMARY_FIELD_KEY,
  SECONDARY_FIELD_KEY,
  TOKEN_FIELD_KEY,
  SCAN_URL_FIELD_KEY,
} from "@/lib/qr/label-config";
import { labelConfigSchema } from "@/lib/qr/label-config-schema";
import { generateQrLabelsPdfWithConfig } from "@/server/qr/label-pdf";
import type { QrLabelPdfItem } from "@/server/qr/label-pdf";
import { generateZplLabels } from "@/lib/qr/zpl";
import type { ZplLabelItem, ZplLabelSize } from "@/lib/qr/zpl";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { eventService } from "@/server/services/event.service";

export const dynamic = "force-dynamic";

const MAX_IDS = 200;
const QR_PREVIEW_CONCURRENCY = 8;

const requestSchema = z.object({
  locationIds: z
    .array(z.string().uuid())
    .min(1, "At least one locationId is required.")
    .max(MAX_IDS, `Cannot export more than ${MAX_IDS} labels at once.`),
  format: z.enum(["pdf", "zpl"]),
  labelConfig: labelConfigSchema,
  zplSize: z.enum(["50x30", "70x40"]).optional().default("50x30"),
});

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

/**
 * POST /api/warehouse/locations/export-labels
 *
 * Generates printable labels (PDF or ZPL) for a set of warehouse locations.
 * Locations without an active QR assignment are auto-provisioned via
 * QrAssignmentsService.createAndAssign — printing a label is the natural
 * trigger for "give this location a QR code" rather than forcing the user
 * through a separate assign step first.
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

  const { locationIds, format, zplSize } = parsed.data;
  const labelConfig = parsed.data.labelConfig as LabelConfig;

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return jsonError("Unauthorized", 401);

  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? null;
  const snapshot = context.user.permissionSnapshot;

  if (!checkPermission(snapshot, WAREHOUSE_LOCATIONS_READ)) {
    return jsonError("You do not have permission to read warehouse locations.", 403);
  }

  const supabase = await createClient();

  const uniqueIds = [...new Set(locationIds)];

  const locationsResult = await WarehouseLocationsService.getByIds(supabase, orgId, uniqueIds);
  if (!locationsResult.success) {
    return jsonError("Failed to load locations.", 500);
  }

  const locationById = new Map(locationsResult.data.map((loc) => [loc.id, loc] as const));
  for (const id of uniqueIds) {
    if (!locationById.has(id)) return jsonError(`Location not found: ${id}`, 404);
  }

  const assignmentsResult = await QrAssignmentsService.getActiveForTargets(
    supabase,
    "warehouse.location",
    uniqueIds
  );
  if (!assignmentsResult.success) {
    return jsonError("Failed to load QR assignments.", 500);
  }

  const unassignedIds = uniqueIds.filter((id) => !assignmentsResult.data.has(id));
  if (unassignedIds.length > 0) {
    if (
      !checkPermission(snapshot, WAREHOUSE_LOCATIONS_MANAGE) ||
      !checkPermission(snapshot, QR_ASSIGN)
    ) {
      return jsonError(
        "Some locations have no QR code assigned yet. You need permission to assign QR codes to print their labels.",
        403
      );
    }
  }

  // Resolve tokens — reuse existing assignments, auto-provision the rest.
  // qr_assignments doesn't store the token itself, so batch-fetch from qr_codes.
  const tokenById = new Map<string, string>();
  if (assignmentsResult.data.size > 0) {
    const { data: qrRows, error: qrErr } = await supabase
      .from("qr_codes")
      .select("id, token")
      .in(
        "id",
        [...assignmentsResult.data.values()].map((a) => a.qr_code_id)
      );
    if (qrErr) return jsonError("Failed to load QR codes.", 500);
    const tokenByQrId = new Map((qrRows ?? []).map((r) => [r.id as string, r.token as string]));
    for (const [locationId, assignment] of assignmentsResult.data) {
      tokenById.set(locationId, tokenByQrId.get(assignment.qr_code_id) ?? "");
    }
  }

  for (const locationId of unassignedIds) {
    const location = locationById.get(locationId)!;
    const result = await QrAssignmentsService.createAndAssign(supabase, orgId, {
      targetType: "warehouse.location",
      targetId: locationId,
      assignedBy: userId ?? "",
      permissionSnapshot: snapshot,
      label: location.name,
    });
    if (!result.success) {
      const error = (result as { success: false; error: string }).error;
      return jsonError(
        `Failed to provision QR code for location "${location.name}": ${error}`,
        500
      );
    }
    tokenById.set(locationId, result.data.qr.token);
  }

  try {
    if (format === "pdf") {
      const items: QrLabelPdfItem[] = await mapWithConcurrency(
        uniqueIds,
        QR_PREVIEW_CONCURRENCY,
        async (locationId) => {
          const location = locationById.get(locationId)!;
          const token = tokenById.get(locationId) ?? "";
          return {
            qrCodeId: locationId,
            token,
            qrDataUrl: await generateStyledQrPngDataUrl(token, labelConfig.qrStyle),
            primaryText: location.name,
            fields: {
              [PRIMARY_FIELD_KEY]: location.name,
              [SECONDARY_FIELD_KEY]: location.code ?? "",
              [TOKEN_FIELD_KEY]: token.slice(0, 10),
              [SCAN_URL_FIELD_KEY]: token ? buildQrScanUrl(token) : "",
            },
          };
        }
      );

      const buffer = await generateQrLabelsPdfWithConfig(items, labelConfig);

      emitExportEvent(userId, orgId, uniqueIds, format, labelConfig.dimension);

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="location-labels.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    // format === "zpl"
    const items: ZplLabelItem[] = uniqueIds.map((locationId) => {
      const location = locationById.get(locationId)!;
      const token = tokenById.get(locationId) ?? "";
      return {
        token,
        fields: {
          [PRIMARY_FIELD_KEY]: location.name,
          [SECONDARY_FIELD_KEY]: location.code ?? "",
          [TOKEN_FIELD_KEY]: token.slice(0, 10),
          [SCAN_URL_FIELD_KEY]: token ? buildQrScanUrl(token) : "",
        },
      };
    });

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

    emitExportEvent(userId, orgId, uniqueIds, format, labelConfig.dimension);

    return new Response(new TextEncoder().encode(zpl), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="location-labels.zpl"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[POST /api/warehouse/locations/export-labels] Generation failed:", err);
    return jsonError("Export generation failed. Please try again.", 500);
  }
}

function emitExportEvent(
  userId: string | null,
  orgId: string,
  locationIds: string[],
  format: string,
  dimension: { width: number; height: number }
) {
  eventService
    .emit({
      actionKey: "warehouse.location_labels.exported",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      entityType: "warehouse_location_label_export",
      entityId: orgId,
      metadata: {
        location_ids: locationIds,
        label_count: locationIds.length,
        label_size: `${format}:${dimension.width}x${dimension.height}mm`,
        branch_id: null,
      },
      eventTier: "baseline",
    })
    .catch((err) =>
      console.error("[POST /api/warehouse/locations/export-labels] Event emit failed:", err)
    );
}
