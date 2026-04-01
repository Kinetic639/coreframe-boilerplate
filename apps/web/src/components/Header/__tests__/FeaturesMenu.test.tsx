import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/navigation-menu", () => ({
  NavigationMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavigationMenuTrigger: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  NavigationMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavigationMenuLink: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import FeaturesMenu from "../FeaturesMenu";

describe("FeaturesMenu", () => {
  it("renders feature cards and opens the features dropdown", () => {
    const setActiveDropdown = vi.fn();

    render(<FeaturesMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    expect(screen.getByText("Aplikacja mobilna")).toBeInTheDocument();
    expect(screen.getByText("Raportowanie")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Funkcje" }));
    expect(setActiveDropdown).toHaveBeenCalledWith("features");
  });

  it("closes the dropdown when it is already active or the heading is clicked", () => {
    const setActiveDropdown = vi.fn();

    render(<FeaturesMenu activeDropdown="features" setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: "Funkcje" }));
    fireEvent.click(screen.getAllByText("Funkcje")[1]);

    expect(setActiveDropdown).toHaveBeenNthCalledWith(1, null);
    expect(setActiveDropdown).toHaveBeenNthCalledWith(2, null);
  });
});
