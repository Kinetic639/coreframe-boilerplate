import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_EXPORT } from "@/lib/constants/permissions";
import { QrCodesService, QrAssignmentsService } from "@/server/services/qr.service";
import type { QrCode, QrAssignment } from "@/server/services/qr.service";
import { getTargetDescriptor } from "@/server/qr/target-registry";
import { generateQrPngDataUrl } from "@/lib/qr/generate";
import { generateQrLabelsPdf } from "@/server/qr/label-pdf";
import type { QrLabelSize, QrLabelPdfItem } from "@/server/qr/label-pdf";
import { eventService } from "@/server/services/event.service";

export const dynamic = "force-dynamic";

const MAX_LABEL_COUNT = 200;

const requestSchema = z.object({
  qrCodeIds: z
    .array(z.string().uuid({ message: "Each qrCodeId must be a valid UUID." }))
    .min(1, { message: "At least one qrCodeId is required." })
    .max(MAX_LABEL_COUNT, {
      message: `Cannot export more than ${MAX_LABEL_COUNT} labels at once.`,
    }),
  labelSize: z.enum(["50x30", "70x40", "a4-grid"] as const, {
    errorMap: () => ({ message: "labelSize must be one of: 50x30, 70x40, a4-grid." }),
  }),
});

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

/**
 * POST /api/qr/labels
 *
 * Generates and returns a PDF containing printable QR labels.
 *
 * Security model:
 * - Auth via loadDashboardContextV2 (never trusts client-provided org/branch)
 * - Requires qr.export permission
 * - Requires target-level read permission (warehouse.locations.read for Phase 1)
 * - Only exports QR codes that belong to the active org, are active, and have
 *   an active assignment pointing to a valid target
 *
 * Returns application/pdf on success.
 * Emits qr.labels.exported audit event (best-effort, failure does not break response).
 */
export async function POST(request: NextRequest) {
  // ─── 1. Parse + validate request body ─────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message ?? "Invalid request body.";
    return jsonError(firstIssue, 400);
  }

  const { qrCodeIds, labelSize } = parseResult.data;

  // ─── 2. Auth + context ─────────────────────────────────────────────────────
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) {
    return jsonError("Unauthorized", 401);
  }

  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? null;
  const snapshot = context.user.permissionSnapshot;

  // ─── 3. QR-level permission ────────────────────────────────────────────────
  if (!checkPermission(snapshot, QR_EXPORT)) {
    return jsonError("You do not have permission to export QR labels.", 403);
  }

  const supabase = await createClient();

  // ─── 4. Load + validate each QR code ──────────────────────────────────────
  // Deduplicate IDs to avoid double-loading
  const uniqueIds = [...new Set(qrCodeIds)];

  const qrLoadResults = await Promise.all(
    uniqueIds.map((id) => QrCodesService.getById(supabase, orgId, id))
  );

  for (let i = 0; i < qrLoadResults.length; i++) {
    const res = qrLoadResults[i];
    if (!res.success) {
      return jsonError(
        `Failed to load QR code ${uniqueIds[i]}: ${(res as { success: false; error: string }).error}`,
        500
      );
    }
    if (!res.data) {
      return jsonError(`QR code not found or not accessible: ${uniqueIds[i]}`, 404);
    }
    if (res.data.status !== "active") {
      return jsonError(`QR code is revoked and cannot be exported: ${uniqueIds[i]}`, 400);
    }
  }

  const qrCodes = qrLoadResults.map((r) => (r as { success: true; data: QrCode }).data);

  // ─── 5. Load active assignments ────────────────────────────────────────────
  const assignmentResults = await Promise.all(
    qrCodes.map((qr) => QrAssignmentsService.getActiveForQr(supabase, qr.id))
  );

  for (let i = 0; i < assignmentResults.length; i++) {
    const res = assignmentResults[i];
    if (!res.success) {
      return jsonError(
        `Failed to load assignment for QR code ${qrCodes[i].id}: ${(res as { success: false; error: string }).error}`,
        500
      );
    }
    if (!res.data) {
      return jsonError(
        `QR code ${qrCodes[i].id} does not have an active assignment and cannot be exported.`,
        400
      );
    }
  }

  const assignments = assignmentResults.map(
    (r) => (r as { success: true; data: QrAssignment }).data
  );

  // ─── 6. Permission + registry check per target type ───────────────────────
  for (const assignment of assignments) {
    const descriptor = getTargetDescriptor(assignment.target_type);
    if (!descriptor) {
      return jsonError(`Unsupported target type in assignment: ${assignment.target_type}`, 400);
    }
    if (!checkPermission(snapshot, descriptor.requiredReadPermission)) {
      return jsonError("You do not have permission to export labels for this target type.", 403);
    }
  }

  // ─── 7. Build label items ──────────────────────────────────────────────────
  const items: QrLabelPdfItem[] = await Promise.all(
    qrCodes.map(async (qr, idx) => {
      const assignment = assignments[idx];
      const descriptor = getTargetDescriptor(assignment.target_type)!;

      const [qrDataUrl, labelContext] = await Promise.all([
        generateQrPngDataUrl(qr.token),
        descriptor.getLabelContext({ supabase, targetId: assignment.target_id }),
      ]);

      return {
        qrCodeId: qr.id,
        token: qr.token,
        qrDataUrl,
        primaryText: labelContext.primaryText,
        secondaryText: labelContext.secondaryText,
        tertiaryText: labelContext.tertiaryText,
      };
    })
  );

  // ─── 8. Generate PDF ───────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateQrLabelsPdf({ items, size: labelSize as QrLabelSize });
  } catch (err) {
    console.error("[POST /api/qr/labels] PDF generation failed:", err);
    return jsonError("PDF generation failed. Please try again.", 500);
  }

  // ─── 9. Emit audit event (best-effort) ────────────────────────────────────
  const uniqueBranchIds = [...new Set(assignments.map((a) => a.branch_id).filter(Boolean))];
  const branchIdForEvent = uniqueBranchIds.length === 1 ? uniqueBranchIds[0] : null;

  eventService
    .emit({
      actionKey: "qr.labels.exported",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      branchId: branchIdForEvent ?? undefined,
      entityType: "qr_export",
      entityId: orgId,
      metadata: {
        qr_code_ids: qrCodes.map((qr) => qr.id),
        label_count: items.length,
        label_size: labelSize,
        branch_id: branchIdForEvent ?? null,
      },
      eventTier: "baseline",
    })
    .catch((err) => {
      console.error("[POST /api/qr/labels] Failed to emit qr.labels.exported:", err);
    });

  // ─── 10. Return PDF ────────────────────────────────────────────────────────
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="qr-labels.pdf"',
      "Cache-Control": "no-store, no-cache",
    },
  });
}
