import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToggleEnabled = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values?.name
      ? `${key}:${values.name}`
      : String(values ? `${key}:${JSON.stringify(values)}` : key),
}));

vi.mock("@/components/v2/utility/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/v2/forms/search-form", () => ({
  SearchForm: ({ onSearch }: { onSearch: (q: string) => void }) => (
    <input aria-label="search" onChange={(e) => onSearch((e.target as HTMLInputElement).value)} />
  ),
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
  useToolsCatalogQuery: (initial: unknown) => ({ data: initial }),
  useMyEnabledToolsQuery: (initial: unknown) => ({ data: initial }),
  useSetToolEnabledMutation: () => ({ mutate: mockToggleEnabled, isPending: false }),
}));

import { ToolsCatalogClient } from "../tools-catalog-client";

const catalog = [
  { slug: "weather", name: "Weather", description: "Forecast", category: "ops" },
  { slug: "notes", name: "Notes", description: "Quick notes", category: "productivity" },
] as never;

describe("ToolsCatalogClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders tool cards and category filters", () => {
    render(<ToolsCatalogClient initialCatalog={catalog} initialMyTools={[]} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pages.catalog.filterAll/i })).toBeInTheDocument();
  });

  it("filters by search and toggles a tool", () => {
    render(<ToolsCatalogClient initialCatalog={catalog} initialMyTools={[]} />);

    fireEvent.change(screen.getByLabelText("search"), { target: { value: "weather" } });
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /aria.enableTool:Weather/i }));
    expect(mockToggleEnabled).toHaveBeenCalledWith({ toolSlug: "weather", enabled: true });
  });
});
