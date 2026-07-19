export interface WizardLocationOption {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  level: number;
  /** Distinct variants with positive on-hand stock at this exact location
   * (not including descendants) — the count of lines the audit would
   * generate here without "include zero-stock" on. */
  inStockCount: number;
  /** Distinct variants with a tracked balance row at this exact location
   * that currently reads zero — assigned here, but empty. */
  zeroStockCount: number;
}

export interface WizardSupplierOption {
  id: string;
  name: string;
}

/** One row per (variant, location) that already has a tracked balance row —
 * positive OR zero on-hand — the raw material used to compute the live
 * "zero-stock items in scope" count as the counter changes their
 * location/supplier selection, without a network round trip per keystroke.
 * The count-session RPC only ever seeds lines from EXISTING balance rows —
 * it never invents a line for a (variant, location) pair with no tracked
 * relationship at all — so "how many zero-stock lines would
 * include-zero-stock add" is exactly "how many rows here are already zero",
 * scoped to the selected locations/supplier. */
export interface WizardStockIndexRow {
  variantId: string;
  locationId: string;
  supplierId: string | null;
  supplierIds?: string[];
  isZero: boolean;
}
