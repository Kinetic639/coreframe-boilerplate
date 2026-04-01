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
  routing: { locales: ["en", "pl"], defaultLocale: "en" },
}));

import { config, proxy } from "./proxy";

describe("proxy", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    intlMiddlewareMock.mockReset();
  });

  it("runs intl middleware, copies cookies, and sets the pathname header", async () => {
    const intlResponse = {
      headers: { set: vi.fn() },
      cookies: { set: vi.fn() },
    };
    const sessionResponse = {
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

  it("exports the middleware matcher config", () => {
    expect(config.matcher).toEqual([
      "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });
});
