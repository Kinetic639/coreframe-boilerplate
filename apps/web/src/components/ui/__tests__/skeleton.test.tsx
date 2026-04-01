import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders with default and custom classes", () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-10" />);

    expect(screen.getByTestId("skeleton")).toHaveClass("animate-pulse", "rounded-md", "bg-muted");
    expect(screen.getByTestId("skeleton")).toHaveClass("h-4", "w-10");
  });
});
