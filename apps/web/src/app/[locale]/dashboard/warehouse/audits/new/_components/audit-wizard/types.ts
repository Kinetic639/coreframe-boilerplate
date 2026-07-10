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

/** One row per (variant, location) with positive on-hand stock — the raw
 * material used to compute the live "zero-stock items in scope" count as
 * the counter changes their location/supplier selection, without a network
 * round trip per keystroke. Zero/absent balances are never included, so
 * "not present here" already means zero stock. */
export interface WizardStockIndexRow {
  variantId: string;
  locationId: string;
  supplierId: string | null;
}
