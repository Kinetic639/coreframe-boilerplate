import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "dashboard" }),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/dashboard/start",
  useRouter: () => ({ replace: replaceMock }),
}));

import LocaleSwitcherSelect from "../LocaleSwitcherSelect";

describe("LocaleSwitcherSelect", () => {
  it("renders label and current value", () => {
    render(
      <LocaleSwitcherSelect defaultValue="en" label="Language">
        <option value="en">English</option>
        <option value="pl">Polski</option>
      </LocaleSwitcherSelect>
    );

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("en");
  });

  it("replaces the route with the selected locale", () => {
    render(
      <LocaleSwitcherSelect defaultValue="en" label="Language">
        <option value="en">English</option>
        <option value="pl">Polski</option>
      </LocaleSwitcherSelect>
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pl" } });

    expect(replaceMock).toHaveBeenCalledWith(
      { pathname: "/dashboard/start", params: { slug: "dashboard" } },
      { locale: "pl" }
    );
  });
});
