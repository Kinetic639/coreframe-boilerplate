import { describe, expect, it, vi } from "vitest";
// The global test setup mocks next-intl; these tests render the real sentences
vi.unmock("next-intl");

import { buildPushPayload, runPushDispatch, type ClaimedPush } from "../push";

const subscription = {
  endpoint: "https://push.example.test/a",
  p256dh: "k".repeat(20),
  auth: "a".repeat(10),
};

const notification = (overrides: Partial<ClaimedPush> = {}): ClaimedPush =>
  ({
    queue_id: 1,
    kind: "notification",
    organization_id: "o1",
    organization_name: "Auto Serwis",
    recipient: { user_id: "u2", locale: "pl" },
    badge: 3,
    subscriptions: [subscription],
    item: {
      id: "11111111-1111-4111-8111-111111111111",
      organization_id: "o1",
      type: "ticket.assigned",
      target_type: "helpdesk.ticket",
      target_id: "22222222-2222-4222-8222-222222222222",
      target_code: "HD-000014",
      title: "Drukarka nie działa",
      snippet: null,
      data: {},
      created_at: "2026-11-27T10:00:00.000Z",
      read_at: null,
      actor: { user_id: "u1", first_name: "Marta", last_name: "Nowak", email: "m@x.test" },
    },
    ...overrides,
  }) as ClaimedPush;

const chat = (overrides: Record<string, unknown> = {}, locale = "pl"): ClaimedPush =>
  ({
    queue_id: 2,
    kind: "chat",
    organization_id: "o1",
    organization_name: "Auto Serwis",
    recipient: { user_id: "u2", locale },
    badge: 1,
    subscriptions: [subscription],
    item: {
      id: "m1",
      conversation_id: "c1",
      conversation_kind: "direct",
      conversation_name: null,
      body_plain: "ej napisz coś",
      attachment_count: 0,
      gif: false,
      created_at: "2026-11-27T10:00:00.000Z",
      author: { user_id: "u1", first_name: "Kacper", last_name: "S", email: null },
      ...overrides,
    },
  }) as ClaimedPush;

describe("buildPushPayload", () => {
  it("a notification: the bell sentence, the ticket and a link to it", async () => {
    const payload = await buildPushPayload(notification());
    expect(payload.title).toBe("Marta Nowak przypisał(a) Ci zgłoszenie");
    expect(payload.body).toBe("HD-000014 Drukarka nie działa");
    expect(payload.url).toContain("/dashboard/");
    expect(payload.badge).toBe(3);
    expect(payload.tag).toBe("notification:11111111-1111-4111-8111-111111111111");
    expect(payload.ref).toEqual({ notificationId: "11111111-1111-4111-8111-111111111111" });
    expect(payload.actions).toEqual({ open: "Otwórz", markRead: "Oznacz jako przeczytane" });
  });

  it("a direct message: the author as title, one notification per conversation", async () => {
    const payload = await buildPushPayload(chat());
    expect(payload).toMatchObject({
      kind: "chat",
      title: "Kacper S",
      body: "ej napisz coś",
      url: "/dashboard/messages?c=c1",
      tag: "chat:c1",
      ref: { conversationId: "c1", until: "2026-11-27T10:00:00.000Z" },
    });
  });

  it("a group message in English: group name as title, author in the body", async () => {
    const payload = await buildPushPayload(
      chat(
        {
          conversation_kind: "group",
          conversation_name: "Blacharnia",
          body_plain: "",
          attachment_count: 2,
        },
        "en"
      )
    );
    expect(payload.title).toBe("Blacharnia");
    expect(payload.body).toBe("Kacper S: 2 attachments");
    expect(payload.url).toBe("/en/dashboard/messages?c=c1");
  });
});

describe("runPushDispatch", () => {
  it("sends to each device and reports working and dead endpoints", async () => {
    const dead = { ...subscription, endpoint: "https://push.example.test/dead" };
    const rows = [notification({ subscriptions: [subscription, dead] })];
    const rpc = vi.fn(async (name: string) =>
      name === "push_claim"
        ? { data: rpc.mock.calls.length === 1 ? rows : [], error: null }
        : { data: null, error: null }
    );
    const send = vi.fn(async (target: { endpoint: string }) =>
      target.endpoint.endsWith("dead") ? ("gone" as const) : ("ok" as const)
    );

    const result = await runPushDispatch({ rpc } as never, send);

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, removed: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1] as unknown as string).badge).toBe(3);
    expect(rpc).toHaveBeenCalledWith("push_report", {
      p_ok: [subscription.endpoint],
      p_gone: [dead.endpoint],
    });
  });

  it("stops when the queue is empty", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const result = await runPushDispatch({ rpc } as never, vi.fn());
    expect(result.claimed).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
