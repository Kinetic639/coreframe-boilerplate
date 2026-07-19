import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    expect(screen.getByRole("button", { name: /funkcje/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rozwiązania/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /materiały edukacyjne/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cennik/i })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu", () => {
    render(<PublicHeaderClient />);

    fireEvent.click(screen.getByRole("button", { name: /otwórz menu/i }));
    expect(screen.getByText("Wszystkie funkcje")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /zamknij menu/i }));
    expect(screen.queryByText("Wszystkie funkcje")).not.toBeInTheDocument();
  });
});
