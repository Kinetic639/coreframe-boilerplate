import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

vi.mock("@radix-ui/react-tooltip", () => ({
  Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({
    children,
    sideOffset,
    className,
  }: {
    children: React.ReactNode;
    sideOffset?: number;
    className?: string;
  }) => (
    <div data-testid="tooltip-content" data-side-offset={sideOffset} className={className}>
      {children}
    </div>
  ),
}));

describe("Tooltip", () => {
  it("renders trigger and content inside a provider", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveAttribute("data-side-offset", "4");
  });

  it("applies custom class names to content", () => {
    render(<TooltipContent className="tooltip-extra">Extra</TooltipContent>);

    expect(screen.getByTestId("tooltip-content")).toHaveClass("tooltip-extra");
  });
});
