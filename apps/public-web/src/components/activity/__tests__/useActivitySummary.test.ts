import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const hasMock = vi.fn();
const translateMock = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((key: string, params?: unknown) => translateMock(key, params)) as ((
      key: string,
      params?: unknown
    ) => string) & { has: typeof hasMock };
    t.has = hasMock;
    return t;
  },
}));

import { useActivitySummary } from "../useActivitySummary";

describe("useActivitySummary", () => {
  it("returns translated summary when the key exists", () => {
    hasMock.mockReturnValue(true);
    translateMock.mockReturnValue("Translated summary");

    const { result } = renderHook(() =>
      useActivitySummary({
        summaryKey: "events.auth.login",
        summaryPerspective: "self",
        summaryParams: { actorName: "Alice" },
        summary: "Fallback summary",
      } as never)
    );

    expect(result.current).toBe("Translated summary");
  });

  it("falls back to legacy summary when translation is missing", () => {
    hasMock.mockReturnValue(false);

    const { result } = renderHook(() =>
      useActivitySummary({
        summaryKey: "events.auth.login",
        summaryPerspective: "self",
        summaryParams: {},
        summary: "Fallback summary",
      } as never)
    );

    expect(result.current).toBe("Fallback summary");
  });
});
