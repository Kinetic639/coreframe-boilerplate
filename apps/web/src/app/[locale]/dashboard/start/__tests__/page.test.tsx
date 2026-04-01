import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/layout/page-header", () => ({
  PageHeaderV2: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

import DashboardV2StartPage from "../page";

describe("DashboardV2StartPage", () => {
  it("renders the static dashboard welcome header", () => {
    render(<DashboardV2StartPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Welcome to your dashboard. Select a module from the sidebar to get started."
      )
    ).toBeInTheDocument();
  });
});
