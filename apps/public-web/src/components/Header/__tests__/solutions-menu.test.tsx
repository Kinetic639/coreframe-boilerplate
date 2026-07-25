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

import SolutionsMenu from "../SolutionsMenu";

describe("SolutionsMenu", () => {
  it("renders grouped solution items", () => {
    const setActiveDropdown = vi.fn();

    render(<SolutionsMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: /rozwiązania/i }));

    expect(setActiveDropdown).toHaveBeenCalledWith("solutions");
    expect(screen.getByText("Zastosowania")).toBeInTheDocument();
    expect(screen.getByText("Branże")).toBeInTheDocument();
    expect(screen.getByText("Zarządzanie magazynem")).toBeInTheDocument();
    expect(screen.getByText("Placówki medyczne")).toBeInTheDocument();
  });

  it("clears the active dropdown when the title is clicked", () => {
    const setActiveDropdown = vi.fn();

    render(<SolutionsMenu activeDropdown="solutions" setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getAllByText("Rozwiązania")[1]);

    expect(setActiveDropdown).toHaveBeenCalledWith(null);
  });
});
