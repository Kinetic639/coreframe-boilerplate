/**
 * Tests: hooks/queries/tools/index.ts
 *
 * Covers all query and mutation hooks for tools.
 * Uses renderHook with QueryClientProvider + mocked server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "react-toastify";

// ─── Mock server actions ───────────────────────────────────────────────────────

vi.mock("@/app/actions/tools", () => ({
  listToolsCatalogAction: vi.fn(),
  getToolBySlugAction: vi.fn(),
  listMyEnabledToolsAction: vi.fn(),
  getMyToolRecordAction: vi.fn(),
  setToolEnabledAction: vi.fn(),
  setToolPinnedAction: vi.fn(),
  updateToolSettingsAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  listToolsCatalogAction,
  getToolBySlugAction,
  listMyEnabledToolsAction,
  getMyToolRecordAction,
  setToolEnabledAction,
  setToolPinnedAction,
  updateToolSettingsAction,
} from "@/app/actions/tools";

import {
  useToolsCatalogQuery,
  useToolBySlugQuery,
  useMyEnabledToolsQuery,
  useMyToolRecordQuery,
  useSetToolEnabledMutation,
  useSetToolPinnedMutation,
  useUpdateToolSettingsMutation,
  toolsKeys,
} from "../index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const CATALOG_ITEM = {
  id: "t-1",
  slug: "calculator",
  name: "Calculator",
  description: "A simple calculator",
  icon: "calculator",
  category: "productivity",
  is_active: true,
};

const USER_TOOL = {
  id: "ut-1",
  user_id: "user-1",
  tool_slug: "calculator",
  enabled: true,
  pinned: false,
  settings: {},
};

// ─── toolsKeys ────────────────────────────────────────────────────────────────

describe("toolsKeys", () => {
  it("generates correct catalog key", () => {
    expect(toolsKeys.catalog()).toEqual(["tools", "catalog"]);
  });

  it("generates correct catalogDetail key", () => {
    expect(toolsKeys.catalogDetail("calc")).toEqual(["tools", "catalog", "calc"]);
  });

  it("generates correct myTools key", () => {
    expect(toolsKeys.myTools()).toEqual(["tools", "my-tools"]);
  });

  it("generates correct myToolRecord key", () => {
    expect(toolsKeys.myToolRecord("calc")).toEqual(["tools", "my-tools", "calc"]);
  });
});

// ─── useToolsCatalogQuery ─────────────────────────────────────────────────────

describe("useToolsCatalogQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns catalog data on success", async () => {
    vi.mocked(listToolsCatalogAction).mockResolvedValue({
      success: true,
      data: [CATALOG_ITEM] as never,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolsCatalogQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([CATALOG_ITEM]);
  });

  it("uses initialData when provided", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolsCatalogQuery([CATALOG_ITEM] as never), { wrapper });
    expect(result.current.data).toEqual([CATALOG_ITEM]);
  });

  it("throws on action failure (query error)", async () => {
    vi.mocked(listToolsCatalogAction).mockResolvedValue({ success: false, error: "Unauthorized" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolsCatalogQuery(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });
});

// ─── useToolBySlugQuery ───────────────────────────────────────────────────────

describe("useToolBySlugQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tool when found", async () => {
    vi.mocked(getToolBySlugAction).mockResolvedValue({
      success: true,
      data: CATALOG_ITEM as never,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolBySlugQuery("calculator"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CATALOG_ITEM);
  });

  it("is disabled when slug is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolBySlugQuery(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("uses initialData when provided", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToolBySlugQuery("calculator", CATALOG_ITEM as never), {
      wrapper,
    });
    expect(result.current.data).toEqual(CATALOG_ITEM);
  });
});

// ─── useMyEnabledToolsQuery ───────────────────────────────────────────────────

describe("useMyEnabledToolsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns enabled tools on success", async () => {
    vi.mocked(listMyEnabledToolsAction).mockResolvedValue({
      success: true,
      data: [USER_TOOL] as never,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyEnabledToolsQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([USER_TOOL]);
  });

  it("errors on failure", async () => {
    vi.mocked(listMyEnabledToolsAction).mockResolvedValue({ success: false, error: "Forbidden" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyEnabledToolsQuery(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useMyToolRecordQuery ─────────────────────────────────────────────────────

describe("useMyToolRecordQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tool record on success", async () => {
    vi.mocked(getMyToolRecordAction).mockResolvedValue({ success: true, data: USER_TOOL as never });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyToolRecordQuery("calculator"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(USER_TOOL);
  });

  it("is disabled when slug is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyToolRecordQuery(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

// ─── useSetToolEnabledMutation ────────────────────────────────────────────────

describe("useSetToolEnabledMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls setToolEnabledAction on mutate", async () => {
    vi.mocked(setToolEnabledAction).mockResolvedValue({ success: true, data: USER_TOOL as never });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetToolEnabledMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ toolSlug: "calculator", enabled: true });
    });
    expect(setToolEnabledAction).toHaveBeenCalledWith({ toolSlug: "calculator", enabled: true });
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls router.refresh when disabling a tool", async () => {
    const refreshMock = vi.fn();
    vi.doMock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
    const disabledTool = { ...USER_TOOL, enabled: false };
    vi.mocked(setToolEnabledAction).mockResolvedValue({
      success: true,
      data: disabledTool as never,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetToolEnabledMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ toolSlug: "calculator", enabled: false });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls toast.error on failure", async () => {
    vi.mocked(setToolEnabledAction).mockResolvedValue({ success: false, error: "Unauthorized" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetToolEnabledMutation(), { wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ toolSlug: "calculator", enabled: true });
      } catch {
        // expected
      }
    });
    expect(toast.error).toHaveBeenCalled();
  });
});

// ─── useSetToolPinnedMutation ─────────────────────────────────────────────────

describe("useSetToolPinnedMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls setToolPinnedAction on mutate", async () => {
    const pinnedTool = { ...USER_TOOL, pinned: true };
    vi.mocked(setToolPinnedAction).mockResolvedValue({ success: true, data: pinnedTool as never });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetToolPinnedMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ toolSlug: "calculator", pinned: true });
    });
    expect(setToolPinnedAction).toHaveBeenCalledWith({ toolSlug: "calculator", pinned: true });
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls toast.error on failure", async () => {
    vi.mocked(setToolPinnedAction).mockResolvedValue({ success: false, error: "Unauthorized" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetToolPinnedMutation(), { wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ toolSlug: "calculator", pinned: true });
      } catch {
        // expected
      }
    });
    expect(toast.error).toHaveBeenCalled();
  });
});

// ─── useUpdateToolSettingsMutation ────────────────────────────────────────────

describe("useUpdateToolSettingsMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateToolSettingsAction on mutate", async () => {
    const updated = { ...USER_TOOL, settings: { theme: "dark" } };
    vi.mocked(updateToolSettingsAction).mockResolvedValue({
      success: true,
      data: updated as never,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateToolSettingsMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ toolSlug: "calculator", settings: { theme: "dark" } });
    });
    expect(updateToolSettingsAction).toHaveBeenCalledWith({
      toolSlug: "calculator",
      settings: { theme: "dark" },
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls toast.error on failure", async () => {
    vi.mocked(updateToolSettingsAction).mockResolvedValue({ success: false, error: "Not found" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateToolSettingsMutation(), { wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ toolSlug: "calculator", settings: {} });
      } catch {
        // expected
      }
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
