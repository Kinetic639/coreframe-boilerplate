import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../theme-switcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock("../LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher" />,
}));

import Footer from "../footer";

describe("footer", () => {
  it("renders branding, navigation links, and utility controls", () => {
    render(<Footer />);

    expect(screen.getByText("Ambra")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "legal.privacyPolicy" })).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
  });

  it("links the ERP sign-in to the one shared sign-in page", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Footer />);

    expect(screen.getByRole("link", { name: "columns.product.ambraErp" })).toHaveAttribute(
      "href",
      "https://app.ambra-system.com/logowanie"
    );
    expect(screen.getByRole("link", { name: "columns.product.ambraErpSignUp" })).toHaveAttribute(
      "href",
      "https://app.ambra-system.com/rejestracja"
    );
    vi.unstubAllEnvs();
  });
});
