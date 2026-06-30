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
          if (andPost) {
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

  return { isPending, submit };
}
