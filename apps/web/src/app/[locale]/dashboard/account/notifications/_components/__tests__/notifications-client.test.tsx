import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/hooks/queries/user-preferences", () => ({
  usePreferencesQuery: vi.fn(),
}));

vi.mock("@/components/v2/feedback/loading-skeleton", () => ({
  LoadingSkeleton: ({ variant, count }: { variant: string; count: number }) => (
    <div data-testid="loading-skeleton">{`${variant}:${count}`}</div>
  ),
}));

vi.mock("@/app/[locale]/dashboard/account/preferences/_components/notifications-section", () => ({
  NotificationsSection: ({ preferences }: { preferences: unknown }) => (
    <div data-testid="notifications-section">{JSON.stringify(preferences)}</div>
  ),
}));

import { NotificationsClient } from "../notifications-client";
import { usePreferencesQuery } from "@/hooks/queries/user-preferences";

describe("NotificationsClient", () => {
  it("shows a loading skeleton while preferences are loading", () => {
    vi.mocked(usePreferencesQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<NotificationsClient translations={{ description: "Manage notifications" }} />);

    expect(screen.getByTestId("loading-skeleton")).toHaveTextContent("form:1");
  });

  it("renders the notifications section with loaded preferences", () => {
    vi.mocked(usePreferencesQuery).mockReturnValue({
      data: { email_notifications_enabled: true },
      isLoading: false,
    } as never);

    render(<NotificationsClient translations={{ description: "Manage notifications" }} />);

    expect(screen.getByText("Manage notifications")).toBeInTheDocument();
    expect(screen.getByTestId("notifications-section")).toHaveTextContent(
      "email_notifications_enabled"
    );
  });

  it("passes null preferences when no data is returned", () => {
    vi.mocked(usePreferencesQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);

    render(<NotificationsClient translations={{ description: "Manage notifications" }} />);

    expect(screen.getByTestId("notifications-section")).toHaveTextContent("null");
  });
});
