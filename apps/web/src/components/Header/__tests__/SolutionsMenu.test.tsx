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

import SolutionsMenu from "../SolutionsMenu";

describe("SolutionsMenu", () => {
  it("renders grouped solution items and opens the dropdown", () => {
    const setActiveDropdown = vi.fn();

    render(<SolutionsMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    expect(screen.getByText("Zastosowania")).toBeInTheDocument();
    expect(screen.getByText("Branże")).toBeInTheDocument();
    expect(screen.getByText("Zarządzanie magazynem")).toBeInTheDocument();
    expect(screen.getByText("Serwis i naprawy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rozwiązania" }));
    expect(setActiveDropdown).toHaveBeenCalledWith("solutions");
  });

  it("closes the dropdown when it is already active or the heading is clicked", () => {
    const setActiveDropdown = vi.fn();

    render(<SolutionsMenu activeDropdown="solutions" setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: "Rozwiązania" }));
    fireEvent.click(screen.getAllByText("Rozwiązania")[1]);

    expect(setActiveDropdown).toHaveBeenNthCalledWith(1, null);
    expect(setActiveDropdown).toHaveBeenNthCalledWith(2, null);
  });
});
