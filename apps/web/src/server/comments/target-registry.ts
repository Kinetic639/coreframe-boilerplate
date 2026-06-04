import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HELPDESK_TICKETS_MANAGE, HELPDESK_TICKETS_READ } from "@/lib/constants/permissions";

export interface CommentTargetValidationResult {
  valid: boolean;
  organizationId: string | null;
  error?: "NOT_FOUND" | "WRONG_ORG" | "SOFT_DELETED" | "UNSUPPORTED_TYPE";
}

export interface CommentTargetDescriptor {
  type: string;
  requiredReadPermission: string;
  requiredCommentPermission: string;
  requiredModeratePermission?: string;

  validate(params: {
    supabase: SupabaseClient;
    targetId: string;
    orgId: string;
  }): Promise<CommentTargetValidationResult>;

  afterCommentCreated?(params: {
    supabase: SupabaseClient;
    orgId: string;
    targetId: string;
    actorId: string;
    visibility: "default" | "internal";
  }): Promise<void>;
}

export const COMMENT_TARGET_REGISTRY: Readonly<Record<string, CommentTargetDescriptor>> = {
  "helpdesk.ticket": {
    type: "helpdesk.ticket",
    requiredReadPermission: HELPDESK_TICKETS_READ,
    requiredCommentPermission: HELPDESK_TICKETS_READ,
    requiredModeratePermission: HELPDESK_TICKETS_MANAGE,

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("id, org_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, error: "NOT_FOUND" };
      }
      if ((data as { deleted_at: string | null }).deleted_at !== null) {
        return { valid: false, organizationId: null, error: "SOFT_DELETED" };
      }
      if ((data as { org_id: string }).org_id !== orgId) {
        return { valid: false, organizationId: null, error: "WRONG_ORG" };
      }

      return { valid: true, organizationId: orgId };
    },

    async afterCommentCreated({ supabase, orgId, targetId, actorId, visibility }) {
      await supabase.from("helpdesk_ticket_activity").insert({
        ticket_id: targetId,
        org_id: orgId,
        actor_id: actorId,
        event_type: "comment_added",
        payload: { is_internal: visibility === "internal" },
      });
    },
  },
} as const;

export function getCommentTargetDescriptor(targetType: string): CommentTargetDescriptor | null {
  return COMMENT_TARGET_REGISTRY[targetType] ?? null;
}

export function isSupportedCommentTargetType(targetType: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMENT_TARGET_REGISTRY, targetType);
}

export const SUPPORTED_COMMENT_TARGET_TYPES = Object.keys(COMMENT_TARGET_REGISTRY);
