import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "../badge";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge-root" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

describe("Badge", () => {
  it("renders semantic size and custom variant classes", () => {
    render(
      <Badge variant="success" size="lg" className="extra-badge">
        Active
      </Badge>
    );

    expect(screen.getByTestId("badge-root")).toHaveAttribute("data-variant", "outline");
    expect(screen.getByTestId("badge-root")).toHaveClass(
      "text-base",
      "px-3",
      "py-1",
      "extra-badge"
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("supports removable badges", () => {
    const onRemove = vi.fn();

    render(
      <Badge removable onRemove={onRemove}>
        Removable
      </Badge>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not render a remove button unless requested", () => {
    render(<Badge variant="warning">Pending</Badge>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
