import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/constants/color-themes", () => ({
  COLOR_THEME_STORAGE_KEY: "color-theme",
}));

import { DashboardColorThemeLoader } from "../dashboard-color-theme-loader";

describe("DashboardColorThemeLoader", () => {
  it("removes the theme attribute when the stored theme is default", () => {
    localStorage.setItem("color-theme", "default");
    document.documentElement.setAttribute("data-theme", "ocean");

    render(<DashboardColorThemeLoader />);

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("applies a custom theme from storage", () => {
    localStorage.setItem("color-theme", "forest");

    render(<DashboardColorThemeLoader />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
  });

  it("swallows storage errors", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => render(<DashboardColorThemeLoader />)).not.toThrow();

    getItem.mockRestore();
  });
});
