/**
 * @vitest-environment node
 *
 * Admin page security tests — verifies that each admin page:
 * 1. Redirects to /sign-in when unauthenticated (no context)
 * 2. Redirects to /dashboard/start when authenticated but not an admin
 * 3. Redirects to /dashboard/start when admin but lacking the specific permission
 * 4. Renders (returns JSX) when fully authorized
 *
 * SECURITY GUARANTEE: No page should be accessible without explicit
 * admin entitlements AND the specific permission slug.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock redirect — simulates Next.js redirect throws so we can assert on them
// ---------------------------------------------------------------------------
const mockRedirect = vi.fn((options) => {
  const error = new Error("NEXT_REDIRECT");
  (error as any).redirectTarget = options;
  throw error;
});

vi.mock("@/i18n/navigation", () => ({
  redirect: (options: any) => mockRedirect(options),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
}));

// ---------------------------------------------------------------------------
// Mock the admin context loader
// ---------------------------------------------------------------------------
const mockLoadAdminContextV2 = vi.fn();
vi.mock("@/server/loaders/v2/load-admin-context.v2", () => ({
  loadAdminContextV2: (...args: any[]) => mockLoadAdminContextV2(...args),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
function makeAdminContext(
  overrides: Partial<{
    enabled: boolean;
    allow: string[];
    deny: string[];
  }> = {}
) {
  const { enabled = true, allow = ["superadmin.*"], deny = [] } = overrides;
  return {
    user: {
      id: "user-123",
      email: "admin@example.com",
      first_name: "Admin",
      last_name: "User",
      avatar_url: null,
    },
    avatar_signed_url: null,
    adminEntitlements: { user_id: "user-123", enabled, updated_at: "2026-01-01T00:00:00Z" },
    permissionSnapshot: { allow, deny },
  };
}

function getRedirectTarget(error: any): string {
  return error.redirectTarget?.href ?? "";
}

// ---------------------------------------------------------------------------
// Admin Home Page
// ---------------------------------------------------------------------------
describe("AdminHomePage security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to /sign-in when context is null (unauthenticated)", async () => {
    mockLoadAdminContextV2.mockResolvedValue(null);
    const { default: AdminHomePage } = await import("../page");

    const error = await AdminHomePage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /sign-in when adminEntitlements is null", async () => {
    mockLoadAdminContextV2.mockResolvedValue({
      ...makeAdminContext(),
      adminEntitlements: null,
    });
    const { default: AdminHomePage } = await import("../page");

    const error = await AdminHomePage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /sign-in when adminEntitlements.enabled is false", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext({ enabled: false }));
    const { default: AdminHomePage } = await import("../page");

    const error = await AdminHomePage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /dashboard/start when missing superadmin.admin.read", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.plans.read"], deny: [] })
    );
    const { default: AdminHomePage } = await import("../page");

    const error = await AdminHomePage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/dashboard/start");
  });

  it("should render when user has superadmin wildcard permission", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext());
    const { default: AdminHomePage } = await import("../page");

    const result = await AdminHomePage();

    // Should NOT throw a redirect
    expect(result).toBeTruthy();
  });

  it("should render when user has granular superadmin.admin.read permission", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.admin.read"] })
    );
    const { default: AdminHomePage } = await import("../page");

    const result = await AdminHomePage();

    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Admin Plans Page
// ---------------------------------------------------------------------------
describe("AdminPlansPage security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should redirect to /sign-in when context is null", async () => {
    mockLoadAdminContextV2.mockResolvedValue(null);
    const { default: AdminPlansPage } = await import("../plans/page");

    const error = await AdminPlansPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /sign-in when adminEntitlements.enabled is false", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext({ enabled: false }));
    const { default: AdminPlansPage } = await import("../plans/page");

    const error = await AdminPlansPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /dashboard/start when missing superadmin.plans.read", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.admin.read"], deny: [] })
    );
    const { default: AdminPlansPage } = await import("../plans/page");

    const error = await AdminPlansPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/dashboard/start");
  });

  it("should render when user has superadmin wildcard", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext());
    const { default: AdminPlansPage } = await import("../plans/page");

    const result = await AdminPlansPage();

    expect(result).toBeTruthy();
  });

  it("should render when user has granular superadmin.plans.read permission", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.plans.read"] })
    );
    const { default: AdminPlansPage } = await import("../plans/page");

    const result = await AdminPlansPage();

    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Admin Pricing Page
// ---------------------------------------------------------------------------
describe("AdminPricingPage security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should redirect to /sign-in when context is null", async () => {
    mockLoadAdminContextV2.mockResolvedValue(null);
    const { default: AdminPricingPage } = await import("../pricing/page");

    const error = await AdminPricingPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /sign-in when adminEntitlements.enabled is false", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext({ enabled: false }));
    const { default: AdminPricingPage } = await import("../pricing/page");

    const error = await AdminPricingPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/sign-in");
  });

  it("should redirect to /dashboard/start when missing superadmin.pricing.read", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.plans.read"], deny: [] })
    );
    const { default: AdminPricingPage } = await import("../pricing/page");

    const error = await AdminPricingPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/dashboard/start");
  });

  it("should render when user has superadmin wildcard", async () => {
    mockLoadAdminContextV2.mockResolvedValue(makeAdminContext());
    const { default: AdminPricingPage } = await import("../pricing/page");

    const result = await AdminPricingPage();

    expect(result).toBeTruthy();
  });

  it("should render when user has granular superadmin.pricing.read permission", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.pricing.read"] })
    );
    const { default: AdminPricingPage } = await import("../pricing/page");

    const result = await AdminPricingPage();

    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Cross-page: deny-first semantics
// ---------------------------------------------------------------------------
describe("Admin pages: deny-first security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("AdminHomePage: should deny access when superadmin.admin.read is explicitly denied despite wildcard allow", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.*"], deny: ["superadmin.admin.read"] })
    );
    const { default: AdminHomePage } = await import("../page");

    const error = await AdminHomePage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/dashboard/start");
  });

  it("AdminPlansPage: should deny access when superadmin.plans.read is explicitly denied despite wildcard allow", async () => {
    mockLoadAdminContextV2.mockResolvedValue(
      makeAdminContext({ allow: ["superadmin.*"], deny: ["superadmin.plans.read"] })
    );
    const { default: AdminPlansPage } = await import("../plans/page");

    const error = await AdminPlansPage().catch((e) => e);

    expect(error.message).toBe("NEXT_REDIRECT");
    expect(getRedirectTarget(error)).toBe("/dashboard/start");
  });
});
