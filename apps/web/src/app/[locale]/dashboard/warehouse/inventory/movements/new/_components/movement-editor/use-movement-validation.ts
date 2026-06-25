import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { LineDraft, ValidationResult } from "./types";

export function useMovementValidation(
  typeCode: string,
  isPZ: boolean,
  is801: boolean,
  srcLoc: string,
  dstLoc: string,
  lines: LineDraft[]
): ValidationResult {
  const t = useTranslations("warehouseInventory.movementEditor");
  return useMemo(() => {
    const documentErrors: string[] = [];
    const positionErrors: string[] = [];

    if (!typeCode) documentErrors.push(t("movementTypeRequired"));

    if (isPZ && !dstLoc) positionErrors.push(t("destLocationRequired"));
    if (is801 && !srcLoc) positionErrors.push(t("srcLocationRequired"));
    if (is801 && !dstLoc) positionErrors.push(t("destLocationRequired"));
    if (is801 && srcLoc && srcLoc === dstLoc) positionErrors.push(t("srcDestSame"));
    if (lines.length === 0) positionErrors.push(t("addAtLeastOneItem"));
    lines.forEach((l, i) => {
      const q = Number(l.quantity);
      if (!l.quantity || q <= 0)
        positionErrors.push(t("lineQtyPositive", { num: i + 1, sku: l.sku || "?" }));
      if (is801 && l.on_hand_at_source !== null && q > l.on_hand_at_source)
        positionErrors.push(
          t("lineExceedsAvailable", { num: i + 1, sku: l.sku, qty: q, avail: l.on_hand_at_source })
        );
    });

    const allErrors = [...documentErrors, ...positionErrors];
    return { documentErrors, positionErrors, allErrors, isValid: allErrors.length === 0 };
  }, [typeCode, isPZ, is801, srcLoc, dstLoc, lines, t]);
}
