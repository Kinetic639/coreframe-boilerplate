import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockGetTranslations = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
}));

vi.mock("../_components/warehouse-placeholder-page", () => ({
  WarehousePlaceholderPage: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

import WarehousePage from "../page";

describe("WarehousePage", () => {
  it("renders translated placeholder content", async () => {
    mockGetTranslations.mockResolvedValue((key: string) =>
      key === "title" ? "Warehouse" : "Module shell"
    );

    const page = await WarehousePage();
    render(page);

    expect(screen.getByRole("heading", { name: "Warehouse" })).toBeInTheDocument();
    expect(screen.getByText("Module shell")).toBeInTheDocument();
  });
});
