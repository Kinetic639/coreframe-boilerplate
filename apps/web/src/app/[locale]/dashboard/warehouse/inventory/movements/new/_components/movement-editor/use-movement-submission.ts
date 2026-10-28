import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import {
  createAndPostMovementAction,
  createDraftMovementAction,
  saveDraftMovementAction,
  saveAndPostDraftMovementAction,
} from "@/app/actions/warehouse/inventory";
import { createUnitTransferAction } from "@/app/actions/warehouse/internal-orders";
import type { MovementPartyDetails } from "@/lib/warehouse/inventory-types";
import { toMovementRouteKey } from "@/lib/warehouse/movement-route-key";
import type { LineDraft, MovementFormInitialValues, ValidationResult } from "./types";

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
  // MMJ- (303): not posted here -- it waits for the "wyślij w drogę / wstrzymaj" choice.
  const [transferPrompt, setTransferPrompt] = useState(false);

  const buildLines = useCallback(
    () =>
      lines.map((l) => ({
        variant_id: l.variant_id,
        unit_id: l.unit_id,
        quantity: Number(l.quantity),
        source_location_id: requiresSourceLocation ? l.source_location_id || srcLoc || null : null,
        destination_location_id: l.destination_location_id || dstLoc || null,
        note: l.note ?? null,
        source_type: l.source_type ?? null,
        source_line_id: l.source_line_id ?? null,
        source_order_number: l.source_order_number ?? null,
        source_product_code: l.source_product_code ?? l.sku ?? null,
      })),
    [lines, requiresSourceLocation, srcLoc, dstLoc]
  );

  const submit = useCallback(
    (andPost: boolean) => {
      if (typeCode === "303" && !isEdit) {
        if (!validation.isValid) {
          toast.error(t("cannotPost", { count: validation.allErrors.length }));
          return;
        }
        if (!recipientDetails?.branchId) {
          toast.error(t("unitTransferNoBranch"));
          return;
        }
        setTransferPrompt(true);
        return;
      }
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
          if (andPost) {
            const r = (await createAndPostMovementAction(bp)) as any;
            if (!r.success) {
              toast.error(r.error ?? t("failed"));
              return;
            }
            toast.success(t("documentPosted", { number: r.data?.document_number ?? "" }));
            const attribution = r.data?.attribution as
              | { attributed: number; skipped: number; failed?: undefined }
              | { failed: true }
              | null
              | undefined;
            if (attribution && "failed" in attribution && attribution.failed) {
              // Posted, but the parts could not be linked to their repair orders
              toast.warning(t("receiptAttributionFailed"), { autoClose: false });
            } else if (attribution && !("failed" in attribution && attribution.failed)) {
              ((attribution as { skipped: number }).skipped > 0 ? toast.warning : toast.info)(
                t("receiptAttribution", {
                  attributed: (attribution as { attributed: number }).attributed,
                  skipped: (attribution as { skipped: number }).skipped,
                })
              );
            }
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
      externalReference,
      initialValues,
      isEdit,
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

  /** "Tak — wyślij w drogę" (send = true) or "Nie — wstrzymaj" (a draft). */
  const confirmTransfer = useCallback(
    (send: boolean) => {
      startTransition(async () => {
        const r = (await createUnitTransferAction({
          destinationBranchId: recipientDetails?.branchId ?? "",
          notes: note || null,
          send,
          lines: buildLines().map((l) => ({
            variantId: l.variant_id,
            sourceLocationId: l.source_location_id ?? "",
            unitId: l.unit_id,
            quantity: l.quantity,
          })),
        })) as { success: boolean; error?: string };
        setTransferPrompt(false);
        if (!r.success) {
          toast.error(t("unitTransferFailed"));
          return;
        }
        toast.success(t(send ? "unitTransferSent" : "unitTransferHeld"));
        router.push("/dashboard/warehouse/inventory/movements");
        router.refresh();
      });
    },
    [buildLines, note, recipientDetails, router, t]
  );

  return {
    isPending,
    submit,
    transferPrompt,
    confirmTransfer,
    cancelTransferPrompt: () => setTransferPrompt(false),
  };
}
