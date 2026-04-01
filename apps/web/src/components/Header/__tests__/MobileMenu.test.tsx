import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import MobileMenu from "../MobileMenu";

describe("MobileMenu", () => {
  it("renders grouped navigation and auth actions", () => {
    render(<MobileMenu />);

    expect(screen.getByText("Funkcje")).toBeInTheDocument();
    expect(screen.getByText("Rozwiązania")).toBeInTheDocument();
    expect(screen.getByText("Materiały edukacyjne")).toBeInTheDocument();
    expect(screen.getByText("Aplikacja mobilna")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /zaloguj się/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rozpocznij za darmo/i })).toBeInTheDocument();
  });
});
