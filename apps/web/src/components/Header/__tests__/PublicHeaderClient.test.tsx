import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { PublicHeaderClient } from "../PublicHeaderClient";

describe("PublicHeaderClient", () => {
  it("renders the logo, desktop navigation, and pricing link", async () => {
    render(<PublicHeaderClient />);

    expect(screen.getByRole("link", { name: /ambra system/i })).toHaveAttribute(
      "href",
      "https://www.ambra-system.com"
    );
    expect(await screen.findByRole("button", { name: /funkcje/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rozwiązania/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /materiały edukacyjne/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu open and closed", () => {
    render(<PublicHeaderClient />);

    const toggleButton = screen.getByRole("button", { name: /otwórz menu/i });
    expect(screen.queryByText("Wszystkie funkcje")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByRole("button", { name: /zamknij menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /zamknij menu/i }));
    expect(screen.getByRole("button", { name: /otwórz menu/i })).toBeInTheDocument();
  });
});
