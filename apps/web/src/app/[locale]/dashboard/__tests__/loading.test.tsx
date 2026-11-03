import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/branding", () => ({
  BrandLoader: ({ label, variant }: { label?: string; variant?: string }) => (
    <div data-testid="brand-loader" data-variant={variant}>
      {label}
    </div>
  ),
}));

import DashboardV2Loading from "../loading";

describe("DashboardV2Loading", () => {
  it("renders the branded loader (animated logo) with the common loading copy", () => {
    render(<DashboardV2Loading />);

    expect(screen.getByTestId("brand-loader")).toHaveAttribute("data-variant", "beacon_swap");
    expect(screen.getByTestId("brand-loader")).toHaveTextContent("loading");
  });
});
