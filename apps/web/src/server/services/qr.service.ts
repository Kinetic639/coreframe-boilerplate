/**
 * QR Platform Service
 *
 * Manages QR code identity records (qr_codes) and typed target assignments
 * (qr_assignments) for the platform-wide QR domain.
 *
 * Constraints:
 * - server-only (never import from client components)
 * - uses authenticated Supabase client only (no service role)
 * - never bypasses RLS
 * - fail-closed: returns ServiceResult<T>, never throws to callers
 *
 * Assignment invariant:
 * - organization_id and branch_id on every assignment are always derived
 *   from the QR record and validated target — never trusted from caller input.
 * - A qr_assignments row always satisfies:
 *     assignment.organization_id === qr_codes.organization_id (for the referenced QR)
 *     assignment.branch_id       === target.branch_id (from registry validation)
 *
 * Bidirectional uniqueness (enforced at DB via partial unique indexes):
 * - One active assignment per QR code (qra_one_active_per_qr_idx)
 * - One active QR per target (qra_one_active_per_target_idx)
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_READ, QR_CREATE, QR_ASSIGN, QR_REVOKE } from "@/lib/constants/permissions";
import { generateQrToken } from "@/lib/qr/token";
import { getTargetDescriptor, isSupportedTargetType } from "@/server/qr/target-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface QrCode {
  id: string;
  organization_id: string;
  token: string;
  label: string | null;
  notes: string | null;
  status: "active" | "revoked";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QrAssignment {
  id: string;
  qr_code_id: string;
  organization_id: string;
  branch_id: string | null;
  target_type: string;
  target_id: string;
  assigned_by: string | null;
  assigned_at: string;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface QrCodeWithAssignment {
  qr: QrCode;
  assignment: QrAssignment | null;
}

export interface CreateQrInput {
  label?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface AssignQrInput {
  qrCodeId: string;
  targetType: string;
  targetId: string;
  assignedBy: string;
  permissionSnapshot: PermissionSnapshot;
}

export interface RevokeQrInput {
  revokedBy: string;
  reason?: string | null;
}

// ---------------------------------------------------------------------------
// Typed assignment error codes
// ---------------------------------------------------------------------------

export const QR_ASSIGN_ERRORS = {
  QR_ALREADY_ASSIGNED:
    "This QR code is already assigned to another target. Revoke the existing assignment first.",
  TARGET_ALREADY_HAS_QR:
    "This target already has an active QR code assigned. Revoke it before assigning a new one.",
  UNSUPPORTED_TARGET_TYPE: "Target type is not supported by the QR platform.",
  CROSS_ORG_MISMATCH: "Target does not belong to the same organization as the QR code.",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDbError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || (error.message && error.message.includes("row-level security"))) {
    return "You do not have permission to perform this action.";
  }
  return error.message;
}

/**
 * Maps a Postgres 23505 unique-violation message to a typed assignment error.
 * The constraint name appears in the DB error message.
 */
function mapUniqueViolation(message: string): string {
  if (message.includes("qra_one_active_per_qr_idx")) {
    return QR_ASSIGN_ERRORS.QR_ALREADY_ASSIGNED;
  }
  if (message.includes("qra_one_active_per_target_idx")) {
    return QR_ASSIGN_ERRORS.TARGET_ALREADY_HAS_QR;
  }
  return "A uniqueness constraint was violated.";
}

// ---------------------------------------------------------------------------
// QrCodesService
// ---------------------------------------------------------------------------

export class QrCodesService {
  /**
   * Create a new QR code record for the given org.
   * The token is generated here — callers cannot supply or influence it.
   */
  static async create(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateQrInput
  ): Promise<ServiceResult<QrCode>> {
    const token = generateQrToken();

    const { data, error } = await supabase
      .from("qr_codes")
      .insert({
        organization_id: orgId,
        token,
        label: input.label ?? null,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as QrCode };
  }

  /**
   * Get a single QR code by id, scoped to the org.
   * Returns null data (not an error) when not found or wrong org — prevents enumeration.
   */
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<QrCode | null>> {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as QrCode | null };
  }

