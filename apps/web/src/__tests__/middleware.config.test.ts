/**
 * @vitest-environment node
 *
 * Tests for the proxy.ts matcher config — verifies G5 fix.
 *
 * Next.js 16 uses proxy.ts (not middleware.ts) for edge routing.
 * The proxy function (src/proxy.ts) handles:
 *   - Supabase session refresh via updateSession()
 *   - next-intl locale routing
 *
 * G5: the matcher must NOT run on /api/* or /auth/* routes —
 * API Route Handlers own their auth; auth callback routes manage their
 * own session exchange and must not be interrupted by session refresh.
 *
 * We test the regex pattern directly because importing proxy.ts triggers
 * Next.js Edge runtime imports (next-intl/middleware) that cannot run
 * in the vitest Node environment. The PROXY_MATCHER constant here MUST
 * match config.matcher[0] in src/proxy.ts — update both together.
 */
import { describe, it, expect } from "vitest";

// ─── Canonical pattern — MUST match config.matcher[0] in src/proxy.ts ────────

const PROXY_MATCHER =
  "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matcherMatches(pattern: string, path: string): boolean {
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(path);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("proxy.ts config.matcher — G5: correct route scope", () => {
  // ── Routes that MUST be matched (session refresh + next-intl needed) ───────

  it("matches root path", () => {
    expect(matcherMatches(PROXY_MATCHER, "/")).toBe(true);
  });

  it("matches dashboard page routes", () => {
    expect(matcherMatches(PROXY_MATCHER, "/dashboard/start")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/en/dashboard/start")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/dashboard/organization/users/members")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/dashboard/access-denied")).toBe(true);
  });

  it("matches admin panel routes", () => {
    expect(matcherMatches(PROXY_MATCHER, "/admin")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/admin/plans")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/en/admin/app-management")).toBe(true);
  });

  it("matches localized auth page routes (sign-in/up pages under locale)", () => {
    // These are Next.js page routes — NOT the /auth/* Route Handler callbacks
    expect(matcherMatches(PROXY_MATCHER, "/logowanie")).toBe(true); // pl: sign-in
    expect(matcherMatches(PROXY_MATCHER, "/en/sign-in")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/rejestracja")).toBe(true); // pl: sign-up
    expect(matcherMatches(PROXY_MATCHER, "/en/sign-up")).toBe(true);
  });

  it("matches onboarding and invite page routes", () => {
    expect(matcherMatches(PROXY_MATCHER, "/onboarding")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/invite/some-token")).toBe(true);
    expect(matcherMatches(PROXY_MATCHER, "/zaproszenie/some-token")).toBe(true); // pl
  });

  // ── Routes that MUST NOT be matched (excluded from proxy) ─────────────────

  it("does NOT match /api/* — avoids getUser() overhead + next-intl interference on API calls", () => {
    expect(matcherMatches(PROXY_MATCHER, "/api/labels/pdf")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/labels/generate")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/send")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/qr/verify")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/check-migration")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/ui-settings")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/api/labels/templates/abc/fields")).toBe(false);
  });

  it("does NOT match /auth/* — auth callbacks manage their own session exchange", () => {
    expect(matcherMatches(PROXY_MATCHER, "/auth/callback")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/auth/confirm")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/auth/auth-code-error")).toBe(false);
  });

  it("does NOT match Next.js internal routes", () => {
    expect(matcherMatches(PROXY_MATCHER, "/_next/static/chunks/main.js")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/_next/image")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/favicon.ico")).toBe(false);
  });

  it("does NOT match static image assets", () => {
    expect(matcherMatches(PROXY_MATCHER, "/logo.svg")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/hero.png")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/photo.jpg")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/photo.jpeg")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/animation.gif")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/image.webp")).toBe(false);
    expect(matcherMatches(PROXY_MATCHER, "/public/images/hero.png")).toBe(false);
  });
});
