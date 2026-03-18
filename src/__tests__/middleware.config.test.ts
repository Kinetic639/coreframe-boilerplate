/**
 * @vitest-environment node
 *
 * Tests for the middleware matcher pattern — verifies G5 fix.
 *
 * G5 root cause: original matcher ran on /api/* and /auth/* routes,
 * adding unnecessary getUser() round-trips and risking next-intl
 * locale detection interfering with binary API responses (PDFs) and
 * auth callback routes that manage their own session exchange.
 *
 * We test the regex pattern directly rather than importing middleware.ts
 * because the Next.js Edge runtime imports (next-intl/middleware, @supabase/ssr)
 * cannot run in the vitest Node environment. The pattern here must exactly
 * match the matcher in src/middleware.ts — if the middleware changes,
 * update this constant and re-run the tests.
 */
import { describe, it, expect } from "vitest";

// ─── Canonical pattern — MUST match config.matcher[0] in src/middleware.ts ───

/**
 * The middleware matcher pattern from src/middleware.ts.
 *
 * Runs on all page/layout routes.
 * Excludes: _next/static, _next/image, favicon.ico, /api/*, /auth/*, static assets.
 */
const MIDDLEWARE_MATCHER =
  "/((?!_next/static|_next/image|favicon\\.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matcherMatches(pattern: string, path: string): boolean {
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(path);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("middleware matcher — G5: correct route scope", () => {
  // ── Routes that MUST be matched (session refresh + next-intl needed) ───────

  it("matches root path", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/")).toBe(true);
  });

  it("matches dashboard page routes", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/dashboard/start")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/en/dashboard/start")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/dashboard/organization/users/members")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/dashboard/access-denied")).toBe(true);
  });

  it("matches admin panel routes", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/admin")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/admin/plans")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/en/admin/app-management")).toBe(true);
  });

  it("matches localized auth page routes (sign-in/up pages under locale)", () => {
    // These are Next.js page routes rendered by [locale]/sign-in, etc.
    // They are NOT the /auth/* Route Handler callbacks.
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/logowanie")).toBe(true); // pl sign-in
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/en/sign-in")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/rejestracja")).toBe(true); // pl sign-up
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/en/sign-up")).toBe(true);
  });

  it("matches onboarding and invite page routes", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/onboarding")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/invite/some-token")).toBe(true);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/zaproszenie/some-token")).toBe(true); // pl
  });

  // ── Routes that MUST NOT be matched (excluded from middleware) ─────────────

  it("does NOT match /api/* — G5 fix: avoids getUser() overhead + next-intl interference", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/labels/pdf")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/labels/generate")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/send")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/qr/verify")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/check-migration")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/ui-settings")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/api/labels/templates/abc/fields")).toBe(false);
  });

  it("does NOT match /auth/* — G5 fix: auth callbacks manage their own session exchange", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/auth/callback")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/auth/confirm")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/auth/auth-code-error")).toBe(false);
  });

  it("does NOT match Next.js internal routes", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/_next/static/chunks/main.js")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/_next/image")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/favicon.ico")).toBe(false);
  });

  it("does NOT match static image/font assets", () => {
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/logo.svg")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/hero.png")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/photo.jpg")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/photo.jpeg")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/animation.gif")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/image.webp")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/font.woff")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/font.woff2")).toBe(false);
    expect(matcherMatches(MIDDLEWARE_MATCHER, "/public/images/hero.png")).toBe(false);
  });
});
