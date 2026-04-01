import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: { locale?: string }) =>
    key === "label" ? "Choose locale" : `Locale ${values?.locale}`,
}));

vi.mock("./../LocaleSwitcherSelect", () => ({
  default: ({
    children,
    defaultValue,
    label,
  }: {
    children: React.ReactNode;
    defaultValue: string;
    label: string;
  }) => (
    <div data-testid="locale-switcher-select" data-default-value={defaultValue} data-label={label}>
      {children}
    </div>
  ),
}));

import LocaleSwitcher from "../LocaleSwitcher";

describe("LocaleSwitcher", () => {
  it("renders translated locale options into the select wrapper", () => {
    render(<LocaleSwitcher />);

    expect(screen.getByTestId("locale-switcher-select")).toHaveAttribute(
      "data-default-value",
      "en"
    );
    expect(screen.getByTestId("locale-switcher-select")).toHaveAttribute(
      "data-label",
      "Choose locale"
    );
    expect(screen.getByRole("option", { name: "Locale en" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Locale pl" })).toBeInTheDocument();
  });
});
