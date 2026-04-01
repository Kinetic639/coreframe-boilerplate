import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/v2/layout/compact-breadcrumbs", () => ({
  CompactBreadcrumbs: ({ breadcrumbs }: { breadcrumbs: { label: string; href: string }[] }) => (
    <div data-testid="breadcrumbs">{breadcrumbs[0]?.label}</div>
  ),
}));

vi.mock("@/components/activity/DashboardStatusBarActivity", () => ({
  DashboardStatusBarActivity: ({ initialLatestEvent }: { initialLatestEvent: unknown }) => (
    <div data-testid="activity">{initialLatestEvent ? "event" : "no-event"}</div>
  ),
}));

import { DashboardStatusBar } from "../DashboardStatusBar";

describe("DashboardStatusBar", () => {
  it("renders static breadcrumbs and activity preview", () => {
    render(<DashboardStatusBar initialLatestEvent={null} />);

    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Dashboard");
    expect(screen.getByTestId("activity")).toHaveTextContent("no-event");
  });
});
