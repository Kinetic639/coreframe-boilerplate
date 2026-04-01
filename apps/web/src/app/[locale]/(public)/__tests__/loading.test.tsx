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

import PublicLoading from "../loading";

describe("PublicLoading", () => {
  it("renders the shared loader with public loading copy", () => {
    render(<PublicLoading />);

    expect(screen.getByTestId("loader")).toHaveAttribute("data-full-screen", "true");
    expect(screen.getByTestId("loader")).toHaveAttribute("data-message", "Loading...");
    expect(screen.getByTestId("loader")).toHaveAttribute("data-class-name", "bg-muted/20");
  });
});
