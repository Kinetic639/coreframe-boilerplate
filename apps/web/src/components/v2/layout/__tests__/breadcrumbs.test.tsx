import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "../breadcrumbs";

const usePathnameMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({
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

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("Breadcrumbs", () => {
  it("auto-generates breadcrumb items from the pathname", () => {
    usePathnameMock.mockReturnValue("/en/dashboard/warehouse/items");

    render(<Breadcrumbs />);

    expect(screen.getByRole("link", { name: "" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Warehouse" })).toHaveAttribute(
      "href",
      "/dashboard/warehouse"
    );
    expect(screen.getByText("Items")).toBeInTheDocument();
  });

  it("uses explicit items when provided", () => {
    usePathnameMock.mockReturnValue("/en/ignored");

    render(
      <Breadcrumbs
        items={[{ label: "Organization", href: "/dashboard/organization" }, { label: "Members" }]}
      />
    );

    expect(screen.getByRole("link", { name: "Organization" })).toHaveAttribute(
      "href",
      "/dashboard/organization"
    );
    expect(screen.getByText("Members")).toBeInTheDocument();
  });

  it("can hide the home link", () => {
    usePathnameMock.mockReturnValue("/en/dashboard/tools");

    render(<Breadcrumbs showHome={false} />);

    expect(screen.queryByRole("link", { name: "" })).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