  /**
   * List all active (non-deleted) QR codes for an org, newest first.
   */
  static async listByOrg(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<QrCode[]>> {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as QrCode[] };
  }

  /**
   * Permanently revoke a QR code.
   * Also revokes the active assignment so the bidirectional index is freed.
   * Returns an error when the QR is missing, wrong org, or already revoked.
   */
  static async revoke(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    input: RevokeQrInput
  ): Promise<ServiceResult<void>> {
    // Revoke the active assignment first (if any) so the unique index is freed.
    // Sequencing: assignment before code — if assignment revoke fails the code
    // stays active and the caller can retry cleanly.
    await QrAssignmentsService.revokeActiveForQr(supabase, id, input);

    const { data, error } = await supabase
      .from("qr_codes")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .select("id")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    if (!data) return { success: false, error: "QR code not found or already revoked." };
    return { success: true, data: undefined };
  }
}

// ---------------------------------------------------------------------------
// QrAssignmentsService
// ---------------------------------------------------------------------------

export class QrAssignmentsService {
  /**
   * Assign a QR code to a typed target.
   *
   * INVARIANT — organization_id and branch_id are ALWAYS derived server-side:
   *   1. QR row is loaded to get organization_id (caller does not supply it).
   *   2. Target is validated via the registry; the registry returns branch_id.
   *   3. A cross-org mismatch (target.orgId !== qr.orgId) is rejected before insert.
   *   4. The inserted row uses only these derived values.
   *
   * Compound permission check:
   *   - qr.assign (QR-platform gate)
   *   - descriptor.requiredAssignPermission (target-module gate)
   *   Both must be present in the permissionSnapshot.
   */
  static async assignToTarget(
    supabase: SupabaseClient,
    input: AssignQrInput
  ): Promise<ServiceResult<QrAssignment>> {
    // Step 1: load QR row; derive org from DB, not from caller
    const { data: qrRow, error: qrError } = await supabase
      .from("qr_codes")
      .select("id, organization_id, status")
      .eq("id", input.qrCodeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (qrError) return { success: false, error: normalizeDbError(qrError) };
    if (!qrRow) return { success: false, error: "QR code not found." };
    if ((qrRow as QrCode).status !== "active") {
      return { success: false, error: "QR code is revoked and cannot be assigned." };
    }

    const derivedOrgId = (qrRow as Pick<QrCode, "organization_id">).organization_id;

    // Step 2: resolve target descriptor
    if (!isSupportedTargetType(input.targetType)) {
      return { success: false, error: QR_ASSIGN_ERRORS.UNSUPPORTED_TARGET_TYPE };
    }
    const descriptor = getTargetDescriptor(input.targetType)!;

    // Step 3: compound permission check
    if (!checkPermission(input.permissionSnapshot, QR_ASSIGN)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!checkPermission(input.permissionSnapshot, descriptor.requiredAssignPermission)) {
      return { success: false, error: "Unauthorized" };
    }

    // Step 4: validate target via registry (checks existence, org, soft-delete)
    const validation = await descriptor.validate({
      supabase,
      targetId: input.targetId,
      orgId: derivedOrgId,
    });

    if (!validation.valid) {
      if (validation.error === "WRONG_ORG") {
        return { success: false, error: QR_ASSIGN_ERRORS.CROSS_ORG_MISMATCH };
      }
      return {
        success: false,
        error: `Target validation failed: ${validation.error ?? "unknown error"}`,
      };
    }

    // Step 5: insert using derived org and branch — never from caller
    const { data, error: insertError } = await supabase
      .from("qr_assignments")
      .insert({
        qr_code_id: input.qrCodeId,
        organization_id: derivedOrgId,
        branch_id: validation.branchId,
        target_type: input.targetType,
        target_id: input.targetId,
        assigned_by: input.assignedBy,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: false, error: mapUniqueViolation(insertError.message) };
      }
      return { success: false, error: normalizeDbError(insertError) };
    }

    return { success: true, data: data as QrAssignment };
  }

