"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgInvitationsService, OrgProfileService } from "@/server/services/organization.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
} from "@/lib/constants/permissions";
import { EmailService } from "@/server/services/email.service";

const roleAssignmentSchema = z.object({
  role_id: z.string().uuid(),
  scope: z.enum(["org", "branch"]),
  scope_id: z.string().uuid().nullable().optional(),
});

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  invited_first_name: z.string().max(100).nullable().optional(),
  invited_last_name: z.string().max(100).nullable().optional(),
  role_assignments: z.array(roleAssignmentSchema).max(20).optional(),
});

const inviteIdSchema = z.object({
  invitationId: z.string().uuid(),
});

export async function listInvitationsAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, INVITES_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgInvitationsService.listInvitations(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createInvitationAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId || !context.user.user?.id) {
      return { success: false, error: "No active organization" };
    }
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canCreate = checkPermission(context.user.permissionSnapshot, INVITES_CREATE);
    if (!canCreate) return { success: false, error: "Unauthorized" };

    const parsed = createInviteSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const result = await OrgInvitationsService.createInvitation(
      supabase,
      context.app.activeOrgId,
      context.user.user!.id,
      parsed.data as import("@/server/services/organization.service").CreateInvitationInput
    );

    if (result.success) {
      const profileResult = await OrgProfileService.getProfile(supabase, context.app.activeOrgId);
      const orgName = profileResult.success
        ? (profileResult.data.name ?? "your organization")
        : "your organization";
      const inviterName =
        `${context.user.user?.first_name ?? ""} ${context.user.user?.last_name ?? ""}`.trim() ||
        (context.user.user?.email ?? "");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const invitationLink = `${siteUrl}/invite/${result.data.token}`;

      let emailDelivered = false;
      let emailError: string | undefined;
      try {
        const emailService = new EmailService();
        const emailResult = await emailService.sendInvitationEmailWithTemplate(
          result.data.email,
          orgName,
          inviterName,
          invitationLink
        );
        emailDelivered = emailResult.success;
        if (!emailResult.success) {
          emailError = emailResult.error;
          console.error("[createInvitationAction] Email delivery failed:", emailError);
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Unknown error";
        console.error("[createInvitationAction] Failed to send invitation email:", err);
      }

      return { ...result, emailDelivered, ...(emailError ? { emailError } : {}) };
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function cancelInvitationAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canCancel = checkPermission(context.user.permissionSnapshot, INVITES_CANCEL);
    if (!canCancel) return { success: false, error: "Unauthorized" };

    const parsed = inviteIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgInvitationsService.cancelInvitation(supabase, parsed.data.invitationId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function resendInvitationAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    // Resending is a create-level operation (new token + expiry)
    const canCreate = checkPermission(context.user.permissionSnapshot, INVITES_CREATE);
    if (!canCreate) return { success: false, error: "Unauthorized" };

    const parsed = inviteIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const result = await OrgInvitationsService.resendInvitation(supabase, parsed.data.invitationId);

    if (result.success) {
      const profileResult = await OrgProfileService.getProfile(
        supabase,
        result.data.organization_id
      );
      const orgName = profileResult.success
        ? (profileResult.data.name ?? "your organization")
        : "your organization";
      const inviterName =
        `${context.user.user?.first_name ?? ""} ${context.user.user?.last_name ?? ""}`.trim() ||
        (context.user.user?.email ?? "");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const invitationLink = `${siteUrl}/invite/${result.data.token}`;

      let emailDelivered = false;
      let emailError: string | undefined;
      try {
        const emailService = new EmailService();
        const emailResult = await emailService.sendInvitationEmailWithTemplate(
          result.data.email,
          orgName,
          inviterName,
          invitationLink
        );
        emailDelivered = emailResult.success;
        if (!emailResult.success) {
          emailError = emailResult.error;
          console.error("[resendInvitationAction] Email delivery failed:", emailError);
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Unknown error";
        console.error("[resendInvitationAction] Failed to send invitation email:", err);
      }

      return {
        success: true as const,
        data: result.data.token,
        emailDelivered,
        ...(emailError ? { emailError } : {}),
      };
    }

    return result.success ? { success: true, data: result.data.token } : result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function acceptInvitationAction(
  token: string
): Promise<
  { success: true; data: { organization_id: string } } | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    return await OrgInvitationsService.acceptInvitation(supabase, token);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function declineInvitationAction(token: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("decline_invitation", { p_token: token });
    if (error) return { success: false as const, error: error.message };
    const result = data as { success: boolean; error_code?: string } | null;
    if (!result?.success)
      return {
        success: false as const,
        error: result?.error_code ?? "Failed to decline invitation",
      };
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function cleanupExpiredInvitationsAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canCancel = checkPermission(context.user.permissionSnapshot, INVITES_CANCEL);
    if (!canCancel) return { success: false, error: "Unauthorized" };

    return await OrgInvitationsService.cleanupExpiredInvitations(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
