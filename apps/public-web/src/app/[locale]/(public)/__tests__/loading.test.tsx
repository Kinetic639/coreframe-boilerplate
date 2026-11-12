import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/page-loader", () => ({
  PageLoader: ({ className }: { className?: string }) => (
    <div data-testid="loader" data-class-name={className} />
  ),
}));

import PublicLoading from "../loading";

describe("PublicLoading", () => {
  it("renders the shared page loader with public spacing", () => {
    render(<PublicLoading />);

    expect(screen.getByTestId("loader")).toHaveAttribute("data-class-name", "py-24");
  });
});
