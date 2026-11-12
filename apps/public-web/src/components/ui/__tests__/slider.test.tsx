import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "../slider";

vi.mock("radix-ui", () => ({
  Slider: {
    Root: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="slider-root" className={className}>
        {children}
      </div>
    ),
    Track: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="slider-track" className={className}>
        {children}
      </div>
    ),
    Range: ({ className }: { className?: string }) => (
      <div data-testid="slider-range" className={className} />
    ),
    Thumb: ({ className }: { className?: string }) => (
      <div data-testid="slider-thumb" className={className} />
    ),
  },
}));

describe("Slider", () => {
  it("renders root, track, range, and thumb with expected classes", () => {
    render(<Slider className="custom-slider" />);

    expect(screen.getByTestId("slider-root")).toHaveClass("relative", "custom-slider");
    expect(screen.getByTestId("slider-track")).toHaveClass("bg-muted");
    expect(screen.getByTestId("slider-range")).toHaveClass("bg-primary");
    // One thumb per value: [min, max] by default.
    const thumbs = screen.getAllByTestId("slider-thumb");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveClass("border-primary");
  });
});
