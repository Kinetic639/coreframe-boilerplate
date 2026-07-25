import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders with default and custom classes", () => {
    render(<Skeleton className="h-8 w-8" data-testid="skeleton" />);

    expect(screen.getByTestId("skeleton")).toHaveClass("animate-pulse", "rounded-md", "bg-muted");
    expect(screen.getByTestId("skeleton")).toHaveClass("h-8", "w-8");
  });
});
