import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/layout/compact-breadcrumbs", () => ({
  CompactBreadcrumbs: ({
    breadcrumbs,
  }: {
    breadcrumbs: Array<{ label: string; href: string }>;
  }) => <div data-testid="breadcrumbs">{JSON.stringify(breadcrumbs)}</div>,
}));

vi.mock("@/components/activity/DashboardStatusBarActivity", () => ({
  DashboardStatusBarActivity: ({ initialLatestEvent }: { initialLatestEvent: unknown }) => (
    <div data-testid="activity">{JSON.stringify(initialLatestEvent)}</div>
  ),
}));

import { DashboardStatusBar } from "../DashboardStatusBar";

describe("DashboardStatusBar", () => {
  it("renders static dashboard breadcrumbs and passes through latest event", () => {
    const event = { id: "event-1" } as never;

    render(<DashboardStatusBar initialLatestEvent={event} />);

    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent(
      '[{"label":"Dashboard","href":"/dashboard/start"}]'
    );
    expect(screen.getByTestId("activity")).toHaveTextContent('{"id":"event-1"}');
  });
});
