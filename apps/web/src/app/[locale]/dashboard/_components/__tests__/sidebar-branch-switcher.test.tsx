import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockChangeBranch, mockSuccess, mockError, mockSetActiveBranch, mockReplace, mockRefresh } =
  vi.hoisted(() => ({
    mockChangeBranch: vi.fn(),
    mockSuccess: vi.fn(),
    mockError: vi.fn(),
    mockSetActiveBranch: vi.fn(),
    mockReplace: vi.fn(),
    mockRefresh: vi.fn(),
  }));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector?: (state: any) => unknown) => {
    const state = {
      activeOrg: { id: "org-1" },
      activeBranchId: "b-1",
      setActiveBranch: mockSetActiveBranch,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/app/actions/shared/changeBranch", () => ({
  changeBranch: (...args: unknown[]) => mockChangeBranch(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mockSuccess,
    error: mockError,
  },
}));

import { SidebarBranchSwitcher } from "../sidebar-branch-switcher";

const branches = [
  { id: "b-1", name: "Warsaw" },
  { id: "b-2", name: "Berlin" },
] as never;

describe("SidebarBranchSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current active branch", () => {
    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    expect(screen.getAllByText("Warsaw")).toHaveLength(2);
  });

  it("switches branches successfully and completes the transition", async () => {
    mockChangeBranch.mockResolvedValue({ success: true });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    fireEvent.click(screen.getByRole("button", { name: /berlin/i }));

    await waitFor(() => {
      expect(mockChangeBranch).toHaveBeenCalledWith("b-2");
      expect(mockSetActiveBranch).toHaveBeenCalledWith("b-2");
      expect(mockSuccess).toHaveBeenCalledWith("Branch switched successfully");
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/start");
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates to the safe route before refreshing (ordering)", async () => {
    mockChangeBranch.mockResolvedValue({ success: true });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    fireEvent.click(screen.getByRole("button", { name: /berlin/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    const replaceOrder = mockReplace.mock.invocationCallOrder[0];
    const refreshOrder = mockRefresh.mock.invocationCallOrder[0];
    expect(replaceOrder).toBeLessThan(refreshOrder);
  });

  it("shows an error toast when the action fails and performs no transition", async () => {
    mockChangeBranch.mockResolvedValue({ success: false, error: "Nope" });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    fireEvent.click(screen.getByRole("button", { name: /berlin/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith("Nope");
    });

    // Server rejected the switch — no client state, navigation, or refresh
    // should occur; the previous branch must remain active.
    expect(mockSetActiveBranch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("does nothing when selecting the already-active branch", async () => {
    mockChangeBranch.mockResolvedValue({ success: true });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    // Both the trigger and the Warsaw dropdown item show "Warsaw" text; the
    // dropdown item (the actually-selectable one) is the second match.
    const warsawButtons = screen.getAllByRole("button", { name: /warsaw/i });
    fireEvent.click(warsawButtons[1]);

    expect(mockChangeBranch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
