import { useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import {
  createAndPostMovementAction,
  createDraftMovementAction,
  saveDraftMovementAction,
  saveAndPostDraftMovementAction,
} from "@/app/actions/warehouse/inventory";
import { receiveRepairOrderStockAction } from "@/app/actions/warehouse/repair-order-receiving";
import type { MovementPartyDetails } from "@/lib/warehouse/inventory-types";
import { toMovementRouteKey } from "@/lib/warehouse/movement-route-key";
import type { LineDraft, MovementFormInitialValues, ValidationResult } from "./types";

/**
 * Zone 5 Phase 4 wiring (narrowest correct integration point, per external
 * review): a NEW (not edit), Save & Post, movement-type-101 submission where
 * at least one line carries a resolvable `source_line_id` (set by the
 * Matcher import dialog -- see movement-import-dialog.tsx /
 * use-movement-form-state.ts's applyImportedDocument, which already keeps
 * this field in memory today, per the Zone 5 discovery pass) routes through
 * the RepairOrder-aware receive_repair_order_stock RPC instead of the
 * generic createAndPostMovementAction. Every other case -- draft-only saves,
 * edit mode, any other movement type, or a plain 101 with no
 * RepairOrder-resolvable line -- is completely unchanged and continues
 * through the existing generic path below. This is a deliberately narrow
 * scope: receive_repair_order_stock only supports immediate create+post
 * (matching inventory_create_and_finalize), so draft-only RepairOrder
 * receiving is not wired this pass and still uses the generic path (its
 * attribution is simply not captured in that case -- a disclosed limitation,
 * not a silent one).
 */
function hasResolvableSourceLine(lines: LineDraft[]): boolean {
  return lines.some((l) => Boolean(l.source_line_id));
}

export function useMovementSubmission(
  mode: "create" | "edit",
  typeCode: string,
  requiresSourceLocation: boolean,
  senderName: string,
  senderDetails: MovementPartyDetails | null,
  recipientName: string,
  recipientDetails: MovementPartyDetails | null,
  externalReference: string,
  note: string,
  srcLoc: string,
  dstLoc: string,
  lines: LineDraft[],
  validation: ValidationResult,
  initialValues?: MovementFormInitialValues
) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  const buildLines = useCallback(
    () =>
      lines.map((l) => ({
        variant_id: l.variant_id,
        unit_id: l.unit_id,
        quantity: Number(l.quantity),
        source_location_id: requiresSourceLocation ? l.source_location_id || srcLoc || null : null,
        destination_location_id: l.destination_location_id || dstLoc || null,
        note: l.note ?? null,
      })),
    [lines, requiresSourceLocation, srcLoc, dstLoc]
  );

  /** Zone 5: same lines, but keeping source_line_id for the RepairOrder-aware
   * receipt path (the generic buildLines() above deliberately excludes it,
   * since the generic engine/movement editor has no concept of it). */
  const buildReceiptLines = useCallback(
    () =>
      lines.map((l) => ({
        variant_id: l.variant_id,
        unit_id: l.unit_id,
        quantity: Number(l.quantity),
        source_line_id: l.source_line_id ?? null,
      })),
    [lines]
  );

  const submit = useCallback(
    (andPost: boolean) => {
      if (andPost && !validation.isValid) {
        toast.error(t("cannotPost", { count: validation.allErrors.length }));
        return;
      }
      if (!andPost && !typeCode) {
        toast.error(t("selectTypeFirstToast"));
        return;
      }

      startTransition(async () => {
        const ls = buildLines();
        const detailPath = (routeKey: string) => ({
          pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
          params: { movementId: routeKey },
        });

        if (isEdit && initialValues) {
          const payload = {
            movement_id: initialValues.movementId,
            sender_name: senderName || null,
            sender_details: senderDetails,
            recipient_name: recipientName || null,
            recipient_details: recipientDetails,
            external_reference: externalReference || null,
            note: note || null,
            lines: ls,
          };
          const r = andPost
            ? ((await saveAndPostDraftMovementAction(payload)) as any)
            : ((await saveDraftMovementAction(payload)) as any);
          if (!r.success) {
            toast.error(r.error ?? t("failed"));
            return;
          }
          const routeKey =
            r.data?.route_key ??
            toMovementRouteKey(
              r.data?.document_number ?? r.data?.draft_number ?? initialValues.draftNumber
            );
          toast.success(
            andPost
              ? t("documentPosted", { number: r.data?.document_number ?? "" })
              : t("draftSaved")
          );
          router.push(detailPath(routeKey));
        } else {
          const bp = {
            movement_type_code: typeCode,
            sender_name: senderName || null,
            sender_details: senderDetails,
            recipient_name: recipientName || null,
            recipient_details: recipientDetails,
            external_reference: externalReference || null,
            note: note || null,
            idempotency_key: crypto.randomUUID(),
            lines: ls,
          };
          if (andPost && typeCode === "101" && hasResolvableSourceLine(lines)) {
            // Zone 5 Phase 4: route through the RepairOrder-aware receipt RPC.
            // Ordinary 101s (no source_line_id on any line) fall through to
            // the unchanged generic path below.
            const r = (await receiveRepairOrderStockAction({
              lines: buildReceiptLines(),
              external_reference: externalReference || null,
              note: note || null,
            })) as any;
            if (!r.success) {
              toast.error(r.error ?? t("failed"));
              return;
            }
            toast.success(t("documentPosted", { number: r.data?.document_number ?? "" }));
            router.push(
              detailPath(r.data?.route_key ?? toMovementRouteKey(r.data?.document_number))
            );
          } else if (andPost) {
            const r = (await createAndPostMovementAction(bp)) as any;
            if (!r.success) {
              toast.error(r.error ?? t("failed"));
              return;
            }
            toast.success(t("documentPosted", { number: r.data?.document_number ?? "" }));
            router.push(
              detailPath(r.data?.route_key ?? toMovementRouteKey(r.data?.document_number))
            );
          } else {
            const r = (await createDraftMovementAction(bp)) as any;
            if (!r.success) {
              toast.error(r.error ?? t("failed"));
              return;
            }
            toast.success(t("draftCreated", { number: r.data?.draft_number ?? "" }));
            router.push(detailPath(r.data?.route_key ?? toMovementRouteKey(r.data?.draft_number)));
          }
        }
      });
    },
    [
      buildLines,
      buildReceiptLines,
      externalReference,
      initialValues,
      isEdit,
      lines,
      note,
      recipientDetails,
      recipientName,
      router,
      senderDetails,
      senderName,
      t,
      typeCode,
      validation,
    ]
  );

  return { isPending, submit };
}
