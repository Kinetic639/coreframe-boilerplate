import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockToggleEnabled, mockTogglePinned, mockGetToolComponent } = vi.hoisted(() => ({
  mockToggleEnabled: vi.fn(),
  mockTogglePinned: vi.fn(),
  mockGetToolComponent: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

vi.mock("@/components/v2/utility/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, onClick, disabled, ...props }: any) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

vi.mock("@/hooks/queries/tools", () => ({
  useMyToolRecordQuery: (_slug: string, initial: unknown) => ({ data: initial }),
  useSetToolEnabledMutation: () => ({ mutate: mockToggleEnabled, isPending: false }),
  useSetToolPinnedMutation: () => ({ mutate: mockTogglePinned, isPending: false }),
}));

vi.mock("@/lib/tools/registry", () => ({
  getToolComponent: (...args: unknown[]) => mockGetToolComponent(...args),
}));

import { ToolDetailClient } from "../tool-detail-client";

const tool = {
  slug: "weather",
  name: "Weather",
  description: "Forecasts",
  category: "ops",
} as never;

describe("ToolDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the disabled preview state", () => {
    render(<ToolDetailClient tool={tool} initialRecord={null} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aria.enableTool:Weather/i })).toBeInTheDocument();
  });

  it("enables a disabled tool", () => {
    render(<ToolDetailClient tool={tool} initialRecord={null} />);

    fireEvent.click(screen.getByRole("button", { name: /aria.enableTool:Weather/i }));

    expect(mockToggleEnabled).toHaveBeenCalledWith({ toolSlug: "weather", enabled: true });
  });

  it("renders the registered tool UI when enabled", () => {
    mockGetToolComponent.mockReturnValue(() => <div>tool ui</div>);

    render(
      <ToolDetailClient
        tool={tool}
        initialRecord={{ enabled: true, pinned: true, tool_slug: "weather" } as never}
      />
    );

    expect(screen.getByText("tool ui")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /aria.unpinTool:Weather/i }));
    expect(mockTogglePinned).toHaveBeenCalledWith({ toolSlug: "weather", pinned: false });
  });
});
