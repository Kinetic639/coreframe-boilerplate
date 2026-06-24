import { useMemo } from "react";
import type { LineDraft, ValidationResult } from "./types";

export function useMovementValidation(
  typeCode: string,
  isPZ: boolean,
  is801: boolean,
  srcLoc: string,
  dstLoc: string,
  lines: LineDraft[]
): ValidationResult {
  return useMemo(() => {
    const documentErrors: string[] = [];
    const positionErrors: string[] = [];

    if (!typeCode) documentErrors.push("Movement type is required");
    if (isPZ && !dstLoc) documentErrors.push("Destination location is required");
    if (is801 && !srcLoc) documentErrors.push("Source location is required");
    if (is801 && !dstLoc) documentErrors.push("Destination location is required");
    if (is801 && srcLoc && srcLoc === dstLoc)
      documentErrors.push("Source and destination cannot be the same");

    if (lines.length === 0) positionErrors.push("Add at least one item position");
    lines.forEach((l, i) => {
      const q = Number(l.quantity);
      if (!l.quantity || q <= 0)
        positionErrors.push(`Line ${i + 1} (${l.sku || "?"}): quantity must be > 0`);
      if (is801 && l.on_hand_at_source !== null && q > l.on_hand_at_source)
        positionErrors.push(
          `Line ${i + 1} (${l.sku}): qty ${q} exceeds available ${l.on_hand_at_source}`
        );
    });

    const allErrors = [...documentErrors, ...positionErrors];
    return { documentErrors, positionErrors, allErrors, isValid: allErrors.length === 0 };
  }, [typeCode, isPZ, is801, srcLoc, dstLoc, lines]);
}
