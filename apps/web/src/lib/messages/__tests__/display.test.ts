import { describe, expect, it } from "vitest";
import { canManageGroup, conversationAvatarUrl } from "../display";
import type { ChatConversationDetail, ChatMemberProfile } from "../types";

function member(userId: string, extra: Partial<ChatMemberProfile> = {}): ChatMemberProfile {
  return {
    user_id: userId,
    first_name: userId,
    last_name: null,
    email: null,
    avatar_url: `https://cdn/${userId}.jpg`,
    role: "member",
    last_read_at: "2026-11-25T10:00:00Z",
    left_at: null,
    ...extra,
  };
}

function group(extra: Partial<ChatConversationDetail> = {}): ChatConversationDetail {
  return {
    id: "c1",
    organization_id: "o1",
    kind: "group",
    name: "Magazyn",
    created_by: "creator",
    created_at: "2026-11-25T09:00:00Z",
    avatar_url: "https://cdn/group.jpg",
    members: [member("owner", { role: "owner" }), member("creator"), member("me")],
    ...extra,
  };
}

describe("conversationAvatarUrl", () => {
  it("a group shows its own photo, never a member's", () => {
    expect(conversationAvatarUrl(group(), "me")).toBe("https://cdn/group.jpg");
    expect(conversationAvatarUrl(group({ avatar_url: null }), "me")).toBeNull();
  });

  it("a 1:1 shows the other person's photo", () => {
    const direct = group({
      kind: "direct",
      name: null,
      avatar_url: null,
      members: [member("me"), member("peer")],
    });
    expect(conversationAvatarUrl(direct, "me")).toBe("https://cdn/peer.jpg");
  });
});

describe("canManageGroup", () => {
  it("the owner and the creator may change the photo, other members may not", () => {
    expect(canManageGroup(group(), "owner")).toBe(true);
    expect(canManageGroup(group(), "creator")).toBe(true);
    expect(canManageGroup(group(), "me")).toBe(false);
  });

  it("a creator who left the group may not", () => {
    const left = group({
      members: [member("owner", { role: "owner" }), member("creator", { left_at: "x" })],
    });
    expect(canManageGroup(left, "creator")).toBe(false);
  });

  it("never for a 1:1", () => {
    expect(canManageGroup(group({ kind: "direct" }), "owner")).toBe(false);
  });
});
