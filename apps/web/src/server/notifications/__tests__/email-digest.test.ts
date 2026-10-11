import { beforeEach, describe, expect, it, vi } from "vitest";
// The global test setup mocks next-intl; these tests render the real sentences
vi.unmock("next-intl");

import {
  buildChatEmail,
  runChatEmails,
  type ClaimedChat,
  buildNotificationEmail,
  runNotificationEmails,
  type ClaimedNotification,
} from "../email-digest";

const claimed = (overrides: Partial<ClaimedNotification> = {}): ClaimedNotification => ({
  id: "n1",
  organization_id: "o1",
  organization_name: "Auto Serwis",
  type: "ticket.assigned",
  target_type: "helpdesk.ticket",
  target_id: "t1",
  target_code: "HD-000014",
  title: "Drukarka nie działa",
  snippet: null,
  data: {},
  created_at: "2026-10-11T10:00:00.000Z",
  read_at: null,
  actor: { user_id: "u1", first_name: "Marta", last_name: "Nowak", email: "marta@x.test" },
  recipient: { user_id: "u2", email: "pawel@x.test", first_name: "Paweł", locale: "pl" },
  ...overrides,
});

function fakeSupabase(rows: ClaimedNotification[]) {
  const rpc = vi.fn(async (name: string) =>
    name === "notifications_email_claim" ? { data: rows, error: null } : { data: 1, error: null }
  );
  return { client: { rpc } as never, rpc };
}

describe("buildNotificationEmail", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test/");
  });

  it("one notification: its sentence is the subject, the object links into the app", async () => {
    const message = await buildNotificationEmail([claimed()], "pl");
    expect(message.subject).toBe("Marta Nowak przypisał(a) Ci zgłoszenie");
    expect(message.text).toContain("Cześć Paweł,");
    expect(message.text).toContain("HD-000014 Drukarka nie działa");
    expect(message.text).toContain("https://app.example.test/dashboard/help-desk/tickets/t1");
    expect(message.html).toContain("https://app.example.test/dashboard/account/notifications");
    expect(message.html).toContain("Auto Serwis");
  });

  it("several notifications: a counted subject; English links carry the locale", async () => {
    const message = await buildNotificationEmail(
      [
        claimed(),
        claimed({
          id: "n2",
          type: "mention",
          target_type: "chat.conversation",
          target_id: "c1",
          target_code: null,
          title: "",
          snippet: "@Paweł zerknij",
        }),
      ],
      "en"
    );
    expect(message.subject).toBe("You have 2 unread notifications in Ambra");
    expect(message.text).toContain("https://app.example.test/en/dashboard/messages?c=c1");
    expect(message.text).toContain("Direct conversation");
    expect(message.text).toContain("@Paweł zerknij");
  });

  it("a reminder has no actor", async () => {
    const message = await buildNotificationEmail(
      [claimed({ type: "task.due", target_type: "planning.task", actor: null })],
      "pl"
    );
    expect(message.subject).toBe("Przypomnienie: termin zadania mija dziś");
  });
});

describe("runNotificationEmails", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("sends one message per person and organization and marks them sent", async () => {
    const { client, rpc } = fakeSupabase([
      claimed(),
      claimed({ id: "n2" }),
      claimed({
        id: "n3",
        recipient: { user_id: "u3", email: "anna@x.test", first_name: "Anna", locale: "en" },
      }),
      claimed({ id: "n4", organization_id: "o2" }),
    ]);
    const send = vi.fn(async (_options: { to: string | string[] }) => ({ success: true }));

    const result = await runNotificationEmails(client, send);

    expect(result).toEqual({ claimed: 4, messages: 3, sent: 3, failed: 0 });
    expect(send.mock.calls.map(([options]) => options.to)).toEqual([
      "pawel@x.test",
      "anna@x.test",
      "pawel@x.test",
    ]);
    expect(rpc).toHaveBeenCalledWith("notifications_email_done", {
      p_ids: ["n1", "n2"],
      p_sent: true,
    });
  });

  it("a failed or throwing send frees the notifications for the next run", async () => {
    const { client, rpc } = fakeSupabase([claimed(), claimed({ id: "n4", organization_id: "o2" })]);
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "rate limited" })
      .mockRejectedValueOnce(new Error("network"));

    const result = await runNotificationEmails(client, send);

    expect(result).toEqual({ claimed: 2, messages: 2, sent: 0, failed: 2 });
    expect(rpc).toHaveBeenCalledWith("notifications_email_done", { p_ids: ["n1"], p_sent: false });
    expect(rpc).toHaveBeenCalledWith("notifications_email_done", { p_ids: ["n4"], p_sent: false });
  });

  it("nothing due: no message; a failing claim is an error", async () => {
    const empty = fakeSupabase([]);
    const send = vi.fn();
    expect(await runNotificationEmails(empty.client, send)).toEqual({
      claimed: 0,
      messages: 0,
      sent: 0,
      failed: 0,
    });
    expect(send).not.toHaveBeenCalled();

    const broken = { rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })) };
    await expect(runNotificationEmails(broken as never, send)).rejects.toThrow("boom");
  });
});

const chat = (overrides: Partial<ClaimedChat> = {}): ClaimedChat => ({
  conversation_id: "c1",
  organization_id: "o1",
  organization_name: "Auto Serwis",
  kind: "direct",
  name: null,
  unread_count: 2,
  last_message: {
    body_plain: "Klocki już są?",
    attachment_count: 0,
    created_at: "2026-10-11T10:00:00.000Z",
    author: { user_id: "u1", first_name: "Marta", last_name: "Nowak", email: "marta@x.test" },
  },
  recipient: { user_id: "u2", email: "pawel@x.test", first_name: "Paweł", locale: "pl" },
  ...overrides,
});

describe("chat e-mails", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("lists each conversation with its count, last message and link", async () => {
    const message = await buildChatEmail(
      [
        chat(),
        chat({
          conversation_id: "c2",
          kind: "group",
          name: "Magazyn",
          unread_count: 5,
          last_message: { ...chat().last_message!, body_plain: "", attachment_count: 1 },
        }),
      ],
      "pl"
    );
    expect(message.subject).toBe("Masz 7 nieprzeczytanych wiadomości w Ambrze");
    expect(message.text).toContain("Marta Nowak — 2 nowe wiadomości");
    expect(message.text).toContain("„Klocki już są?”");
    expect(message.text).toContain("Grupa „Magazyn” — 5 nowych wiadomości");
    expect(message.text).toContain("„Marta Nowak: 1 załącznik”");
    expect(message.text).toContain("https://app.example.test/dashboard/messages?c=c2");
  });

  it("one message per person; a failed send frees the conversations", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "chat_email_claim"
        ? { data: [chat(), chat({ conversation_id: "c2" })], error: null }
        : { data: 2, error: null }
    );
    const send = vi.fn(async (_options: { to: string | string[] }) => ({ success: false }));

    const result = await runChatEmails({ rpc } as never, send);

    expect(result).toEqual({ claimed: 2, messages: 1, sent: 0, failed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("chat_email_release", {
      p_user: "u2",
      p_conversation_ids: ["c1", "c2"],
    });
  });

  it("a sent message needs no report (the claim already marked it)", async () => {
    const rpc = vi.fn(async () => ({ data: [chat()], error: null }));
    const send = vi.fn(async (_options: { to: string | string[] }) => ({ success: true }));
    expect(await runChatEmails({ rpc } as never, send)).toEqual({
      claimed: 1,
      messages: 1,
      sent: 1,
      failed: 0,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
