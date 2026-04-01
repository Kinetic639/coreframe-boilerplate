import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicThemeEnforcer } from "../public-theme-enforcer";

describe("PublicThemeEnforcer", () => {
  it("removes the current theme on mount and restores it on unmount", () => {
    document.documentElement.setAttribute("data-theme", "ocean");

    const { unmount } = render(<PublicThemeEnforcer />);

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    unmount();

    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean");
  });

  it("leaves the theme unset when there was no previous value", () => {
    document.documentElement.removeAttribute("data-theme");

    const { unmount } = render(<PublicThemeEnforcer />);

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    unmount();

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
