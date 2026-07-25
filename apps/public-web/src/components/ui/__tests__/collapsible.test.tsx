import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";

vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  CollapsibleContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="collapsible-content" className={className}>
      {children}
    </div>
  ),
}));

describe("Collapsible", () => {
  it("renders trigger and content with animation classes", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent className="custom-class">Panel</CollapsibleContent>
      </Collapsible>
    );

    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
    expect(screen.getByTestId("collapsible-content")).toHaveClass(
      "overflow-hidden",
      "custom-class"
    );
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });
});
