import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_COOKIE_NAME,
  appUrl,
  buildSignInUrl,
  buildSignUpUrl,
  getAppUrl,
  getAuthCookieOptions,
  isCrossAppReturnUrl,
  resolveReturnUrl,
} from "../index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppUrl", () => {
  it("uses production addresses in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getAppUrl("site")).toBe("https://ambra-system.com");
    expect(getAppUrl("erp")).toBe("https://app.ambra-system.com");
    expect(getAppUrl("requests")).toBe("https://zgloszenia.ambra-system.com");
    expect(getAppUrl("vmi")).toBe("https://vmi.ambra-system.com");
  });

  it("uses local dev ports outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppUrl("erp")).toBe("http://127.0.0.1:3001");
    expect(getAppUrl("site")).toBe("http://127.0.0.1:3002");
  });

  it("prefers the configured env var and strips paths and slashes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AMBRA_ERP_URL", "https://erp.example.com/some/path/");
    expect(getAppUrl("erp")).toBe("https://erp.example.com");
    expect(appUrl("erp", "dashboard")).toBe("https://erp.example.com/dashboard");
  });

  it("ignores a configured value that is not an http(s) URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AMBRA_SITE_URL", "ambra-system.com");
    expect(getAppUrl("site")).toBe("https://ambra-system.com");
  });
});

describe("getAuthCookieOptions", () => {
  it("is host-only when no domain is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getAuthCookieOptions()).toEqual({
      name: AUTH_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("spans subdomains when the domain is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", " .ambra-system.com ");
    expect(getAuthCookieOptions()).toMatchObject({
      domain: ".ambra-system.com",
      secure: true,
    });
  });
});

describe("resolveReturnUrl", () => {
  it("accepts same-app paths", () => {
    expect(resolveReturnUrl("/dashboard/start?x=1")).toBe("/dashboard/start?x=1");
  });

  it("accepts absolute URLs on Ambra apps", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveReturnUrl("https://zgloszenia.ambra-system.com/123?tab=a")).toBe(
      "https://zgloszenia.ambra-system.com/123?tab=a"
    );
    expect(resolveReturnUrl("https://ambra-system.com")).toBe("https://ambra-system.com/");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/",
    "https://zgloszenia.ambra-system.com.evil.com/",
    "http://zgloszenia.ambra-system.com/",
    "javascript:alert(1)",
    "/o\nk",
    "",
    null,
    undefined,
  ])("refuses %s", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveReturnUrl(value)).toBeNull();
  });
});

describe("isCrossAppReturnUrl", () => {
  it("tells same-app and cross-app addresses apart", () => {
    expect(isCrossAppReturnUrl("/dashboard", "https://app.ambra-system.com")).toBe(false);
    expect(
      isCrossAppReturnUrl("https://app.ambra-system.com/x", "https://app.ambra-system.com/")
    ).toBe(false);
    expect(
      isCrossAppReturnUrl("https://zgloszenia.ambra-system.com/", "https://app.ambra-system.com")
    ).toBe(true);
  });
});

describe("buildSignInUrl", () => {
  it("points at the ERP sign-in with a return address", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildSignInUrl("https://zgloszenia.ambra-system.com/42")).toBe(
      "https://app.ambra-system.com/logowanie?returnUrl=https%3A%2F%2Fzgloszenia.ambra-system.com%2F42"
    );
    expect(buildSignInUrl(null, "en")).toBe("https://app.ambra-system.com/en/sign-in");
  });

  it("drops a return address it would not honor", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildSignInUrl("https://evil.com/")).toBe("https://app.ambra-system.com/logowanie");
  });
});

describe("buildSignUpUrl", () => {
  it("points at the ERP sign-up page", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildSignUpUrl()).toBe("https://app.ambra-system.com/rejestracja");
    expect(buildSignUpUrl("en")).toBe("https://app.ambra-system.com/en/sign-up");
  });
});
