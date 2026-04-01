import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseUiStoreV2 = vi.fn();

vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (selector: (state: { _hasHydrated: boolean }) => unknown) =>
    mockUseUiStoreV2(selector),
}));

vi.mock("@/components/ui/Loader", () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}));

import { DashboardInitialLoader } from "../dashboard-initial-loader";

describe("DashboardInitialLoader", () => {
  it("shows the loader before hydration", () => {
    mockUseUiStoreV2.mockImplementation((selector) => selector({ _hasHydrated: false }));

    render(
      <DashboardInitialLoader>
        <div>dashboard content</div>
      </DashboardInitialLoader>
    );

    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  });

  it("renders children after hydration", () => {
    mockUseUiStoreV2.mockImplementation((selector) => selector({ _hasHydrated: true }));

    render(
      <DashboardInitialLoader>
        <div>dashboard content</div>
      </DashboardInitialLoader>
    );

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});
