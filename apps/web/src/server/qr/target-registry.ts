import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { WAREHOUSE_LOCATIONS_MANAGE, WAREHOUSE_LOCATIONS_READ } from "@/lib/constants/permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QrTargetValidationResult {
  valid: boolean;
  organizationId: string | null;
  branchId: string | null;
  error?: "NOT_FOUND" | "WRONG_ORG" | "SOFT_DELETED" | "UNSUPPORTED_TYPE";
}

export interface QrLabelContext {
  primaryText: string;
  secondaryText?: string;
  tertiaryText?: string;
}

export interface QrTargetDescriptor {
  type: string;

  /**
   * Validates that the target exists, belongs to the stated org,
   * and is not soft-deleted. Returns derived branchId on success.
   * Runs with the authenticated Supabase client (RLS enforced).
   */
  validate(params: {
    supabase: SupabaseClient;
    targetId: string;
    orgId: string;
  }): Promise<QrTargetValidationResult>;

  /**
   * Permission the assigning user must hold alongside qr.assign.
   * Checked against permissionSnapshot in the service layer.
   */
  requiredAssignPermission: string;

  /**
   * Permission the reading/exporting user must hold alongside qr.read / qr.export.
   * Checked against permissionSnapshot in the service layer.
   */
  requiredReadPermission: string;

  /**
   * Placeholder resolver path for the Phase 2 scan resolution pipeline.
   * Defined now so the architecture is resolver-ready without committing to a URL.
   */
  resolverPath(params: { targetId: string; orgSlug: string; branchSlug?: string | null }): string;

  /**
   * Returns display fields for printing on the QR label PDF.
   */
  getLabelContext(params: { supabase: SupabaseClient; targetId: string }): Promise<QrLabelContext>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Central registry of all supported QR target types.
 *
 * Phase 1 supports warehouse.location only.
 * Add new entries here (plus a companion migration for any required permissions)
 * to extend the platform to new target types.
 *
 * The registry is the single extension point — no service signatures change
 * when a new target type is added.
 */
export const QR_TARGET_REGISTRY: Readonly<Record<string, QrTargetDescriptor>> = {
  "warehouse.location": {
    type: "warehouse.location",

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, organization_id, branch_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, branchId: null, error: "NOT_FOUND" };
      }
      if (data.deleted_at !== null) {
        return { valid: false, organizationId: null, branchId: null, error: "SOFT_DELETED" };
      }
      if (data.organization_id !== orgId) {
        return { valid: false, organizationId: null, branchId: null, error: "WRONG_ORG" };
      }
      return {
        valid: true,
        organizationId: data.organization_id as string,
        branchId: data.branch_id as string | null,
      };
    },

    requiredAssignPermission: WAREHOUSE_LOCATIONS_MANAGE,
    requiredReadPermission: WAREHOUSE_LOCATIONS_READ,

    resolverPath({ targetId }) {
      // Phase 2 will implement a proper detail/highlight path.
      // Kept deliberately vague to avoid premature URL commitment.
      return `/dashboard/warehouse/locations?highlight=${targetId}`;
    },

    async getLabelContext({ supabase, targetId }) {
      const { data } = await supabase
        .from("warehouse_locations")
        .select("name, code")
        .eq("id", targetId)
        .maybeSingle();

      return {
        primaryText: (data as { name: string } | null)?.name ?? targetId,
        secondaryText: (data as { code: string | null } | null)?.code ?? undefined,
        tertiaryText: "Warehouse Location",
      };
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTargetDescriptor(targetType: string): QrTargetDescriptor | null {
  return QR_TARGET_REGISTRY[targetType] ?? null;
}

export function isSupportedTargetType(targetType: string): boolean {
  return Object.prototype.hasOwnProperty.call(QR_TARGET_REGISTRY, targetType);
}

export const SUPPORTED_TARGET_TYPES = Object.keys(QR_TARGET_REGISTRY);