  /**
   * Get the single active assignment for a QR code, or null if unassigned.
   */
  static async getActiveForQr(
    supabase: SupabaseClient,
    qrCodeId: string
  ): Promise<ServiceResult<QrAssignment | null>> {
    const { data, error } = await supabase
      .from("qr_assignments")
      .select("*")
      .eq("qr_code_id", qrCodeId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as QrAssignment | null };
  }

  /**
   * Get the active assignment for a target, or null if no QR is assigned.
   */
  static async getActiveForTarget(
    supabase: SupabaseClient,
    targetType: string,
    targetId: string
  ): Promise<ServiceResult<QrAssignment | null>> {
    const { data, error } = await supabase
      .from("qr_assignments")
      .select("*")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as QrAssignment | null };
  }

  /**
   * List active QR codes with their assignments for a branch.
   *
   * Phase 1 scope note: this method is intentionally scoped to
   * warehouse.location targets for Phase 1 (the only registered target type).
   * As new target types are added, callers will pass targetType explicitly
   * and this method will be updated to use the registry pattern.
   *
   * Compound permission check required:
   * - qr.read            (QR-platform read gate)
   * - requiredReadPermission from the warehouse.location descriptor
   *   (warehouse.locations.read for Phase 1)
   */
  static async listByBranch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    permissionSnapshot: PermissionSnapshot
  ): Promise<ServiceResult<QrCodeWithAssignment[]>> {
    if (!checkPermission(permissionSnapshot, QR_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const descriptor = getTargetDescriptor("warehouse.location");
    if (descriptor && !checkPermission(permissionSnapshot, descriptor.requiredReadPermission)) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("qr_assignments")
      .select(
        `
        *,
        qr_codes!qr_assignments_qr_code_id_fkey (*)
        `
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("target_type", "warehouse.location")
      .is("revoked_at", null);

    if (error) return { success: false, error: normalizeDbError(error) };

    const rows: QrCodeWithAssignment[] = (data ?? []).map((row: any) => ({
      qr: row.qr_codes as QrCode,
      assignment: {
        id: row.id,
        qr_code_id: row.qr_code_id,
        organization_id: row.organization_id,
        branch_id: row.branch_id,
        target_type: row.target_type,
        target_id: row.target_id,
        assigned_by: row.assigned_by,
        assigned_at: row.assigned_at,
        revoked_by: row.revoked_by,
        revoked_at: row.revoked_at,
        revocation_reason: row.revocation_reason,
      } as QrAssignment,
    }));

    return { success: true, data: rows };
  }

  /**
   * Explicitly revoke a single assignment by id.
   * Used when a QR code should be unassigned but remain active for reuse.
   */
  static async revokeAssignment(
    supabase: SupabaseClient,
    orgId: string,
    assignmentId: string,
    input: RevokeQrInput
  ): Promise<ServiceResult<void>> {
    const { data, error } = await supabase
      .from("qr_assignments")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: input.revokedBy,
        revocation_reason: input.reason ?? null,
      })
      .eq("id", assignmentId)
      .eq("organization_id", orgId)
      .is("revoked_at", null)
      .select("id")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    if (!data) return { success: false, error: "Assignment not found or already revoked." };
    return { success: true, data: undefined };
  }

  /**
   * Revoke the active assignment for a QR code (if any).
   * Called internally by QrCodesService.revoke before revoking the code itself.
   * Returns success even when there is no active assignment to revoke.
   */
  static async revokeActiveForQr(
    supabase: SupabaseClient,
    qrCodeId: string,
    input: RevokeQrInput
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("qr_assignments")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: input.revokedBy,
        revocation_reason: input.reason ?? null,
      })
      .eq("qr_code_id", qrCodeId)
      .is("revoked_at", null);

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }
}
