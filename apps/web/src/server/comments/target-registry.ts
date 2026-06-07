import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HELPDESK_TICKETS_MANAGE, HELPDESK_TICKETS_READ } from "@/lib/constants/permissions";
import {
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";

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
  requiredAttachmentPermission?: string;

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

  afterAttachmentCreated?(params: {
    supabase: SupabaseClient;
    orgId: string;
    targetId: string;
    actorId: string;
    attachmentId: string;
    fileName: string;
  }): Promise<void>;
}

export const COMMENT_TARGET_REGISTRY: Readonly<Record<string, CommentTargetDescriptor>> = {
  "helpdesk.ticket": {
    type: "helpdesk.ticket",
    requiredReadPermission: HELPDESK_TICKETS_READ,
    requiredCommentPermission: HELPDESK_TICKETS_READ,
    requiredAttachmentPermission: HELPDESK_TICKETS_READ,
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

    async afterAttachmentCreated({ supabase, orgId, targetId, actorId, attachmentId, fileName }) {
      await supabase.from("helpdesk_ticket_activity").insert({
        ticket_id: targetId,
        org_id: orgId,
        actor_id: actorId,
        event_type: "attachment_added",
        payload: { attachment_id: attachmentId, file_name: fileName },
      });
    },
  },
  "planning.task": {
    type: "planning.task",
    requiredReadPermission: PLANNING_TASKS_READ,
    requiredCommentPermission: PLANNING_TASKS_READ,
    requiredAttachmentPermission: PLANNING_TASKS_READ,
    requiredModeratePermission: PLANNING_TASKS_UPDATE,

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("planning_tasks")
        .select("id, organization_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, error: "NOT_FOUND" };
      }
      if ((data as { deleted_at: string | null }).deleted_at !== null) {
        return { valid: false, organizationId: null, error: "SOFT_DELETED" };
      }
      if ((data as { organization_id: string }).organization_id !== orgId) {
        return { valid: false, organizationId: null, error: "WRONG_ORG" };
      }

      return { valid: true, organizationId: orgId };
    },

    async afterCommentCreated({ supabase, orgId, targetId, actorId, visibility }) {
      await supabase.from("planning_task_activity").insert({
        organization_id: orgId,
        task_id: targetId,
        actor_id: actorId,
        activity_type: "comment_added",
        message: "Comment added",
        metadata: { visibility },
      });
    },

    async afterAttachmentCreated({ supabase, orgId, targetId, actorId, attachmentId, fileName }) {
      await supabase.from("planning_task_activity").insert({
        organization_id: orgId,
        task_id: targetId,
        actor_id: actorId,
        activity_type: "attachment_added",
        message: "Attachment added",
        metadata: { attachment_id: attachmentId, file_name: fileName },
      });
    },
  },
  "planning.kanban_card": {
    type: "planning.kanban_card",
    requiredReadPermission: PLANNING_BOARDS_READ,
    requiredCommentPermission: PLANNING_BOARDS_READ,
    requiredAttachmentPermission: PLANNING_BOARDS_READ,
    requiredModeratePermission: PLANNING_BOARDS_UPDATE,

    async validate({ supabase, targetId, orgId }) {
      const { data, error } = await supabase
        .from("planning_kanban_cards")
        .select("id, organization_id, board_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, organizationId: null, error: "NOT_FOUND" };
      }
      if ((data as { deleted_at: string | null }).deleted_at !== null) {
        return { valid: false, organizationId: null, error: "SOFT_DELETED" };
      }
      if ((data as { organization_id: string }).organization_id !== orgId) {
        return { valid: false, organizationId: null, error: "WRONG_ORG" };
      }

      return { valid: true, organizationId: orgId };
    },

    async afterCommentCreated({ supabase, orgId, targetId, actorId, visibility }) {
      const { data } = await supabase
        .from("planning_kanban_cards")
        .select("board_id")
        .eq("organization_id", orgId)
        .eq("id", targetId)
        .maybeSingle();

      const boardId = (data as { board_id?: string } | null)?.board_id;
      if (!boardId) return;

      await supabase.from("planning_kanban_card_activity").insert({
        organization_id: orgId,
        board_id: boardId,
        card_id: targetId,
        actor_id: actorId,
        activity_type: "comment_added",
        message: "Comment added",
        metadata: { visibility },
      });
    },

    async afterAttachmentCreated({ supabase, orgId, targetId, actorId, attachmentId, fileName }) {
      const { data } = await supabase
        .from("planning_kanban_cards")
        .select("board_id")
        .eq("organization_id", orgId)
        .eq("id", targetId)
        .maybeSingle();

      const boardId = (data as { board_id?: string } | null)?.board_id;
      if (!boardId) return;

      await supabase.from("planning_kanban_card_activity").insert({
        organization_id: orgId,
        board_id: boardId,
        card_id: targetId,
        actor_id: actorId,
        activity_type: "attachment_added",
        message: "Attachment added",
        metadata: { attachment_id: attachmentId, file_name: fileName },
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
