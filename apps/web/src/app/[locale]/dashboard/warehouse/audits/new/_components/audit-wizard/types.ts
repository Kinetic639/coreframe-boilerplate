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
 * A (variant, location) pair absent here has no balance row at all, which is
 * exactly the set the count-session RPC's zero-stock seeding step targets;
 * a pair that already has a zero-quantity row must NOT be double-counted as
 * "would add a new zero-stock line" since it's already seeded unconditionally
 * by the RPC's primary balance-based branch. */
export interface WizardStockIndexRow {
  variantId: string;
  locationId: string;
  supplierId: string | null;
}
