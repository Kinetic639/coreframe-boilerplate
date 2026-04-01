import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Progress } from "../progress";

vi.mock("@radix-ui/react-progress", () => ({
  Root: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="progress-root" className={className}>
      {children}
    </div>
  ),
  Indicator: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="progress-indicator" className={className} style={style} />
  ),
}));

describe("Progress", () => {
  it("renders with computed indicator transform", () => {
    render(<Progress value={25} className="custom-progress" />);

    expect(screen.getByTestId("progress-root")).toHaveClass("custom-progress");
    expect(screen.getByTestId("progress-indicator")).toHaveStyle({
      transform: "translateX(-75%)",
    });
  });
});
