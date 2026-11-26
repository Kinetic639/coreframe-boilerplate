import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, createServerClient } = vi.hoisted(() => {
  const getClaims = vi.fn();
  return { getClaims, createServerClient: vi.fn(() => ({ auth: { getClaims } })) };
});

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "../proxy";

function signedIn() {
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
}

function signedOut() {
  getClaims.mockResolvedValue({ data: null, error: new Error("no session") });
}

const request = (path: string) => new NextRequest(new URL(path, "http://127.0.0.1:3001"));

describe("updateSession (shared sign-in)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the shared Ambra auth cookie", async () => {
    signedOut();
    await updateSession(request("/logowanie"));
    const options = (createServerClient.mock.calls[0] as unknown[])[2];
    expect(options).toMatchObject({ cookieOptions: { name: "ambra-auth", path: "/" } });
  });

  it("sends a signed-in user straight back to the Ambra app that asked for sign-in", async () => {
    signedIn();
    const response = await updateSession(
      request("/logowanie?returnUrl=" + encodeURIComponent("http://127.0.0.1:3004/42"))
    );
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3004/42");
  });

  it("ignores a return address outside Ambra and opens the dashboard", async () => {
    signedIn();
    const response = await updateSession(
      request("/logowanie?returnUrl=" + encodeURIComponent("https://evil.example/"))
    );
    expect(response.headers.get("location")).toMatch(/^http:\/\/[^/]+:3001\/dashboard\/start$/);
  });

  it("keeps a signed-out user on the sign-in page", async () => {
    signedOut();
    const response = await updateSession(
      request("/logowanie?returnUrl=" + encodeURIComponent("http://127.0.0.1:3004/42"))
    );
    expect(response.headers.get("location")).toBeNull();
  });
});
