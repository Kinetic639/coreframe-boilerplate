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

import EducationalMenu from "../EducationalMenu";

describe("EducationalMenu", () => {
  it("renders educational resources and opens the dropdown", () => {
    const setActiveDropdown = vi.fn();

    render(<EducationalMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    expect(screen.getByText("Materiały")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("Roadmapa")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Materiały edukacyjne" }));
    expect(setActiveDropdown).toHaveBeenCalledWith("educational");
  });

  it("closes the dropdown when active and when the heading is clicked", () => {
    const setActiveDropdown = vi.fn();

    render(<EducationalMenu activeDropdown="educational" setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: "Materiały edukacyjne" }));
    fireEvent.click(screen.getAllByText("Materiały edukacyjne")[1]);

    expect(setActiveDropdown).toHaveBeenNthCalledWith(1, null);
    expect(setActiveDropdown).toHaveBeenNthCalledWith(2, null);
  });
});
