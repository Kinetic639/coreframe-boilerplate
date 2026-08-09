import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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

// `next-intl` is mocked globally (vitest.setup.ts) to return the translation
// key itself rather than real copy, so assertions here target keys under the
// "PublicHeader" namespace (see messages/{en,pl}.json), not literal text.
describe("PublicHeaderClient", () => {
  it("renders the logo, desktop navigation, and pricing link", async () => {
    render(<PublicHeaderClient />);

    expect(screen.getByRole("link", { name: /ambra system/i })).toHaveAttribute("href", "/");
    expect(
      await screen.findByRole("button", { name: /dropdowns\.features\.label/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dropdowns\.solutions\.label/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dropdowns\.educational\.label/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu open and closed", () => {
    render(<PublicHeaderClient />);

    const toggleButton = screen.getByRole("button", { name: "openMenu" });
    expect(screen.queryByText(/allPrefix/)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByRole("button", { name: "closeMenu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "closeMenu" }));
    expect(screen.getByRole("button", { name: "openMenu" })).toBeInTheDocument();
  });
});
