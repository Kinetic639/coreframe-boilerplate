import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
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

vi.mock("@/components/forms/FeaturesContactForm", () => ({
  default: () => <div data-testid="features-contact-form" />,
}));

import FeaturesClient from "../features-client";

describe("FeaturesClient", () => {
  it("renders the main feature sections and cta", () => {
    render(<FeaturesClient />);

    expect(
      screen.getByRole("heading", {
        name: /funkcje, które usprawniają twój magazyn/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /główne funkcje/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /i wiele więcej/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /wypróbuj za darmo/i })).toHaveAttribute("href", "/");
    expect(screen.getByTestId("features-contact-form")).toBeInTheDocument();
  });

  it("lists representative primary and secondary feature cards", () => {
    render(<FeaturesClient />);

    expect(screen.getByText("Aplikacja mobilna")).toBeInTheDocument();
    expect(screen.getByText("Kody QR i skanowanie")).toBeInTheDocument();
    expect(screen.getByText("System kodów kreskowych")).toBeInTheDocument();
    expect(screen.getByText("Bezpieczeństwo")).toBeInTheDocument();
    expect(screen.getByText("Współpraca")).toBeInTheDocument();
    expect(screen.getByText("Pełna funkcjonalność offline")).toBeInTheDocument();
    expect(
      screen.getByText("Enterprise-grade security z szyfrowaniem end-to-end")
    ).toBeInTheDocument();
  });
});
