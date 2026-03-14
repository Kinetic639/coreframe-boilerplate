"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
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
import { eventService } from "@/server/services/event.service";

const roleAssignmentSchema = z.object({
  role_id: z.string().uuid(),
  scope: z.enum(["org", "branch"]),
  scope_id: z.string().uuid().nullable().optional(),
});

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
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
      // Emit org.member.invited — best effort, after successful invitation insert
      try {
        await eventService.emit({
          actionKey: "org.member.invited",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "invitation",
          entityId: result.data.id,
          targetType: null,
          targetId: null,
          metadata: {
            invitee_email: result.data.email,
            invitee_first_name: result.data.invited_first_name ?? undefined,
            invitee_last_name: result.data.invited_last_name ?? undefined,
          },
          eventTier: "enhanced",
        });
      } catch (emitError) {
        console.error("[createInvitationAction] Failed to emit org.member.invited:", {
          actionKey: "org.member.invited",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "invitation",
          entityId: result.data.id,
          error: emitError,
        });
      }

      const [profileResult, rawLocale] = await Promise.all([
        OrgProfileService.getProfile(supabase, context.app.activeOrgId),
        getLocale(),
      ]);
      const orgName = profileResult.success
        ? [profileResult.data.name, profileResult.data.name_2].filter(Boolean).join(" ") ||
          "your organization"
        : "your organization";
      const inviterName =
        `${context.user.user?.first_name ?? ""} ${context.user.user?.last_name ?? ""}`.trim() ||
        (context.user.user?.email ?? "");
      const locale = rawLocale === "en" ? "en" : "pl";
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
          invitationLink,
          locale
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

    // Fetch invitation email before cancelling (service returns void, data unavailable after)
    const { data: inviteForEvent } = await supabase
      .from("invitations")
      .select("email")
      .eq("id", parsed.data.invitationId)
      .maybeSingle();

    const result = await OrgInvitationsService.cancelInvitation(supabase, parsed.data.invitationId);

    if (result.success) {
      try {
        await eventService.emit({
          actionKey: "org.invitation.cancelled",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "invitation",
          entityId: parsed.data.invitationId,
          metadata: {
            invitation_id: parsed.data.invitationId,
            invitee_email: inviteForEvent?.email ?? undefined,
          },
          eventTier: "enhanced",
        });
      } catch (emitError) {
        console.error("[cancelInvitationAction] Failed to emit org.invitation.cancelled:", {
          actionKey: "org.invitation.cancelled",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "invitation",
          entityId: parsed.data.invitationId,
          error: emitError,
        });
      }
    }

    return result;
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
      const [profileResult, rawLocale] = await Promise.all([
        OrgProfileService.getProfile(supabase, result.data.organization_id),
        getLocale(),
      ]);
      const orgName = profileResult.success
        ? [profileResult.data.name, profileResult.data.name_2].filter(Boolean).join(" ") ||
          "your organization"
        : "your organization";
      const inviterName =
        `${context.user.user?.first_name ?? ""} ${context.user.user?.last_name ?? ""}`.trim() ||
        (context.user.user?.email ?? "");
      const locale = rawLocale === "en" ? "en" : "pl";
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
          invitationLink,
          locale
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

    // Get the current user and invitation ID before accepting (RPC returns org_id only)
    const [
      {
        data: { user: acceptingUser },
      },
      { data: inviteRow },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("invitations").select("id").eq("token", token).maybeSingle(),
    ]);

    const result = await OrgInvitationsService.acceptInvitation(supabase, token);

    if (result.success) {
      try {
        await eventService.emit({
          actionKey: "org.invitation.accepted",
          actorType: "user",
          actorUserId: acceptingUser?.id ?? null,
          organizationId: result.data.organization_id,
          entityType: "user",
          entityId: acceptingUser?.id ?? "unknown",
          metadata: {
            invitation_id: inviteRow?.id ?? undefined,
          },
          eventTier: "baseline",
        });
      } catch (emitError) {
        console.error("[acceptInvitationAction] Failed to emit org.invitation.accepted:", {
          actionKey: "org.invitation.accepted",
          organizationId: result.data.organization_id,
          actorUserId: acceptingUser?.id ?? null,
          entityType: "user",
          entityId: acceptingUser?.id ?? "unknown",
          error: emitError,
        });
      }
    }

    return result;
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
