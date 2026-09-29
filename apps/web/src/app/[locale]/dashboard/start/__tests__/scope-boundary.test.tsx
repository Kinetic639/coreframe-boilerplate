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
import { HomeRefreshControl, HomeScopeBoundary } from "../_components/scope-boundary";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = { activeOrgId: "org", activeBranchId: "a", isLoaded: true };
});
const view = (branchId = "a") => (
  <HomeScopeBoundary orgId="org" branchId={branchId} loadingLabel="Changing branch">
    <HomeRefreshControl refreshLabel="Refresh" refreshedAtLabel="Refreshed at 10:30" />
    <span>Private branch content</span>
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
    expect(screen.queryByTestId("home-branch-loader")).not.toBeInTheDocument();
  });
});

describe("branch-switch loading presentation", () => {
  it("enters the branded loading state when the shell switches to another branch", async () => {
    const { rerender } = render(view());
    expect(screen.queryByTestId("home-branch-loader")).not.toBeInTheDocument();

    // Server-confirmed switch: the store moves to "b" while the server children are still "a".
    mocks.state.activeBranchId = "b";
    await act(async () => rerender(view()));

    expect(screen.getByTestId("home-branch-loader")).toBeInTheDocument();
    expect(screen.getByTestId("home-dashboard")).toHaveAttribute("aria-busy", "true");
  });

  it("renders the existing Ambra BrandLoader, not the old plain text line", () => {
    mocks.state.activeBranchId = "b";
    render(view());
    const status = screen.getByRole("status");
    expect(status).toBe(screen.getByTestId("home-branch-loader"));
    // Old presentation was a bare <p role="status">; the status is now the branded loader
    // (animated crystal logo SVG) with the label as its caption.
    expect(status.tagName).not.toBe("P");
    expect(status.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Changing branch").tagName).toBe("P");
    expect(screen.getByText("Changing branch").closest("[role='status']")).toBe(status);
  });

  it("shows no loader and keeps the current branch content when no switch happened (failed switch leaves the store unchanged)", () => {
    render(view());
    expect(screen.queryByTestId("home-branch-loader")).not.toBeInTheDocument();
    expect(screen.getByText("Private branch content")).toBeInTheDocument();
    expect(screen.getByTestId("home-dashboard")).toHaveAttribute("aria-busy", "false");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
