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

// `next-intl` is mocked globally (vitest.setup.ts) to return the translation
// key itself rather than real copy, so assertions here target keys under the
// "PublicFooter" namespace (see messages/{en,pl}.json), not literal text.
describe("footer", () => {
  it("renders branding, navigation links, and utility controls", () => {
    render(<Footer />);

    expect(screen.getByText("Ambra")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "legal.privacyPolicy" })).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
  });
});
