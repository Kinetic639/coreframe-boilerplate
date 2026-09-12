import { describe, expect, it, vi, beforeEach } from "vitest";

const { updateSessionMock, intlMiddlewareMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn(),
  intlMiddlewareMock: vi.fn(),
}));

vi.mock("@/utils/supabase/proxy", () => ({
  updateSession: updateSessionMock,
}));

vi.mock("next-intl/middleware", () => ({
  default: () => intlMiddlewareMock,
}));

vi.mock("./i18n/routing", () => ({
  routing: {
    locales: ["en", "pl"],
    defaultLocale: "en",
    pathnames: { "/sign-in": { en: "/sign-in", pl: "/logowanie" } },
  },
}));

import { config, proxy } from "./proxy";

describe("proxy", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    intlMiddlewareMock.mockReset();
  });

  it("runs intl middleware, copies cookies, and sets the pathname header", async () => {
    const intlResponse = {
      headers: { get: () => null, set: vi.fn() },
      cookies: { set: vi.fn() },
    };
    const sessionResponse = {
      headers: { get: () => null },
      cookies: {
        getAll: () => [
          { name: "sb-access-token", value: "token", path: "/", httpOnly: true },
          { name: "sb-refresh-token", value: "refresh", sameSite: "lax" },
        ],
      },
    };

    intlMiddlewareMock.mockReturnValue(intlResponse);
    updateSessionMock.mockResolvedValue(sessionResponse);

    const request = { nextUrl: { pathname: "/dashboard/tools" } } as any;
    const result = await proxy(request);

    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(intlResponse.headers.set).toHaveBeenCalledWith("x-pathname", "/dashboard/tools");
    expect(intlResponse.cookies.set).toHaveBeenNthCalledWith(1, "sb-access-token", "token", {
      path: "/",
      httpOnly: true,
    });
    expect(intlResponse.cookies.set).toHaveBeenNthCalledWith(2, "sb-refresh-token", "refresh", {
      sameSite: "lax",
    });
    expect(result).toBe(intlResponse);
  });

  it("returns updateSession's redirect instead of the intl rewrite response", async () => {
    const intlResponse = {
      headers: { get: () => null, set: vi.fn() },
      cookies: { set: vi.fn(), getAll: () => [{ name: "NEXT_LOCALE", value: "pl" }] },
    };
    const redirectResponse = {
      headers: { get: (name: string) => (name === "location" ? "/logowanie" : null) },
      cookies: { set: vi.fn(), getAll: () => [] },
    };

    intlMiddlewareMock.mockReturnValue(intlResponse);
    updateSessionMock.mockResolvedValue(redirectResponse);

    const request = { nextUrl: { pathname: "/dashboard/start" } } as any;
    const result = await proxy(request);

    expect(result).toBe(redirectResponse);
    expect(redirectResponse.cookies.set).toHaveBeenCalledWith("NEXT_LOCALE", "pl", {
      name: "NEXT_LOCALE",
      value: "pl",
    });
  });

  it("exports the middleware matcher config", () => {
    expect(config.matcher).toEqual([
      "/((?!api|auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|pl(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });

  it("downgrades an https same-origin x-middleware-rewrite header back to http (regression guard: forwarded-https reverse proxy would otherwise make Next.js treat the internal locale rewrite as cross-origin and fail with EPROTO)", async () => {
    const headers = new Headers();
    headers.set("x-middleware-rewrite", "https://127.0.0.1:3001/pl/sign-in");
    const intlResponse = {
      headers,
      cookies: { set: vi.fn() },
    };
    const sessionResponse = {
      headers: { get: () => null },
      cookies: { getAll: () => [] },
    };

    intlMiddlewareMock.mockReturnValue(intlResponse);
    updateSessionMock.mockResolvedValue(sessionResponse);

    const request = {
      nextUrl: { pathname: "/logowanie", hostname: "127.0.0.1" },
    } as any;
    const result = await proxy(request);

    expect(result.headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3001/pl/sign-in");
  });

  it("leaves a rewrite header pointing at a different host untouched (defensive -- this app has no cross-origin rewrites today, but the fix must not blindly strip legitimate external targets)", async () => {
    const headers = new Headers();
    headers.set("x-middleware-rewrite", "https://other-host.example.com/path");
    const intlResponse = {
      headers,
      cookies: { set: vi.fn() },
    };
    const sessionResponse = {
      headers: { get: () => null },
      cookies: { getAll: () => [] },
    };

    intlMiddlewareMock.mockReturnValue(intlResponse);
    updateSessionMock.mockResolvedValue(sessionResponse);

    const request = {
      nextUrl: { pathname: "/dashboard/start", hostname: "127.0.0.1" },
    } as any;
    const result = await proxy(request);

    expect(result.headers.get("x-middleware-rewrite")).toBe("https://other-host.example.com/path");
  });

  it("matcher excludes next-intl's internal rewrite target for the default locale (regression guard)", () => {
    // See @repo/i18n/middleware-utils for the full story: without this
    // exclusion, next-intl's own internal rewrite for an unprefixed
    // default-locale request re-enters this middleware and causes an
    // infinite redirect loop.
    const [pattern] = config.matcher;
    const matcherRegex = new RegExp(`^${pattern}$`);
    expect(matcherRegex.test("/pl")).toBe(false);
    expect(matcherRegex.test("/pl/sign-in")).toBe(false);
    expect(matcherRegex.test("/logowanie")).toBe(true);
    expect(matcherRegex.test("/en/sign-in")).toBe(true);
  });
});
