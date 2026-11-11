import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
const runChat = vi.fn();
vi.mock("@/server/notifications/email-digest", () => ({
  runNotificationEmails: (...args: unknown[]) => run(...args),
  runChatEmails: (...args: unknown[]) => runChat(...args),
}));
vi.mock("@/server/services/email.service", () => ({
  EmailService: class {
    sendEmail = vi.fn();
  },
}));
vi.mock("@/utils/supabase/service", () => ({ createServiceClient: () => ({}) }));

import { POST } from "../route";

const SECRET = "a-long-enough-cron-secret";
const call = (authorization?: string) =>
  POST(
    new Request("https://app.example.test/api/cron/notification-emails", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    })
  );

describe("POST /api/cron/notification-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    run.mockResolvedValue({ claimed: 1, messages: 1, sent: 1, failed: 0 });
    runChat.mockResolvedValue({ claimed: 0, messages: 0, sent: 0, failed: 0 });
  });

  it("stays closed without a configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the queue with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notifications: { claimed: 1, messages: 1, sent: 1, failed: 0 },
      chat: { claimed: 0, messages: 0, sent: 0, failed: 0 },
    });
  });

  it("answers 500 when the run fails", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    run.mockRejectedValue(new Error("boom"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
