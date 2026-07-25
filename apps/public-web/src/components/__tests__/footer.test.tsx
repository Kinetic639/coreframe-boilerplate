import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

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
    expect(screen.getByText(/Nowoczesne narzędzie/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /polityka prywatności/i })).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
  });
});
