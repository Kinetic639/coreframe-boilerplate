import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  ToastContainer: (props: { theme: string }) => (
    <div data-testid="toast-container" data-theme={props.theme} />
  ),
}));

import { ToastContainerThemed } from "../toast-container-themed";
import { useTheme } from "next-themes";

describe("ToastContainerThemed", () => {
  it("uses the explicit dark theme when mounted", () => {
    vi.mocked(useTheme).mockReturnValue({ theme: "dark", resolvedTheme: "dark" } as never);

    render(<ToastContainerThemed />);

    expect(screen.getByTestId("toast-container")).toHaveAttribute("data-theme", "dark");
  });

  it("uses the resolved theme when theme is system", () => {
    vi.mocked(useTheme).mockReturnValue({ theme: "system", resolvedTheme: "light" } as never);

    render(<ToastContainerThemed />);

    expect(screen.getByTestId("toast-container")).toHaveAttribute("data-theme", "light");
  });
});
