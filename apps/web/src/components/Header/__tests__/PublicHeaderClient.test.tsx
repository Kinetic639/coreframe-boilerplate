import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/navigation-menu", () => ({
  NavigationMenu: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavigationMenuList: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

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

vi.mock("../FeaturesMenu", () => ({
  default: () => <li>Features menu</li>,
}));

vi.mock("../SolutionsMenu", () => ({
  default: () => <li>Solutions menu</li>,
}));

vi.mock("../EducationalMenu", () => ({
  default: () => <li>Educational menu</li>,
}));

vi.mock("../MobileMenu", () => ({
  default: () => <div>Mobile menu body</div>,
}));

import { PublicHeaderClient } from "../PublicHeaderClient";

describe("PublicHeaderClient", () => {
  it("renders the logo, desktop navigation, and pricing link", async () => {
    render(<PublicHeaderClient />);

    expect(screen.getByRole("link", { name: /ambra system/i })).toHaveAttribute("href", "/");
    expect(await screen.findByText("Features menu")).toBeInTheDocument();
    expect(screen.getByText("Solutions menu")).toBeInTheDocument();
    expect(screen.getByText("Educational menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu open and closed", () => {
    render(<PublicHeaderClient />);

    const toggleButton = screen.getByRole("button");
    expect(screen.queryByText("Mobile menu body")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText("Mobile menu body")).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByText("Mobile menu body")).not.toBeInTheDocument();
  });
});
