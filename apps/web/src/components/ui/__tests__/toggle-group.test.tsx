import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

vi.mock("@radix-ui/react-toggle-group", () => ({
  Root: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="toggle-group-root" className={className}>
      {children}
    </div>
  ),
  Item: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button className={className}>{children}</button>
  ),
}));

describe("ToggleGroup", () => {
  it("renders the root layout classes", () => {
    render(<ToggleGroup type="single" />);

    expect(screen.getByTestId("toggle-group-root")).toHaveClass(
      "flex",
      "items-center",
      "justify-center",
      "gap-1"
    );
  });

  it("passes shared variant and size to child items through context", () => {
    render(
      <ToggleGroup type="single" variant="outline" size="sm">
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
      </ToggleGroup>
    );

    expect(screen.getByRole("button", { name: "Left" })).toHaveClass("border", "h-9", "px-2.5");
  });

  it("lets item props win when group context does not provide them", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="right" size="lg">
          Right
        </ToggleGroupItem>
      </ToggleGroup>
    );

    expect(screen.getByRole("button", { name: "Right" })).toHaveClass("h-11", "px-5");
  });
});
