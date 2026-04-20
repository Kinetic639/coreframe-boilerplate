import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/navigation-menu", () => ({
  NavigationMenu: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavigationMenuList: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
}));

vi.mock("../FeaturesMenu", () => ({
  default: () => <li>features-menu</li>,
}));

vi.mock("../SolutionsMenu", () => ({
  default: () => <li>solutions-menu</li>,
}));

vi.mock("../EducationalMenu", () => ({
  default: () => <li>educational-menu</li>,
}));

vi.mock("../MobileMenu", () => ({
  default: () => <div>mobile-menu</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { PublicHeaderClient } from "../PublicHeaderClient";

describe("PublicHeaderClient", () => {
  it("renders desktop navigation after mounting", () => {
    render(<PublicHeaderClient />);

    expect(screen.getByText("Ambra")).toBeInTheDocument();
    expect(screen.getByText("features-menu")).toBeInTheDocument();
    expect(screen.getByText("solutions-menu")).toBeInTheDocument();
    expect(screen.getByText("educational-menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cennik/i })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu", () => {
    render(<PublicHeaderClient />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("mobile-menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("mobile-menu")).not.toBeInTheDocument();
  });
});
