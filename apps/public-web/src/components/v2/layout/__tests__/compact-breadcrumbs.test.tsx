import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompactBreadcrumbs } from "../compact-breadcrumbs";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("CompactBreadcrumbs", () => {
  it("renders the home link even without custom breadcrumbs", () => {
    render(<CompactBreadcrumbs />);

    expect(screen.getByRole("link", { name: "" })).toHaveAttribute("href", "/dashboard/start");
  });

  it("renders linked and terminal breadcrumbs correctly", () => {
    render(
      <CompactBreadcrumbs
        breadcrumbs={[{ label: "Warehouse", href: "/dashboard/warehouse" }, { label: "Products" }]}
      />
    );

    expect(screen.getByRole("link", { name: "Warehouse" })).toHaveAttribute(
      "href",
      "/dashboard/warehouse"
    );
    expect(screen.getByText("Products")).toBeInTheDocument();
  });
});
