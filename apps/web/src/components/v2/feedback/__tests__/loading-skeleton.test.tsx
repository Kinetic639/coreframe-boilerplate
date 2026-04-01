import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadingSkeleton } from "../loading-skeleton";

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("LoadingSkeleton", () => {
  it("renders text skeletons by count", () => {
    render(<LoadingSkeleton variant="text" count={3} />);

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("renders card and list variants", () => {
    const { rerender } = render(<LoadingSkeleton variant="card" count={2} />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(6);

    rerender(<LoadingSkeleton variant="list" count={2} />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(6);
  });
});
