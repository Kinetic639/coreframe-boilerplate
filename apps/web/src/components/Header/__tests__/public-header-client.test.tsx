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

// `next-intl` is mocked globally (vitest.setup.ts) to return the translation
// key itself rather than real copy, so assertions here target keys under the
// "PublicHeader" namespace (see messages/{en,pl}.json), not literal text.
describe("PublicHeaderClient", () => {
  it("renders desktop navigation after mounting", () => {
    render(<PublicHeaderClient />);

    expect(screen.getByText("Ambra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dropdowns\.features\.label/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dropdowns\.solutions\.label/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dropdowns\.educational\.label/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pricing/i })).toHaveAttribute("href", "/pricing");
  });

  it("toggles the mobile menu", () => {
    render(<PublicHeaderClient />);

    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    expect(screen.getByText(/allPrefix/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "closeMenu" }));
    expect(screen.queryByText(/allPrefix/)).not.toBeInTheDocument();
  });
});
