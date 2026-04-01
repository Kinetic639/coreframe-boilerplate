import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHas, mockTranslate } = vi.hoisted(() => ({
  mockHas: vi.fn(),
  mockTranslate: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((key: string, params?: Record<string, unknown>) => mockTranslate(key, params)) as ((
      key: string,
      params?: Record<string, unknown>
    ) => string) & {
      has: typeof mockHas;
    };
    t.has = mockHas;
    return t;
  },
}));

import { useActivitySummary } from "../useActivitySummary";

const event = {
  summaryKey: "events.auth.login",
  summaryPerspective: "self",
  summaryParams: { actorName: "Michał" },
  summary: "Legacy summary",
} as never;

describe("useActivitySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses translated summary when the key exists", () => {
    mockHas.mockReturnValue(true);
    mockTranslate.mockReturnValue("Translated summary");

    const { result } = renderHook(() => useActivitySummary(event));

    expect(result.current).toBe("Translated summary");
    expect(mockTranslate).toHaveBeenCalledWith("events.auth.login.self", { actorName: "Michał" });
  });

  it("falls back to legacy summary when translation key does not exist", () => {
    mockHas.mockReturnValue(false);

    const { result } = renderHook(() => useActivitySummary(event));

    expect(result.current).toBe("Legacy summary");
  });

  it("falls back to legacy summary when translation throws", () => {
    mockHas.mockReturnValue(true);
    mockTranslate.mockImplementation(() => {
      throw new Error("bad message");
    });

    const { result } = renderHook(() => useActivitySummary(event));

    expect(result.current).toBe("Legacy summary");
  });
});
