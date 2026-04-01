import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/Loader", () => ({
  default: ({
    fullScreen,
    message,
    className,
  }: {
    fullScreen: boolean;
    message: string;
    className?: string;
  }) => (
    <div
      data-testid="loader"
      data-full-screen={String(fullScreen)}
      data-message={message}
      data-class-name={className}
    />
  ),
}));

import DashboardV2Loading from "../loading";

describe("DashboardV2Loading", () => {
  it("renders the shared loader with dashboard loading copy", () => {
    render(<DashboardV2Loading />);

    expect(screen.getByTestId("loader")).toHaveAttribute("data-full-screen", "true");
    expect(screen.getByTestId("loader")).toHaveAttribute("data-message", "Loading dashboard...");
    expect(screen.getByTestId("loader")).toHaveAttribute("data-class-name", "bg-muted/20");
  });
});
