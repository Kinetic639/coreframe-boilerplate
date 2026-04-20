import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "items.myTools": "My Tools",
      "items.allTools": "All Tools",
    })[key] ?? key,
}));

vi.mock("../tools-my-tools-client", () => ({
  ToolsMyToolsClient: ({ initialMyTools }: { initialMyTools: unknown[] }) => (
    <div data-testid="my-tools">{initialMyTools.length}</div>
  ),
}));

vi.mock("../tools-catalog-client", () => ({
  ToolsCatalogClient: ({ initialCatalog }: { initialCatalog: unknown[] }) => (
    <div data-testid="all-tools">{initialCatalog.length}</div>
  ),
}));

import { ToolsUnifiedClient } from "../tools-unified-client";

describe("ToolsUnifiedClient", () => {
  it("renders my tools by default and switches to all tools tab", async () => {
    const user = userEvent.setup();
    render(<ToolsUnifiedClient initialMyTools={[{ id: "a" } as never]} initialCatalog={[]} />);

    expect(screen.getByRole("tab", { name: /my tools/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("my-tools")).toHaveTextContent("1");

    await user.click(screen.getByRole("tab", { name: /all tools/i }));

    expect(screen.getByRole("tab", { name: /all tools/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("all-tools")).toHaveTextContent("0");
  });
});
