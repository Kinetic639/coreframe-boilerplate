import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Package } from "lucide-react";

import { WarehousePlaceholderPage } from "../warehouse-placeholder-page";

describe("WarehousePlaceholderPage", () => {
  it("renders the title, description, and icon", () => {
    const { container } = render(
      <WarehousePlaceholderPage
        title="Inventory"
        description="Inventory tools are coming soon."
        Icon={Package}
      />
    );

    expect(screen.getByRole("heading", { name: "Inventory" })).toBeInTheDocument();
    expect(screen.getAllByText("Inventory tools are coming soon.")).toHaveLength(2);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
