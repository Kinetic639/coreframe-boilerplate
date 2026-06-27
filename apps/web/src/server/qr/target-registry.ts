import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { WAREHOUSE_LOCATIONS_MANAGE, WAREHOUSE_LOCATIONS_READ } from "@/lib/constants/permissions";
import { HELPDESK_TICKETS_MANAGE, HELPDESK_TICKETS_READ } from "@/lib/constants/permissions";
import { PLANNING_TASKS_UPDATE, PLANNING_TASKS_READ } from "@/lib/constants/permissions";

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
   * Synchronous redirect path. Used when no DB lookup is needed to build the URL.
   */
  resolverPath(params: { targetId: string; orgSlug: string; branchSlug?: string | null }): string;

  /**
   * Optional async redirect path override. When present, takes precedence over
   * resolverPath. Use when the URL requires a secondary DB lookup (e.g. fetching
   * a human-readable slug like ticket_number).
   */
  resolvePathAsync?(params: {
    supabase: SupabaseClient;
    targetId: string;
    orgSlug: string;
    branchSlug?: string | null;
  }): Promise<string>;

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
      return `/dashboard/warehouse/ambra-locations?selected=${targetId}&view=tree`;
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
  "helpdesk.ticket": {
    type: "helpdesk.ticket",

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("id, org_id, branch_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, branchId: null, error: "NOT_FOUND" };
      }
      if (data.deleted_at !== null) {
        return { valid: false, organizationId: null, branchId: null, error: "SOFT_DELETED" };
      }
      if (data.org_id !== orgId) {
        return { valid: false, organizationId: null, branchId: null, error: "WRONG_ORG" };
      }
      return {
        valid: true,
        organizationId: data.org_id as string,
        branchId: (data.branch_id as string | null) ?? null,
      };
    },

    requiredAssignPermission: HELPDESK_TICKETS_MANAGE,
    requiredReadPermission: HELPDESK_TICKETS_READ,

    resolverPath({ targetId }) {
      // Fallback — resolvePathAsync is always available so this is never reached.
      return `/dashboard/help-desk/tickets?highlight=${targetId}`;
    },

    async resolvePathAsync({ supabase, targetId }) {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("ticket_number")
        .eq("id", targetId)
        .maybeSingle();
      const number = (data as { ticket_number: string } | null)?.ticket_number ?? targetId;
      return `/dashboard/help-desk/tickets/${number}`;
    },

    async getLabelContext({ supabase, targetId }) {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("ticket_number, title, status")
        .eq("id", targetId)
        .maybeSingle();

      const ticket = data as { ticket_number: string; title: string; status: string } | null;
      return {
        primaryText: ticket?.ticket_number ?? targetId,
        secondaryText: ticket?.title ?? undefined,
        tertiaryText: ticket ? `Status: ${ticket.status}` : "Help Desk Ticket",
      };
    },
  },

  "planning.task": {
    type: "planning.task",

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("planning_tasks")
        .select("id, organization_id, branch_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, branchId: null, error: "NOT_FOUND" };
      }
      if (data.deleted_at !== null) {
        return { valid: false, organizationId: null, branchId: null, error: "SOFT_DELETED" };
      }
      if ((data as any).organization_id !== orgId) {
        return { valid: false, organizationId: null, branchId: null, error: "WRONG_ORG" };
      }
      return {
        valid: true,
        organizationId: (data as any).organization_id as string,
        branchId: ((data as any).branch_id as string | null) ?? null,
      };
    },

    requiredAssignPermission: PLANNING_TASKS_UPDATE,
    requiredReadPermission: PLANNING_TASKS_READ,

    resolverPath({ targetId }) {
      return `/dashboard/planning/tasks?highlight=${targetId}`;
    },

    async resolvePathAsync({ supabase, targetId }) {
      const { data } = await supabase
        .from("planning_tasks")
        .select("task_number")
        .eq("id", targetId)
        .maybeSingle();
      const number = (data as { task_number: string } | null)?.task_number ?? targetId;
      return `/dashboard/planning/tasks?highlight=${number}`;
    },

    async getLabelContext({ supabase, targetId }) {
      const { data } = await supabase
        .from("planning_tasks")
        .select("task_number, title, status")
        .eq("id", targetId)
        .maybeSingle();
      const task = data as { task_number: string; title: string; status: string } | null;
      return {
        primaryText: task?.task_number ?? targetId,
        secondaryText: task?.title ?? undefined,
        tertiaryText: task ? `Status: ${task.status}` : "Planning Task",
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
