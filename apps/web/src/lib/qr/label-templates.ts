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

/**
 * A ZPL label size, "WIDTHxHEIGHT" in whole millimetres as the label runs
 * through the printer: width across the print head (the longer side), height
 * along the feed. Portrait layouts are turned onto it.
 */
export type ZplLabelSize = `${number}x${number}`;

/** Common thermal label sizes, offered as presets in the designer. */
export const ZPL_SIZE_PRESETS: readonly ZplLabelSize[] = ["50x30", "70x40", "70x50", "100x50"];
/** The GK420 family prints at most 104 mm across. */
export const ZPL_MAX_WIDTH_MM = 104;
export const ZPL_MIN_SIDE_MM = 15;
export const ZPL_MAX_HEIGHT_MM = 200;

export function parseZplSize(size: string): { width: number; height: number } | null {
  const match = /^(\d{2,3})x(\d{2,3})$/.exec(size);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < ZPL_MIN_SIDE_MM || height < ZPL_MIN_SIDE_MM) return null;
  if (width > ZPL_MAX_WIDTH_MM || height > ZPL_MAX_HEIGHT_MM) return null;
  return { width, height };
}

/** The ZPL size of a label of the given dimension in mm (either orientation). */
export function zplSizeOf(width: number, height: number): ZplLabelSize {
  const long = Math.round(Math.max(width, height));
  const short = Math.round(Math.min(width, height));
  return `${Math.min(long, ZPL_MAX_WIDTH_MM)}x${short}` as ZplLabelSize;
}

/** A ZPL layout keeps its own size in its dimension. */
export function zplSizeForConfig(config: LabelConfig): ZplLabelSize {
  return zplSizeOf(config.dimension.width, config.dimension.height);
}
