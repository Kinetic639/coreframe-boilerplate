import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
  state: { activeOrgId: "org", activeBranchId: "a", isLoaded: true },
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/dashboard/start",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (select: (s: typeof mocks.state) => unknown) => select(mocks.state),
}));
import { HomeScopeBoundary } from "../_components/scope-boundary";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = { activeOrgId: "org", activeBranchId: "a", isLoaded: true };
});
const view = (branchId = "a") => (
  <HomeScopeBoundary
    orgId="org"
    branchId={branchId}
    refreshLabel="Refresh"
    refreshedAtLabel="Refreshed at 10:30"
    loadingLabel="Changing branch"
  >
    {(refreshControl) => (
      <>
        {refreshControl}
        <span>Private branch content</span>
      </>
    )}
  </HomeScopeBoundary>
);
describe("tab-local branch boundary", () => {
  it("refreshes explicitly without polling", () => {
    render(view());
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("immediately hides stale content and requests newly scoped server children", async () => {
    mocks.state.activeBranchId = "b";
    render(view());
    expect(screen.queryByText("Private branch content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Changing branch");
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard/start?branch=b", { scroll: false })
    );
  });
  it("reveals content only after the server branch matches the shell", async () => {
    mocks.state.activeBranchId = "b";
    const { rerender } = render(view());
    await act(async () => rerender(view("b")));
    expect(screen.getByText("Private branch content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
