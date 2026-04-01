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

import EducationalMenu from "../EducationalMenu";

describe("EducationalMenu", () => {
  it("renders educational resources", () => {
    const setActiveDropdown = vi.fn();

    render(<EducationalMenu activeDropdown={null} setActiveDropdown={setActiveDropdown} />);

    fireEvent.click(screen.getByRole("button", { name: /materiały edukacyjne/i }));

    expect(setActiveDropdown).toHaveBeenCalledWith("educational");
    expect(screen.getByText("Materiały")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("Baza wiedzy")).toBeInTheDocument();
    expect(screen.getByText("Roadmapa")).toBeInTheDocument();
  });
});
