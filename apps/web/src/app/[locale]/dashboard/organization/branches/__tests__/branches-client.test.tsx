import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/actions/organization/branches", () => ({
  listBranchesAction: vi.fn(),
  createBranchAction: vi.fn(),
  updateBranchAction: vi.fn(),
  deleteBranchAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { BranchesClient } from "../_components/branches-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { listBranchesAction, createBranchAction } from "@/app/actions/organization/branches";
import type { OrgBranch } from "@/server/services/organization.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function setupPermissions(canCreate = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (p: string) =>
      ["branches.create", "branches.update", "branches.delete"].includes(p) ? canCreate : false,
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const sampleBranch: OrgBranch = {
  id: "b-1",
  organization_id: "org-1",
  name: "Warsaw",
  slug: "warsaw",
  created_at: null,
  deleted_at: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BranchesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // branches-1: Create button visible when user has branches.create permission
  it("renders Create Branch button when user has branches.create", () => {
    setupPermissions(true);
    render(<BranchesClient initialBranches={[]} />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /create branch/i })).toBeInTheDocument();
  });

  // branches-2: createBranchAction called with correct name on submit
  it("calls createBranchAction with branch name on submit", async () => {
    setupPermissions(true);
    vi.mocked(listBranchesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createBranchAction).mockResolvedValue({ success: true, data: sampleBranch });
    render(<BranchesClient initialBranches={[]} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /create branch/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Warsaw" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(createBranchAction).toHaveBeenCalledWith(expect.objectContaining({ name: "Warsaw" }))
    );
  });

  // branches-3: listBranchesAction NOT called on initial mount (SSR-first)
  it("does not call listBranchesAction on mount", () => {
    setupPermissions(true);
    render(<BranchesClient initialBranches={[]} />, { wrapper: createWrapper() });
    expect(listBranchesAction).not.toHaveBeenCalled();
  });

  // branches-4: Branch name renders immediately from initialBranches (no fetch)
  it("renders branch name from initialBranches without fetching", () => {
    setupPermissions(true);
    render(<BranchesClient initialBranches={[sampleBranch]} />, { wrapper: createWrapper() });
    expect(screen.getByText("Warsaw")).toBeInTheDocument();
    expect(listBranchesAction).not.toHaveBeenCalled();
  });
});
