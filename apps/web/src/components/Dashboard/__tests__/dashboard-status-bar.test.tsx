import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/layout/compact-breadcrumbs", () => ({
  CompactBreadcrumbs: ({ breadcrumbs }: { breadcrumbs: Array<{ label: string }> }) => (
    <div>{breadcrumbs.map((crumb) => crumb.label).join(" / ")}</div>
  ),
}));

vi.mock("@/components/activity/DashboardStatusBarActivity", () => ({
  DashboardStatusBarActivity: ({
    initialLatestEvent,
  }: {
    initialLatestEvent: { summary: string } | null;
  }) => <div>{initialLatestEvent?.summary ?? "no latest event"}</div>,
}));

import { DashboardStatusBar } from "../DashboardStatusBar";

describe("DashboardStatusBar", () => {
  it("renders breadcrumbs and latest event summary", () => {
    render(<DashboardStatusBar initialLatestEvent={{ summary: "Latest activity" } as never} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Latest activity")).toBeInTheDocument();
  });

  it("renders without a latest event", () => {
    render(<DashboardStatusBar initialLatestEvent={null} />);

    expect(screen.getByText("no latest event")).toBeInTheDocument();
  });
});
