"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MESSAGES_USE } from "@/lib/constants/permissions";
import { ChatService, type SendChatMessageInput } from "@/server/services/chat.service";
import { OrgMembersService } from "@/server/services/organization.service";
import {
  CHAT_GROUP_NAME_MAX_LENGTH,
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatConversationDetail,
  type ChatConversationSummary,
  type ChatErrorCode,
  type ChatMessage,
  type ChatMessageCursor,
  type ChatMessagesPage,
} from "@/lib/messages/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: ChatErrorCode };

/** A colleague the user can start a conversation with */
export interface ChatPerson {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

const listConversationsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  before: isoDate.nullish(),
});
const listMessagesSchema = z.object({
  conversationId: uuid,
  before: z.object({ createdAt: isoDate, id: uuid }).nullish(),
});
const sendSchema = z.object({
  conversationId: uuid,
  bodyPlain: z.string().max(CHAT_MESSAGE_MAX_LENGTH),
  bodyRich: z.unknown().nullish(),
  clientId: uuid.nullish(),
  attachmentIds: z.array(uuid).max(10).optional(),
  mentions: z.array(z.unknown()).max(50).optional(),
});
const markReadSchema = z.object({ conversationId: uuid, until: isoDate.nullish() });
const openDirectSchema = z.object({ userId: uuid });
const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(CHAT_GROUP_NAME_MAX_LENGTH),
  userIds: z.array(uuid).min(1).max(99),
});
const membersSchema = z.object({ conversationId: uuid, userIds: z.array(uuid).min(1).max(99) });
const memberSchema = z.object({ conversationId: uuid, userId: uuid });
const renameSchema = z.object({
  conversationId: uuid,
  name: z.string().trim().min(1).max(CHAT_GROUP_NAME_MAX_LENGTH),
});
const muteSchema = z.object({ conversationId: uuid, until: isoDate.nullable() });

/** Session, organization and the `messages.use` permission */
async function getChatContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId;
  const userId = context?.user.user?.id;
  if (!context || !orgId || !userId) return null;
  if (!checkPermission(context.user.permissionSnapshot, MESSAGES_USE)) return null;
  return { supabase, orgId, userId };
}

async function run<I, T>(
  schema: z.ZodType<I>,
  rawInput: unknown,
  scope: string,
  fn: (
    ctx: NonNullable<Awaited<ReturnType<typeof getChatContext>>>,
    input: I
  ) => Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<ActionResult<T>> {
  try {
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid" };
    const ctx = await getChatContext();
    if (!ctx) return { success: false, error: "forbidden" };
    const result = await fn(ctx, parsed.data);
    if (result.success) return result;
    return { success: false, error: (result as { error: string }).error as ChatErrorCode };
  } catch (error) {
    console.error(`[messages.${scope}]`, error);
    return { success: false, error: "failed" };
  }
}

export async function listConversationsAction(
  rawInput: unknown = {}
): Promise<ActionResult<ChatConversationSummary[]>> {
  return run(listConversationsSchema, rawInput, "listConversations", (ctx, input) =>
    ChatService.listConversations(ctx.supabase, ctx.orgId, input)
  );
}

export async function getConversationAction(
  rawInput: unknown
): Promise<ActionResult<ChatConversationDetail>> {
  return run(z.object({ conversationId: uuid }), rawInput, "getConversation", (ctx, input) =>
    ChatService.getConversation(ctx.supabase, input.conversationId)
  );
}

export async function listMessagesAction(
  rawInput: unknown
): Promise<ActionResult<ChatMessagesPage>> {
  return run(listMessagesSchema, rawInput, "listMessages", (ctx, input) =>
    ChatService.listMessages(ctx.supabase, input.conversationId, {
      // apps/web runs without strictNullChecks: zod's inferred fields are all optional
      before: (input.before ?? null) as ChatMessageCursor | null,
    })
  );
}

export async function sendMessageAction(rawInput: unknown): Promise<ActionResult<ChatMessage>> {
  return run(sendSchema, rawInput, "send", (ctx, input) =>
    ChatService.send(ctx.supabase, input as SendChatMessageInput)
  );
}

export async function markConversationReadAction(rawInput: unknown): Promise<ActionResult<string>> {
  return run(markReadSchema, rawInput, "markRead", (ctx, input) =>
    ChatService.markRead(ctx.supabase, input.conversationId, input.until)
  );
}

export async function openDirectConversationAction(
  rawInput: unknown
): Promise<ActionResult<string>> {
  return run(openDirectSchema, rawInput, "openDirect", (ctx, input) =>
    ChatService.openDirect(ctx.supabase, ctx.orgId, input.userId)
  );
}

export async function createGroupConversationAction(
  rawInput: unknown
): Promise<ActionResult<string>> {
  return run(createGroupSchema, rawInput, "createGroup", (ctx, input) =>
    ChatService.createGroup(ctx.supabase, ctx.orgId, input.name, input.userIds)
  );
}

export async function addConversationMembersAction(rawInput: unknown): Promise<ActionResult<null>> {
  return run(membersSchema, rawInput, "addMembers", (ctx, input) =>
    ChatService.addMembers(ctx.supabase, input.conversationId, input.userIds)
  );
}

export async function removeConversationMemberAction(
  rawInput: unknown
): Promise<ActionResult<null>> {
  return run(memberSchema, rawInput, "removeMember", (ctx, input) =>
    ChatService.removeMember(ctx.supabase, input.conversationId, input.userId)
  );
}

export async function leaveConversationAction(rawInput: unknown): Promise<ActionResult<null>> {
  return run(z.object({ conversationId: uuid }), rawInput, "leave", (ctx, input) =>
    ChatService.removeMember(ctx.supabase, input.conversationId, ctx.userId)
  );
}

export async function renameConversationAction(rawInput: unknown): Promise<ActionResult<null>> {
  return run(renameSchema, rawInput, "rename", (ctx, input) =>
    ChatService.rename(ctx.supabase, input.conversationId, input.name)
  );
}

export async function muteConversationAction(rawInput: unknown): Promise<ActionResult<null>> {
  return run(muteSchema, rawInput, "mute", (ctx, input) =>
    ChatService.setMuted(ctx.supabase, input.conversationId, input.until)
  );
}

/** Colleagues of the active organization (the caller excluded), for new conversations */
export async function listChatPeopleAction(): Promise<ActionResult<ChatPerson[]>> {
  return run(z.object({}).optional(), undefined, "listPeople", async (ctx) => {
    const result = await OrgMembersService.listMembers(ctx.supabase, ctx.orgId);
    if (!result.success) {
      console.error("[messages.listPeople]", (result as { error: string }).error);
      return { success: false, error: "failed" };
    }
    const people = result.data
      .filter((member) => member.user_id !== ctx.userId && member.status === "active")
      .map((member) => ({
        userId: member.user_id,
        firstName: member.user_first_name,
        lastName: member.user_last_name,
        email: member.user_email,
        avatarUrl: member.user_avatar_url,
      }));
    return { success: true, data: people };
  });
}
