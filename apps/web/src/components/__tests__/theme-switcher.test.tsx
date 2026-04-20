import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSetTheme = vi.fn();
const mockSetStoreTheme = vi.fn();
const mockUseTheme = vi.fn();
const mockUseUiStoreV2 = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (selector: (state: { setTheme: typeof mockSetStoreTheme }) => unknown) =>
    mockUseUiStoreV2(selector),
}));

import { ThemeSwitcher } from "../theme-switcher";

describe("ThemeSwitcher", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders after mount and toggles from dark to light", async () => {
    mockUseTheme.mockReturnValue({ theme: "dark", setTheme: mockSetTheme });
    mockUseUiStoreV2.mockImplementation((selector) => selector({ setTheme: mockSetStoreTheme }));

    render(<ThemeSwitcher />);

    const button = await screen.findByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(mockSetStoreTheme).toHaveBeenCalledWith("light");
  });

  it("toggles from light to dark", async () => {
    mockUseTheme.mockReturnValue({ theme: "light", setTheme: mockSetTheme });
    mockUseUiStoreV2.mockImplementation((selector) => selector({ setTheme: mockSetStoreTheme }));

    render(<ThemeSwitcher />);

    fireEvent.click(await screen.findByRole("button", { name: /toggle theme/i }));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockSetStoreTheme).toHaveBeenCalledWith("dark");
  });
});
