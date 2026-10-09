import { describe, expect, it } from "vitest";
import {
  applyMessageToList,
  applyReadReceipt,
  clearUnread,
  flattenMessages,
  unreadConversations,
  upsertMessage,
  type MessagesInfiniteData,
} from "../cache";
import { conversationInitials, conversationTitle, memberInitials } from "../display";
import type { ChatConversationSummary, ChatMessage } from "../types";

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    conversation_id: "c1",
    author_id: "u2",
    kind: "text",
    body_plain: "Cześć",
    body_rich: null,
    mentions: [],
    attachment_ids: [],
    system_event: null,
    client_id: null,
    created_at: "2026-10-09T10:00:00.000Z",
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function thread(...messages: ChatMessage[]): MessagesInfiniteData {
  return { pages: [{ messages, nextCursor: null }], pageParams: [null] };
}

const member = (user_id: string, first_name: string, last_name: string) => ({
  user_id,
  first_name,
  last_name,
  email: `${user_id}@x.pl`,
  avatar_url: null,
  role: "member" as const,
  last_read_at: "2026-10-09T09:00:00.000Z",
});

function conversation(overrides: Partial<ChatConversationSummary>): ChatConversationSummary {
  return {
    id: "c1",
    kind: "direct",
    name: null,
    created_at: "2026-10-09T08:00:00.000Z",
    activity_at: "2026-10-09T08:00:00.000Z",
    unread_count: 0,
    muted: false,
    member_count: 2,
    members: [member("me", "Michał", "Stępień"), member("u2", "Paweł", "Wiśniewski")],
    last_message: null,
    ...overrides,
  };
}

describe("upsertMessage", () => {
  it("appends a new message in time order", () => {
    const data = thread(message({ id: "a", created_at: "2026-10-09T10:00:00.000Z" }));
    const next = upsertMessage(data, message({ id: "b", created_at: "2026-10-09T10:01:00.000Z" }));
    expect(flattenMessages(next).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("replaces the optimistic message by client id instead of duplicating it", () => {
    const pending = {
      ...message({ id: "pending:k1", client_id: "k1", author_id: "me" }),
      pending: true,
    };
    const stored = message({ id: "m9", client_id: "k1", author_id: "me" });
    const next = upsertMessage(upsertMessage(thread(), pending), stored);
    expect(flattenMessages(next)).toHaveLength(1);
    expect(flattenMessages(next)[0]?.id).toBe("m9");
    // The realtime echo of the same message changes nothing
    expect(flattenMessages(upsertMessage(next, stored))).toHaveLength(1);
  });

  it("leaves an unloaded thread alone", () => {
    expect(upsertMessage(undefined, message({}))).toBeUndefined();
  });
});

describe("conversation list", () => {
  it("moves the conversation to the top and counts unread from others", () => {
    const list = [conversation({ id: "c0" }), conversation({ id: "c1" })];
    const next = applyMessageToList(list, message({ conversation_id: "c1" }), "me", false);
    expect(next?.map((c) => c.id)).toEqual(["c1", "c0"]);
    expect(next?.[0]?.unread_count).toBe(1);
    expect(next?.[0]?.last_message?.body_plain).toBe("Cześć");
  });

  it("does not count own messages or a conversation on screen", () => {
    const list = [conversation({})];
    expect(
      applyMessageToList(list, message({ author_id: "me" }), "me", false)?.[0]?.unread_count
    ).toBe(0);
    expect(applyMessageToList(list, message({}), "me", true)?.[0]?.unread_count).toBe(0);
  });

  it("clears unread and counts conversations (muted ones excluded)", () => {
    const list = [
      conversation({ id: "a", unread_count: 3 }),
      conversation({ id: "b", unread_count: 1, muted: true }),
      conversation({ id: "c", unread_count: 2 }),
    ];
    expect(unreadConversations(list)).toBe(2);
    expect(unreadConversations(clearUnread(list, "a"))).toBe(1);
  });

  it("applies a newer read receipt only", () => {
    const c = conversation({});
    const later = applyReadReceipt(c, "u2", "2026-10-09T11:00:00.000Z");
    expect(later?.members[1]?.last_read_at).toBe("2026-10-09T11:00:00.000Z");
    const older = applyReadReceipt(later, "u2", "2026-10-09T10:00:00.000Z");
    expect(older?.members[1]?.last_read_at).toBe("2026-10-09T11:00:00.000Z");
  });
});

describe("display", () => {
  it("names a 1:1 after the other person and a group after its name", () => {
    expect(conversationTitle(conversation({}), "me")).toBe("Paweł Wiśniewski");
    expect(conversationInitials(conversation({}), "me")).toBe("PW");
    const group = conversation({ kind: "group", name: "Magazyn CNP Poznań" });
    expect(conversationTitle(group, "me")).toBe("Magazyn CNP Poznań");
    expect(conversationInitials(group, "me")).toBe("MC");
  });

  it("falls back to the e-mail for initials", () => {
    expect(memberInitials({ first_name: null, last_name: null, email: "ab@x.pl" })).toBe("AB");
  });
});
