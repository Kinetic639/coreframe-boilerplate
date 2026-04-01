import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useIsMobile } from "../use-mobile";

describe("useIsMobile", () => {
  it("returns true when viewport is below the breakpoint", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener,
        removeEventListener,
      })),
    });

    const { result, unmount } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
