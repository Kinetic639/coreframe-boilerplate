import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toggle, toggleVariants } from "../toggle";

vi.mock("@radix-ui/react-toggle", () => ({
  Root: ({
    children,
    className,
    onPressedChange,
  }: {
    children: React.ReactNode;
    className?: string;
    onPressedChange?: (pressed: boolean) => void;
  }) => (
    <button className={className} onClick={() => onPressedChange?.(true)}>
      {children}
    </button>
  ),
}));

describe("Toggle", () => {
  it("renders with outline and size variants", () => {
    render(
      <Toggle variant="outline" size="sm">
        Bold
      </Toggle>
    );

    expect(screen.getByRole("button", { name: "Bold" })).toHaveClass("border", "h-9", "px-2.5");
  });

  it("forwards state change handlers", () => {
    const onPressedChange = vi.fn();

    render(<Toggle onPressedChange={onPressedChange}>Italic</Toggle>);
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));

    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it("exports default toggle variants", () => {
    expect(toggleVariants({})).toContain("h-10");
  });
});
