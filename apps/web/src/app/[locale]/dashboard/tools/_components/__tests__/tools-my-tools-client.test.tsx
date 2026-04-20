import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToggleEnabled = vi.fn();
const mockTogglePinned = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

vi.mock("@/components/v2/utility/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, onClick, ...props }: any) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

vi.mock("@/hooks/queries/tools", () => ({
  useMyEnabledToolsQuery: (initial: unknown) => ({ data: initial }),
  useToolsCatalogQuery: (initial: unknown) => ({ data: initial }),
  useSetToolEnabledMutation: () => ({ mutate: mockToggleEnabled, isPending: false }),
  useSetToolPinnedMutation: () => ({ mutate: mockTogglePinned, isPending: false }),
}));

import { ToolsMyToolsClient } from "../tools-my-tools-client";

const myTools = [
  { id: "1", tool_slug: "weather", enabled: true, pinned: true },
  { id: "2", tool_slug: "notes", enabled: true, pinned: false },
] as never;

const catalog = [
  { slug: "weather", name: "Weather", description: "Forecast" },
  { slug: "notes", name: "Notes", description: "Quick notes" },
] as never;

describe("ToolsMyToolsClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the empty state", () => {
    render(<ToolsMyToolsClient initialMyTools={[]} initialCatalog={[]} />);

    expect(screen.getByText("pages.myTools.empty")).toBeInTheDocument();
  });

  it("renders enabled tools and supports disable/pin actions", () => {
    render(<ToolsMyToolsClient initialMyTools={myTools} initialCatalog={catalog} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /aria.disableTool:Weather/i }));
    fireEvent.click(screen.getByRole("button", { name: /aria.unpinTool:Weather/i }));

    expect(mockToggleEnabled).toHaveBeenCalledWith({ toolSlug: "weather", enabled: false });
    expect(mockTogglePinned).toHaveBeenCalledWith({ toolSlug: "weather", pinned: false });
  });
});
