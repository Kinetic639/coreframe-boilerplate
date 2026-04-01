import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () => (key: string, values?: { locale: string }) =>
    key === "label" ? "Switch locale" : `Locale:${values?.locale}`,
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "pl"],
  },
}));

vi.mock("../LocaleSwitcherSelect", () => ({
  default: ({
    defaultValue,
    label,
    children,
  }: {
    defaultValue: string;
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <div>{`${label}:${defaultValue}`}</div>
      <select>{children}</select>
    </div>
  ),
}));

import LocaleSwitcher from "../LocaleSwitcher";

describe("LocaleSwitcher", () => {
  it("renders the current locale and available locale options", () => {
    render(<LocaleSwitcher />);

    expect(screen.getByText("Switch locale:pl")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Locale:en" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Locale:pl" })).toBeInTheDocument();
  });
});
