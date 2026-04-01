import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) =>
    asChild ? (
      <div data-variant={variant} className={className}>
        {children}
      </div>
    ) : (
      <button onClick={onClick} className={className} data-variant={variant}>
        {children}
      </button>
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

import MobileMenu from "../MobileMenu";

describe("MobileMenu", () => {
  it("renders dropdown sections and auth links", () => {
    render(<MobileMenu />);

    expect(screen.getByText("Funkcje")).toBeInTheDocument();
    expect(screen.getByText("Rozwiązania")).toBeInTheDocument();
    expect(screen.getByText("Materiały edukacyjne")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /zaloguj się/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: /rozpocznij za darmo/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });

  it("shows grouped mobile menu items", () => {
    render(<MobileMenu />);

    expect(screen.getByText("Aplikacja mobilna")).toBeInTheDocument();
    expect(screen.getByText("Zarządzanie magazynem")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getAllByText(/^Wszystkie /)).toHaveLength(3);
  });
});
