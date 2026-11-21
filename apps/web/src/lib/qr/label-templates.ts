import type { LabelConfig } from "@/lib/qr/label-config";

/** Shared by client and server (no framework imports). */

export type QrLabelFormat = "pdf" | "zpl";

/** Object types a label template can be for (NULL = blank labels / any). */
export const QR_LABEL_TARGET_TYPES = [
  "warehouse.location",
  "helpdesk.ticket",
  "planning.task",
  "inventory.container",
] as const;
export type QrLabelTargetType = (typeof QR_LABEL_TARGET_TYPES)[number];

/** ZPL printers take 50×30 or 70×40 mm; a ZPL layout's size picks one. */
export function zplSizeForConfig(config: LabelConfig): "50x30" | "70x40" {
  return Math.max(config.dimension.width, config.dimension.height) >= 70 ? "70x40" : "50x30";
}
