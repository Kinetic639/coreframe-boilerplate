import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRefresh,
  mockCan,
  mockListBranchesAction,
  mockCreateBranchAction,
  mockUpdateBranchAction,
  mockDeleteBranchAction,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockCan: vi.fn(),
  mockListBranchesAction: vi.fn(),
  mockCreateBranchAction: vi.fn(),
  mockUpdateBranchAction: vi.fn(),
  mockDeleteBranchAction: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({ can: mockCan }),
}));

vi.mock("@/app/actions/organization/branches", () => ({
  listBranchesAction: (...args: unknown[]) => mockListBranchesAction(...args),
  createBranchAction: (...args: unknown[]) => mockCreateBranchAction(...args),
  updateBranchAction: (...args: unknown[]) => mockUpdateBranchAction(...args),
  deleteBranchAction: (...args: unknown[]) => mockDeleteBranchAction(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import { BranchesClient } from "../_components/branches-client";

const branch = {
  id: "b-1",
  name: "Warsaw",
  slug: "warsaw",
  organization_id: "org-1",
  created_at: null,
  deleted_at: null,
} as never;

describe("organization users branches client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
  });

  it("renders empty state", () => {
    render(<BranchesClient initialBranches={[]} />);

    expect(screen.getByText("No branches found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create branch/i })).toBeInTheDocument();
  });

  it("creates a branch and refreshes data", async () => {
    mockCreateBranchAction.mockResolvedValue({ success: true });
    mockListBranchesAction.mockResolvedValue({ data: [branch] });

    render(<BranchesClient initialBranches={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /create branch/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Warsaw" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "WARSAW!!" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateBranchAction).toHaveBeenCalledWith({
        name: "Warsaw",
        slug: "warsaw",
      });
    });

    await waitFor(() => {
      expect(mockListBranchesAction).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Branch created");
    });
  });

  it("updates an existing branch", async () => {
    mockUpdateBranchAction.mockResolvedValue({ success: true });
    mockListBranchesAction.mockResolvedValue({ data: [] });

    render(<BranchesClient initialBranches={[branch]} />);

    const branchRow = screen.getByText("Warsaw").closest("div.rounded-lg.border") as HTMLElement;
    const rowButtons = within(branchRow).getAllByRole("button");

    fireEvent.click(rowButtons[0]);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdateBranchAction).toHaveBeenCalledWith({
        branchId: "b-1",
        name: "Berlin",
        slug: "warsaw",
      });
    });
  });

  it("deletes an existing branch", async () => {
    mockDeleteBranchAction.mockResolvedValue({ success: true });
    mockListBranchesAction.mockResolvedValue({ data: [] });

    render(<BranchesClient initialBranches={[branch]} />);

    const branchRow = screen.getByText("Warsaw").closest("div.rounded-lg.border") as HTMLElement;
    const rowButtons = within(branchRow).getAllByRole("button");

    fireEvent.click(rowButtons[1]);

    await waitFor(() => {
      expect(mockDeleteBranchAction).toHaveBeenCalledWith({ branchId: "b-1" });
      expect(mockToastSuccess).toHaveBeenCalledWith("Branch deleted");
    });
  });
});
