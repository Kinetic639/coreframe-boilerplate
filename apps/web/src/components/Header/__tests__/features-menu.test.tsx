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

import FeaturesMenu from "../FeaturesMenu";

describe("FeaturesMenu", () => {
  it("renders the trigger and feature cards", () => {
    const setActiveDropdown = vi.fn();

    render(<FeaturesMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: /funkcje/i }));

    expect(setActiveDropdown).toHaveBeenCalledWith("features");
    expect(screen.getByText("Aplikacja mobilna")).toBeInTheDocument();
    expect(screen.getByText("Kodowanie QR")).toBeInTheDocument();
    expect(screen.getByText("Alerty")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).not.toHaveLength(0);
  });

  it("closes the panel when the heading is clicked", () => {
    const setActiveDropdown = vi.fn();

    render(<FeaturesMenu activeDropdown="features" setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getAllByText("Funkcje")[1]);

    expect(setActiveDropdown).toHaveBeenCalledWith(null);
  });
});
