import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PublicThemeEnforcer } from "../public-theme-enforcer";

describe("PublicThemeEnforcer", () => {
  it("removes the current theme on mount and restores it on unmount", () => {
    document.documentElement.setAttribute("data-theme", "ocean");

    const { unmount } = render(<PublicThemeEnforcer />);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean");
  });
});
