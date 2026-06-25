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
import type { CounterpartyDetails } from "@/lib/warehouse/inventory-types";
import type { LineDraft, MovementFormInitialValues, ValidationResult } from "./types";

export function useMovementSubmission(
  mode: "create" | "edit",
  typeCode: string,
  is801: boolean,
  counterpartyName: string,
  counterpartyDetails: CounterpartyDetails | null,
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
        source_location_id: is801 ? l.source_location_id || srcLoc || null : null,
        destination_location_id: l.destination_location_id || dstLoc || null,
        note: null,
      })),
    [lines, is801, srcLoc, dstLoc]
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
        const detailPath = (movementId: string) => ({
          pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
          params: { movementId },
        });

        if (isEdit && initialValues) {
          const payload = {
            movement_id: initialValues.movementId,
            counterparty_name: counterpartyName || null,
            counterparty_details: counterpartyDetails,
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
          toast.success(
            andPost
              ? t("documentPosted", { number: r.data?.document_number ?? "" })
              : t("draftSaved")
          );
          router.push(detailPath(initialValues.movementId));
        } else {
          const bp = {
            movement_type_code: typeCode,
            counterparty_name: counterpartyName || null,
            counterparty_details: counterpartyDetails,
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
            router.push(detailPath(r.data?.movement_id));
          } else {
            const r = (await createDraftMovementAction(bp)) as any;
            if (!r.success) {
              toast.error(r.error ?? t("failed"));
              return;
            }
            toast.success(t("draftCreated", { number: r.data?.draft_number ?? "" }));
            router.push(detailPath(r.data?.movement_id));
          }
        }
      });
    },
    [
      buildLines,
      counterpartyDetails,
      counterpartyName,
      externalReference,
      initialValues,
      isEdit,
      note,
      router,
      t,
      typeCode,
      validation,
    ]
  );

  return { isPending, submit };
}
