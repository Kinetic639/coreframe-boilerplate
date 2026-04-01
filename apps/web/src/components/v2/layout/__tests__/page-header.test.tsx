import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeaderV2 } from "../page-header";

describe("PageHeaderV2", () => {
  it("renders title, description, and actions", () => {
    render(
      <PageHeaderV2
        title="Products"
        description="Manage your product catalog"
        actions={<button type="button">Add Product</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Manage your product catalog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Product" })).toBeInTheDocument();
  });

  it("omits optional sections when description and actions are not provided", () => {
    render(<PageHeaderV2 title="Settings" />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies custom class names", () => {
    const { container } = render(<PageHeaderV2 title="Teams" className="custom-spacing" />);

    expect(container.firstChild).toHaveClass("mb-6", "custom-spacing");
  });
});
