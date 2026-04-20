import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
const mockUseParams = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/dashboard/start",
  useRouter: () => ({ replace: mockReplace }),
}));

import LocaleSwitcherSelect from "../LocaleSwitcherSelect";

describe("LocaleSwitcherSelect", () => {
  it("renders the label and current locale", () => {
    mockUseParams.mockReturnValue({ locale: "en" });

    render(
      <LocaleSwitcherSelect defaultValue="en" label="Switch locale">
        <option value="en">English</option>
        <option value="pl">Polski</option>
      </LocaleSwitcherSelect>
    );

    expect(screen.getByText("Switch locale")).toHaveClass("sr-only");
    expect(screen.getByRole("combobox")).toHaveValue("en");
  });

  it("replaces the route with the selected locale", () => {
    mockUseParams.mockReturnValue({ locale: "en", slug: "home" });

    render(
      <LocaleSwitcherSelect defaultValue="en" label="Switch locale">
        <option value="en">English</option>
        <option value="pl">Polski</option>
      </LocaleSwitcherSelect>
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pl" } });

    expect(mockReplace).toHaveBeenCalledWith(
      { pathname: "/dashboard/start", params: { locale: "en", slug: "home" } },
      { locale: "pl" }
    );
  });
});
