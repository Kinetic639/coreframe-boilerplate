import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockHas = vi.fn();
const mockTranslate = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((key: string, params?: unknown) => mockTranslate(key, params)) as ((
      key: string,
      params?: unknown
    ) => string) & { has: typeof mockHas };
    t.has = mockHas;
    return t;
  },
}));

import { useActivitySummary } from "../useActivitySummary";

function HookProbe({ event }: { event: Record<string, unknown> }) {
  return <div>{useActivitySummary(event as never)}</div>;
}

describe("useActivitySummary", () => {
  it("uses the translated summary when the key exists", () => {
    mockHas.mockReturnValue(true);
    mockTranslate.mockReturnValue("Translated summary");

    render(
      <HookProbe
        event={{
          summaryKey: "events.auth.login",
          summaryPerspective: "self",
          summaryParams: { actorName: "Alice" },
          summary: "Fallback summary",
        }}
      />
    );

    expect(mockTranslate).toHaveBeenCalledWith("events.auth.login.self", { actorName: "Alice" });
    expect(screen.getByText("Translated summary")).toBeInTheDocument();
  });

  it("falls back to the legacy summary when the key is missing", () => {
    mockHas.mockReturnValue(false);

    render(
      <HookProbe
        event={{
          summaryKey: "events.auth.login",
          summaryPerspective: "self",
          summaryParams: {},
          summary: "Legacy summary",
        }}
      />
    );

    expect(screen.getByText("Legacy summary")).toBeInTheDocument();
  });

  it("falls back to the legacy summary when translation throws", () => {
    mockHas.mockReturnValue(true);
    mockTranslate.mockImplementation(() => {
      throw new Error("boom");
    });

    render(
      <HookProbe
        event={{
          summaryKey: "events.auth.login",
          summaryPerspective: "self",
          summaryParams: {},
          summary: "Safe fallback",
        }}
      />
    );

    expect(screen.getByText("Safe fallback")).toBeInTheDocument();
  });
});
