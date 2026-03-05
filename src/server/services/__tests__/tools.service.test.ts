/**
 * @vitest-environment node
 *
 * Tools Service — Unit Test Stubs
 *
 * These tests validate:
 * T-TOOLS-SERVICE: ToolsCatalogService + UserToolsService behaviour
 * T-TOOLS-RLS:     RLS enforcement (self-only on user_enabled_tools)
 * T-TOOLS-ACTIONS: Server action auth + permission gating stubs
 */
import { describe, it, expect, vi } from "vitest";
import { ToolsCatalogService, UserToolsService } from "../tools.service";
import type { ServiceResult, ToolCatalogItem, UserEnabledTool } from "../tools.service";

// ---------------------------------------------------------------------------
// Mock Supabase helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-uuid-1";
const TOOL_SLUG = "qr-generator";

function makeSupabase(overrides: {
  selectResult?: { data: unknown; error: unknown };
  upsertResult?: { data: unknown; error: unknown };
}) {
  const selectResult = overrides.selectResult ?? { data: [], error: null };
  const upsertResult = overrides.upsertResult ?? { data: null, error: null };

  return {
    from: vi.fn((table: string) => {
      if (table === "tools_catalog") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(selectResult),
          maybeSingle: vi.fn().mockResolvedValue(selectResult),
        };
      }
      if (table === "user_enabled_tools") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(selectResult),
          maybeSingle: vi.fn().mockResolvedValue(selectResult),
          upsert: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(upsertResult),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(selectResult),
        maybeSingle: vi.fn().mockResolvedValue(selectResult),
      };
    }),
  };
}

// Helper: assert success branch
function assertSuccess<T>(result: ServiceResult<T>): T {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("Expected success");
  return result.data;
}

// Helper: assert failure branch
function assertFailure<T>(result: ServiceResult<T>): string {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected failure");
  return (result as { success: false; error: string }).error;
}

// ---------------------------------------------------------------------------
// T-TOOLS-SERVICE: ToolsCatalogService
// ---------------------------------------------------------------------------

describe("[T-TOOLS-SERVICE] ToolsCatalogService", () => {
  it("listCatalog returns success with data array on valid response", async () => {
    const mockTools = [{ slug: TOOL_SLUG, name: "QR Code Generator", is_active: true }];
    const result = await ToolsCatalogService.listCatalog(
      makeSupabase({ selectResult: { data: mockTools, error: null } }) as any
    );
    const data = assertSuccess(result);
    expect(data).toEqual(mockTools);
  });

  it("listCatalog returns failure when DB returns error", async () => {
    const result = await ToolsCatalogService.listCatalog(
      makeSupabase({
        selectResult: { data: null, error: { message: "DB error", code: "XXXXX" } },
      }) as any
    );
    const error = assertFailure(result);
    expect(error).toBeTruthy();
  });

  it("listCatalog returns empty array when no tools exist", async () => {
    const result = await ToolsCatalogService.listCatalog(
      makeSupabase({ selectResult: { data: [], error: null } }) as any
    );
    const data = assertSuccess(result);
    expect(data).toEqual([]);
  });

  it("getToolBySlug returns null data for non-existent slug", async () => {
    const result = await ToolsCatalogService.getToolBySlug(
      makeSupabase({ selectResult: { data: null, error: null } }) as any,
      "nonexistent"
    );
    const data = assertSuccess(result as ServiceResult<ToolCatalogItem | null>);
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-TOOLS-SERVICE: UserToolsService
// ---------------------------------------------------------------------------

describe("[T-TOOLS-SERVICE] UserToolsService", () => {
  it("listUserEnabledTools returns rows for user", async () => {
    const mockRows = [
      { id: "row-1", user_id: USER_ID, tool_slug: TOOL_SLUG, enabled: true, pinned: false },
    ];
    const result = await UserToolsService.listUserEnabledTools(
      makeSupabase({ selectResult: { data: mockRows, error: null } }) as any,
      USER_ID
    );
    const data = assertSuccess(result);
    expect(data).toEqual(mockRows);
  });

  it("setToolEnabled upserts with enabled=true and returns the row", async () => {
    const mockRow: Partial<UserEnabledTool> = {
      id: "row-1",
      user_id: USER_ID,
      tool_slug: TOOL_SLUG,
      enabled: true,
      pinned: false,
    };
    const result = await UserToolsService.setToolEnabled(
      makeSupabase({ upsertResult: { data: mockRow, error: null } }) as any,
      USER_ID,
      TOOL_SLUG,
      true
    );
    const data = assertSuccess(result);
    expect(data.enabled).toBe(true);
  });

  it("setToolPinned upserts with pinned=true and returns the row", async () => {
    const mockRow: Partial<UserEnabledTool> = {
      id: "row-1",
      user_id: USER_ID,
      tool_slug: TOOL_SLUG,
      enabled: false,
      pinned: true,
    };
    const result = await UserToolsService.setToolPinned(
      makeSupabase({ upsertResult: { data: mockRow, error: null } }) as any,
      USER_ID,
      TOOL_SLUG,
      true
    );
    const data = assertSuccess(result);
    expect(data.pinned).toBe(true);
  });

  it("setToolEnabled normalises RLS violation to friendly error string", async () => {
    const rlsError = { message: "new row violates row-level security policy", code: "42501" };
    const result = await UserToolsService.setToolEnabled(
      makeSupabase({ upsertResult: { data: null, error: rlsError } }) as any,
      USER_ID,
      TOOL_SLUG,
      true
    );
    const error = assertFailure(result);
    expect(error.toLowerCase()).toContain("permission");
  });
});

// ---------------------------------------------------------------------------
// T-TOOLS-RLS: Stub integration tests (require live DB in CI)
// ---------------------------------------------------------------------------

describe("[T-TOOLS-RLS] RLS integration stubs (live DB only)", () => {
  it.todo("user_enabled_tools: user can select their own rows only");
  it.todo("user_enabled_tools: user cannot select another user's rows (expect 0 rows)");
  it.todo("user_enabled_tools: user can insert row with their own user_id");
  it.todo("user_enabled_tools: user cannot insert row with a different user_id (expect RLS error)");
  it.todo("user_enabled_tools: user can update their own row");
  it.todo("user_enabled_tools: user cannot update another user's row");
  it.todo("user_enabled_tools: user can delete their own row");
  it.todo("tools_catalog: authenticated user can select active tools");
  it.todo("tools_catalog: unauthenticated user cannot select tools");
});

// ---------------------------------------------------------------------------
// T-TOOLS-ACTIONS: Server action auth + permission stubs
// ---------------------------------------------------------------------------

describe("[T-TOOLS-ACTIONS] Server action auth + permission stubs", () => {
  it.todo("listToolsCatalogAction: returns Unauthorized when tools.read permission is missing");
  it.todo("listToolsCatalogAction: returns success when tools.read is present");
  it.todo("setToolEnabledAction: returns Unauthorized when tools.manage permission is missing");
  it.todo("setToolEnabledAction: validates toolSlug — rejects empty string");
  it.todo("setToolEnabledAction: upserts row when input is valid");
  it.todo("setToolPinnedAction: returns Unauthorized when tools.manage permission is missing");
  it.todo("updateToolSettingsAction: validates input schema and rejects invalid settings");
  it.todo("getToolBySlugAction: returns null data for inactive tool slug");
});
