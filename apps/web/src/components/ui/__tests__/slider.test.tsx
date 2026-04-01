import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "../slider";

vi.mock("@radix-ui/react-slider", () => ({
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
}));

describe("Slider", () => {
  it("renders root, track, range, and thumb with expected classes", () => {
    render(<Slider className="custom-slider" />);

    expect(screen.getByTestId("slider-root")).toHaveClass("relative", "custom-slider");
    expect(screen.getByTestId("slider-track")).toHaveClass("bg-secondary");
    expect(screen.getByTestId("slider-range")).toHaveClass("bg-primary");
    expect(screen.getByTestId("slider-thumb")).toHaveClass("border-primary");
  });
});
