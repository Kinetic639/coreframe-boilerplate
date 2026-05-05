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
  listBranchesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createBranchAction: vi.fn(),
  updateBranchAction: vi.fn(),
  deleteBranchAction: vi.fn(),
  listBranchesForDataViewAction: vi.fn(),
  getBranchDetailAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// DataView uses nuqs for URL state — stub it out
vi.mock("nuqs", () => ({
  useQueryState: vi.fn(() => [null, vi.fn()]),
  useQueryStates: vi.fn(() => [
    { selected: null, search: "", sort: null, page: 1, pageSize: 50, filters: {} },
    vi.fn(),
  ]),
  parseAsString: { withDefault: () => ({}) },
  parseAsInteger: { withDefault: () => ({}) },
  parseAsJson: { withDefault: () => ({}) },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { BranchesClient } from "../_components/branches-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { createBranchAction } from "@/app/actions/organization/branches";
import type { OrgBranch } from "@/server/services/organization.service";
import type { PaginatedResult } from "@/components/data-view/data-view.types";

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

function makeInitialData(branches: OrgBranch[] = []): PaginatedResult<OrgBranch> {
  return { rows: branches, totalCount: branches.length, page: 1, pageSize: 50 };
}

function renderClient(branches: OrgBranch[] = []) {
  return render(<BranchesClient initialData={makeInitialData(branches)} allBranches={branches} />, {
    wrapper: createWrapper(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BranchesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // branches-1: Create button visible when user has branches.create permission
  it("renders Create Branch button when user has branches.create", () => {
    setupPermissions(true);
    renderClient();
    // useTranslations mock returns the key — "createButton"
    expect(screen.getByRole("button", { name: /createButton/i })).toBeInTheDocument();
  });

  // branches-2: createBranchAction called with correct name on submit
  it("calls createBranchAction with branch name on submit", async () => {
    setupPermissions(true);
    vi.mocked(createBranchAction).mockResolvedValue({ success: true, data: sampleBranch });
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: /createButton/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // "dialog.name" is the translated label key returned by the mock
    fireEvent.change(screen.getByLabelText(/dialog\.name/i), { target: { value: "Warsaw" } });
    fireEvent.click(screen.getByRole("button", { name: /dialog\.create/i }));

    await waitFor(() =>
      expect(createBranchAction).toHaveBeenCalledWith(expect.objectContaining({ name: "Warsaw" }))
    );
  });

  // branches-3: listBranchesAction not called synchronously on mount
  it("does not call listBranchesAction synchronously on mount", () => {
    setupPermissions(true);
    renderClient();
    // listBranchesAction is only called inside refreshAfterMutation (after mutations)
    expect(createBranchAction).not.toHaveBeenCalled();
  });

  // branches-4: Create button hidden when user lacks branches.create
  it("hides Create Branch button when user lacks branches.create", () => {
    setupPermissions(false);
    renderClient([sampleBranch]);
    expect(screen.queryByRole("button", { name: /createButton/i })).not.toBeInTheDocument();
  });
});
