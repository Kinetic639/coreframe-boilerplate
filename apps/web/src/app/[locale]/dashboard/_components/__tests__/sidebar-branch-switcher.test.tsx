import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockChangeBranch, mockSuccess, mockError, mockSetActiveBranch } = vi.hoisted(() => ({
  mockChangeBranch: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
  mockSetActiveBranch: vi.fn(),
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

  it("switches branches successfully", async () => {
    mockChangeBranch.mockResolvedValue({ success: true });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    fireEvent.click(screen.getByRole("button", { name: /berlin/i }));

    await waitFor(() => {
      expect(mockChangeBranch).toHaveBeenCalledWith("b-2");
      expect(mockSetActiveBranch).toHaveBeenCalledWith("b-2");
      expect(mockSuccess).toHaveBeenCalledWith("Branch switched successfully");
    });
  });

  it("shows an error toast when the action fails", async () => {
    mockChangeBranch.mockResolvedValue({ success: false, error: "Nope" });

    render(<SidebarBranchSwitcher branches={branches} activeBranchId="b-1" />);

    fireEvent.click(screen.getByRole("button", { name: /berlin/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith("Nope");
    });
  });
});
