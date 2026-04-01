import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { Slider } from "../slider";

describe("Slider", () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  it("renders the slider thumb", () => {
    render(<Slider defaultValue={[25]} max={100} step={1} aria-label="Volume" />);

    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});
