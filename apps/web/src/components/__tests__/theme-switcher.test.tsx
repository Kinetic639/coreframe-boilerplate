import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const setThemeMock = vi.fn();
const setStoreThemeMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: setThemeMock }),
}));

vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (selector: (state: { setTheme: typeof setStoreThemeMock }) => unknown) =>
    selector({ setTheme: setStoreThemeMock }),
}));

import { ThemeSwitcher } from "../theme-switcher";

describe("ThemeSwitcher", () => {
  it("renders after mount and toggles both theme stores", async () => {
    render(<ThemeSwitcher />);

    const button = await screen.findByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith("light");
    expect(setStoreThemeMock).toHaveBeenCalledWith("light");
  });
});
