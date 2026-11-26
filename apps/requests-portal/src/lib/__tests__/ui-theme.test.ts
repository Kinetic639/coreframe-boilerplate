import { describe, expect, it } from "vitest";
import { DEFAULT_UI_THEME, parseUiTheme } from "../ui-theme";

describe("parseUiTheme", () => {
  it("reads the mode and color theme Ambra saved", () => {
    expect(
      parseUiTheme({ ui: { theme: "dark", colorTheme: "catppuccin", sidebarCollapsed: true } })
    ).toEqual({
      mode: "dark",
      colorTheme: "catppuccin",
    });
  });

  it("falls back to the defaults for missing or unknown values", () => {
    expect(parseUiTheme(null)).toEqual(DEFAULT_UI_THEME);
    expect(parseUiTheme({})).toEqual(DEFAULT_UI_THEME);
    expect(parseUiTheme({ ui: { theme: "sepia", colorTheme: "nope" } })).toEqual(DEFAULT_UI_THEME);
  });
});
