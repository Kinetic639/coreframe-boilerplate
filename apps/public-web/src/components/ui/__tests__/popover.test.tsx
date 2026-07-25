import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

vi.mock("@radix-ui/react-popover", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({
    children,
    className,
    align,
    sideOffset,
  }: {
    children: React.ReactNode;
    className?: string;
    align?: string;
    sideOffset?: number;
  }) => (
    <div
      data-testid="popover-content"
      data-align={align}
      data-side-offset={sideOffset}
      className={className}
    >
      {children}
    </div>
  ),
}));

describe("Popover", () => {
  it("renders trigger and content with default alignment props", () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    );

    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByTestId("popover-content")).toHaveAttribute("data-align", "center");
    expect(screen.getByTestId("popover-content")).toHaveAttribute("data-side-offset", "4");
  });

  it("applies custom classes and align values", () => {
    render(
      <PopoverContent align="start" className="custom-popover">
        Body
      </PopoverContent>
    );

    expect(screen.getByTestId("popover-content")).toHaveClass("custom-popover");
    expect(screen.getByTestId("popover-content")).toHaveAttribute("data-align", "start");
  });
});
