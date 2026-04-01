import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressIndicator } from "../progress-indicator";

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress-bar" data-value={value} className={className} />
  ),
}));

describe("ProgressIndicator", () => {
  it("renders the default bar variant with a computed percentage", () => {
    render(<ProgressIndicator value={30} max={60} />);

    expect(screen.getByTestId("progress-bar")).toHaveAttribute("data-value", "50");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders steps variant with completed and current states", () => {
    render(
      <ProgressIndicator
        variant="steps"
        value={0}
        currentStep={1}
        steps={[
          { label: "Profile", description: "Set up account" },
          { label: "Permissions" },
          { label: "Done" },
        ]}
      />
    );

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Set up account")).toBeInTheDocument();
    expect(screen.getByText("Permissions")).toHaveClass("text-primary");
    expect(screen.getByText("Profile")).toHaveClass("text-muted-foreground");
  });

  it("renders circular variant and clamps percentage values", () => {
    const { container } = render(<ProgressIndicator variant="circular" value={150} max={100} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("can hide labels in non-step variants", () => {
    render(<ProgressIndicator value={20} showLabel={false} />);
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
  });
});
