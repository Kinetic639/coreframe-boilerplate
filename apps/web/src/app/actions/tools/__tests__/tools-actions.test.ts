/**
 * @vitest-environment node
 *
 * Tests: app/actions/tools/index.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));

vi.mock("@/server/services/tools.service", () => ({
  ToolsCatalogService: {
    listCatalog: vi.fn(),
    getToolBySlug: vi.fn(),
  },
  UserToolsService: {
    listUserEnabledTools: vi.fn(),
    getUserToolRecord: vi.fn(),
    setToolEnabled: vi.fn(),
    setToolPinned: vi.fn(),
    updateToolSettings: vi.fn(),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ToolsCatalogService, UserToolsService } from "@/server/services/tools.service";
import { createClient } from "@/utils/supabase/server";

import {
  listToolsCatalogAction,
  getToolBySlugAction,
  listMyEnabledToolsAction,
  getMyToolRecordAction,
  setToolEnabledAction,
  setToolPinnedAction,
  updateToolSettingsAction,
} from "../index";

// ─── Context helpers ──────────────────────────────────────────────────────────

const CTX_READ = {
  app: { activeOrgId: "org-1" },
  user: { permissionSnapshot: { allow: ["tools.read", "tools.manage"], deny: [] } },
};
const CTX_NO_MANAGE = {
  app: { activeOrgId: "org-1" },
  user: { permissionSnapshot: { allow: ["tools.read"], deny: [] } },
};
const CTX_NO_PERM = {
  app: { activeOrgId: "org-1" },
  user: { permissionSnapshot: { allow: [], deny: [] } },
};

function resetCreateClient() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
  } as never);
}

function setCtx(ctx: unknown) {
  vi.mocked(loadDashboardContextV2).mockResolvedValue(ctx as never);
}

// ─── listToolsCatalogAction ───────────────────────────────────────────────────

describe("listToolsCatalogAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("returns catalog when authorized", async () => {
    const catalog = [{ id: "t-1", slug: "calc", name: "Calculator" }];
    vi.mocked(ToolsCatalogService.listCatalog).mockResolvedValue({
      success: true,
      data: catalog as never,
    });
    const result = await listToolsCatalogAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(catalog);
  });

  it("returns unauthenticated when no user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);
    const result = await listToolsCatalogAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthenticated");
  });

  it("returns error when no active org", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await listToolsCatalogAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("No active organisation");
  });

  it("returns unauthorized when missing tools.read", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listToolsCatalogAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns service error", async () => {
    vi.mocked(ToolsCatalogService.listCatalog).mockResolvedValue({
      success: false,
      error: "DB error",
    });
    const result = await listToolsCatalogAction();
    expect(result.success).toBe(false);
  });
});

// ─── getToolBySlugAction ──────────────────────────────────────────────────────

describe("getToolBySlugAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("returns tool when found", async () => {
    const tool = { id: "t-1", slug: "calc", name: "Calculator" };
    vi.mocked(ToolsCatalogService.getToolBySlug).mockResolvedValue({
      success: true,
      data: tool as never,
    });
    const result = await getToolBySlugAction("calc");
    expect(result.success).toBe(true);
    expect(ToolsCatalogService.getToolBySlug).toHaveBeenCalledWith(expect.anything(), "calc");
  });

  it("returns unauthorized when missing tools.read", async () => {
    setCtx(CTX_NO_PERM);
    const result = await getToolBySlugAction("calc");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });
});

// ─── listMyEnabledToolsAction ─────────────────────────────────────────────────

describe("listMyEnabledToolsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("returns enabled tools for user", async () => {
    const tools = [{ id: "ut-1", tool_slug: "calc", user_id: "user-1", enabled: true }];
    vi.mocked(UserToolsService.listUserEnabledTools).mockResolvedValue({
      success: true,
      data: tools as never,
    });
    const result = await listMyEnabledToolsAction();
    expect(result.success).toBe(true);
    expect(UserToolsService.listUserEnabledTools).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("returns unauthorized when missing tools.read", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listMyEnabledToolsAction();
    expect(result.success).toBe(false);
  });
});

// ─── getMyToolRecordAction ────────────────────────────────────────────────────

describe("getMyToolRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("returns tool record when found", async () => {
    const record = { id: "ut-1", tool_slug: "calc", user_id: "user-1", enabled: true };
    vi.mocked(UserToolsService.getUserToolRecord).mockResolvedValue({
      success: true,
      data: record as never,
    });
    const result = await getMyToolRecordAction("calc");
    expect(result.success).toBe(true);
    expect(UserToolsService.getUserToolRecord).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "calc"
    );
  });

  it("returns unauthorized when missing tools.read", async () => {
    setCtx(CTX_NO_PERM);
    const result = await getMyToolRecordAction("calc");
    expect(result.success).toBe(false);
  });
});

// ─── setToolEnabledAction ─────────────────────────────────────────────────────

describe("setToolEnabledAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("enables a tool and returns updated record", async () => {
    const record = { id: "ut-1", tool_slug: "calc", user_id: "user-1", enabled: true };
    vi.mocked(UserToolsService.setToolEnabled).mockResolvedValue({
      success: true,
      data: record as never,
    });
    const result = await setToolEnabledAction({ toolSlug: "calc", enabled: true });
    expect(result.success).toBe(true);
    expect(UserToolsService.setToolEnabled).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "calc",
      true
    );
  });

  it("returns unauthorized when missing tools.manage", async () => {
    setCtx(CTX_NO_MANAGE);
    const result = await setToolEnabledAction({ toolSlug: "calc", enabled: true });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns validation error for invalid input", async () => {
    const result = await setToolEnabledAction({ toolSlug: "", enabled: true });
    expect(result.success).toBe(false);
  });

  it("returns no active org error", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await setToolEnabledAction({ toolSlug: "calc", enabled: false });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("No active organisation");
  });
});

// ─── setToolPinnedAction ──────────────────────────────────────────────────────

describe("setToolPinnedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("pins a tool and returns updated record", async () => {
    const record = { id: "ut-1", tool_slug: "calc", user_id: "user-1", pinned: true };
    vi.mocked(UserToolsService.setToolPinned).mockResolvedValue({
      success: true,
      data: record as never,
    });
    const result = await setToolPinnedAction({ toolSlug: "calc", pinned: true });
    expect(result.success).toBe(true);
    expect(UserToolsService.setToolPinned).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "calc",
      true
    );
  });

  it("returns unauthorized when missing tools.manage", async () => {
    setCtx(CTX_NO_MANAGE);
    const result = await setToolPinnedAction({ toolSlug: "calc", pinned: true });
    expect(result.success).toBe(false);
  });

  it("returns validation error for invalid input", async () => {
    const result = await setToolPinnedAction({ toolSlug: "", pinned: false });
    expect(result.success).toBe(false);
  });
});

// ─── updateToolSettingsAction ─────────────────────────────────────────────────

describe("updateToolSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreateClient();
    setCtx(CTX_READ);
  });

  it("updates settings and returns record", async () => {
    const record = { id: "ut-1", tool_slug: "calc", settings: { theme: "dark" } };
    vi.mocked(UserToolsService.updateToolSettings).mockResolvedValue({
      success: true,
      data: record as never,
    });
    const result = await updateToolSettingsAction({
      toolSlug: "calc",
      settings: { theme: "dark" },
    });
    expect(result.success).toBe(true);
    expect(UserToolsService.updateToolSettings).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "calc",
      { theme: "dark" }
    );
  });

  it("returns unauthorized when missing tools.manage", async () => {
    setCtx(CTX_NO_MANAGE);
    const result = await updateToolSettingsAction({ toolSlug: "calc", settings: {} });
    expect(result.success).toBe(false);
  });

  it("returns service error", async () => {
    vi.mocked(UserToolsService.updateToolSettings).mockResolvedValue({
      success: false,
      error: "Not found",
    });
    const result = await updateToolSettingsAction({ toolSlug: "calc", settings: { x: 1 } });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Not found");
  });
});
