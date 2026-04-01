import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useIsMobile } from "../use-mobile";

function Probe() {
  return <div>{useIsMobile() ? "mobile" : "desktop"}</div>;
}

describe("useIsMobile", () => {
  it("returns mobile when the viewport is below breakpoint", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener,
      removeEventListener,
    }) as never;

    render(<Probe />);

    await waitFor(() => expect(screen.getByText("mobile")).toBeInTheDocument());
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("returns desktop when the viewport is above breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as never;

    render(<Probe />);

    await waitFor(() => expect(screen.getByText("desktop")).toBeInTheDocument());
  });
});
