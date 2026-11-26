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

  it("ignores a return address outside Ambra and opens the app chooser", async () => {
    signedIn();
    const response = await updateSession(
      request("/logowanie?returnUrl=" + encodeURIComponent("https://evil.example/"))
    );
    expect(response.headers.get("location")).toMatch(/^http:\/\/[^/]+:3001\/aplikacje$/);
  });

  it("sends a signed-in user on the bare root to the app chooser", async () => {
    signedIn();
    const response = await updateSession(request("/en"));
    expect(response.headers.get("location")).toMatch(/^http:\/\/[^/]+:3001\/en\/apps$/);
  });

  it("sends a signed-out user from the app chooser to sign-in and back", async () => {
    signedOut();
    const response = await updateSession(request("/aplikacje"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/logowanie");
    expect(location.searchParams.get("returnUrl")).toBe("/aplikacje");
  });

  it("remembers the ERP as the last app opened", async () => {
    signedIn();
    const response = await updateSession(request("/dashboard/start"));
    expect(response.cookies.get("ambra-last-app")?.value).toBe("erp");
  });

  it("does not rewrite the last-app cookie when it already says ERP", async () => {
    signedIn();
    const req = request("/dashboard/start");
    req.cookies.set("ambra-last-app", "erp");
    const response = await updateSession(req);
    expect(response.cookies.get("ambra-last-app")).toBeUndefined();
  });

  it("keeps a signed-out user on the sign-in page", async () => {
    signedOut();
    const response = await updateSession(
      request("/logowanie?returnUrl=" + encodeURIComponent("http://127.0.0.1:3004/42"))
    );
    expect(response.headers.get("location")).toBeNull();
  });
});
