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

vi.mock("@/app/actions/organization/positions", () => ({
  listPositionsAction: vi.fn(),
  createPositionAction: vi.fn(),
  updatePositionAction: vi.fn(),
  deletePositionAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { PositionsClient } from "../_components/positions-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { listPositionsAction, createPositionAction } from "@/app/actions/organization/positions";
import type { OrgPosition } from "@/server/services/organization.service";

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

function setupPermissions(canManage = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: () => canManage,
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const samplePosition: OrgPosition = {
  id: "p-1",
  organization_id: "org-1",
  name: "Engineer",
  description: "Software engineer",
} as unknown as OrgPosition;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PositionsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // positions-1: Create button visible when user has members.manage permission
  it("renders Create Position button when user has manage permission", () => {
    setupPermissions(true);
    render(<PositionsClient initialPositions={[]} />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /create position/i })).toBeInTheDocument();
  });

  // positions-2: Create button absent when user lacks members.manage
  it("hides Create Position button when user lacks manage permission", () => {
    setupPermissions(false);
    render(<PositionsClient initialPositions={[]} />, { wrapper: createWrapper() });
    expect(screen.queryByRole("button", { name: /create position/i })).not.toBeInTheDocument();
  });

  // positions-3: listPositionsAction NOT called on mount (SSR-first)
  it("does not call listPositionsAction on mount", () => {
    setupPermissions(true);
    render(<PositionsClient initialPositions={[]} />, { wrapper: createWrapper() });
    expect(listPositionsAction).not.toHaveBeenCalled();
  });

  // positions-4: Position name renders immediately from initialPositions (no fetch)
  it("renders position name from initialPositions without fetching", () => {
    setupPermissions(true);
    render(<PositionsClient initialPositions={[samplePosition]} />, { wrapper: createWrapper() });
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(listPositionsAction).not.toHaveBeenCalled();
  });

  // positions-5: createPositionAction called with correct name on submit
  it("calls createPositionAction with name on submit", async () => {
    vi.mocked(listPositionsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createPositionAction).mockResolvedValue({ success: true, data: samplePosition });
    setupPermissions(true);
    render(<PositionsClient initialPositions={[]} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /create position/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(createPositionAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Engineer" })
      )
    );
  });

  // positions-6: Error path — createPositionAction failure shows toast
  it("shows error toast when createPositionAction fails", async () => {
    const { toast } = await import("react-toastify");
    vi.mocked(createPositionAction).mockResolvedValue({ success: false, error: "Server error" });
    setupPermissions(true);
    render(<PositionsClient initialPositions={[]} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /create position/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "BadPos" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Server error"));
  });
});
