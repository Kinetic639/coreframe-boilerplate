import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: vi.fn(),
}));

vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: vi.fn(),
  useCreateLocationMutation: vi.fn(),
  useUpdateLocationMutation: vi.fn(),
  useDeleteLocationMutation: vi.fn(),
}));

vi.mock("@/lib/warehouse/location-tree", () => ({
  buildLocationTree: vi.fn(),
}));

// Silence react-toastify in tests
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock AlertDialog as pass-through
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({
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
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

// Stub LocationFormDialog to keep tests simple
// Path must match what locations-client.tsx imports (resolved from its directory)
vi.mock("@/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog", () => ({
  LocationFormDialog: ({
    open,
    onSubmit,
    onOpenChange,
  }: {
    open: boolean;
    onSubmit: (d: unknown) => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open ? (
      <div data-testid="location-form-dialog">
        <button onClick={() => onSubmit({ name: "Test Location" })} data-testid="submit-form">
          Submit
        </button>
        <button onClick={() => onOpenChange(false)} data-testid="cancel-form">
          Cancel
        </button>
      </div>
    ) : null,
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { usePermissions } from "@/hooks/v2/use-permissions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import {
  useWarehouseLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} from "@/hooks/queries/warehouse";
import { buildLocationTree } from "@/lib/warehouse/location-tree";
import { LocationsClient } from "../locations-client";
import type { WarehouseLocation, WarehouseLocationTreeNode } from "@/lib/warehouse/location-tree";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLocation(overrides: Partial<WarehouseLocation> = {}): WarehouseLocation {
  return {
    id: "loc-001",
    organization_id: "org-1",
    branch_id: "branch-1",
    name: "Aisle A",
    code: null,
    description: null,
    icon_name: null,
    color: null,
    parent_id: null,
    level: 0,
    sort_order: 0,
    qr_code: "qr-x",
    created_by: "user-1",
    updated_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeTreeNode(
  loc: WarehouseLocation,
  children: WarehouseLocationTreeNode[] = []
): WarehouseLocationTreeNode {
  return { ...loc, children };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const noopMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppStoreV2).mockReturnValue("branch-1" as never);
  vi.mocked(useCreateLocationMutation).mockReturnValue(noopMutation as never);
  vi.mocked(useUpdateLocationMutation).mockReturnValue(noopMutation as never);
  vi.mocked(useDeleteLocationMutation).mockReturnValue(noopMutation as never);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LocationsClient", () => {
  it("shows no-permission message when canRead is false", () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([]);

    render(<LocationsClient initialLocations={[]} />, { wrapper });
    expect(screen.getByText(/permission to view locations/i)).toBeInTheDocument();
  });

  it("shows no-branch message when activeBranchId is null", () => {
    vi.mocked(useAppStoreV2).mockReturnValue(null as never);
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([]);

    render(<LocationsClient initialLocations={[]} />, { wrapper });
    expect(screen.getByText(/no branch selected/i)).toBeInTheDocument();
  });

  it("renders empty state when no locations", () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi
        .fn()
        .mockImplementation((perm: string) =>
          ["warehouse.locations.read", "warehouse.locations.manage"].includes(perm)
        ),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([]);

    render(<LocationsClient initialLocations={[]} />, { wrapper });
    expect(screen.getByText(/no locations yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/add location/i).length).toBeGreaterThan(0);
  });

  it("renders location tree when locations exist", () => {
    const loc = makeLocation({ name: "Aisle A" });
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [loc] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([makeTreeNode(loc)]);

    render(<LocationsClient initialLocations={[loc]} />, { wrapper });
    expect(screen.getByText("Aisle A")).toBeInTheDocument();
  });

  it("opens form dialog when Add Location is clicked", () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([]);

    render(<LocationsClient initialLocations={[]} />, { wrapper });

    // Click the header "Add Location" button
    const addButtons = screen.getAllByText(/add location/i);
    fireEvent.click(addButtons[0]);

    expect(screen.getByTestId("location-form-dialog")).toBeInTheDocument();
  });

  it("hides Add Location button when canManage is false", () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perm: string) => perm === "warehouse.locations.read"),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([]);

    render(<LocationsClient initialLocations={[]} />, { wrapper });
    expect(screen.queryByText(/add location/i)).not.toBeInTheDocument();
  });

  it("shows delete confirmation dialog when delete is triggered", () => {
    const loc = makeLocation({ name: "Zone X" });
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      cannot: vi.fn(),
      canAny: vi.fn(),
      canAll: vi.fn(),
      getSnapshot: vi.fn(),
    } as never);
    vi.mocked(useWarehouseLocationsQuery).mockReturnValue({ data: [loc] } as never);
    vi.mocked(buildLocationTree).mockReturnValue([makeTreeNode(loc)]);

    render(<LocationsClient initialLocations={[loc]} />, { wrapper });

    // Click the delete button for "Zone X"
    const deleteBtn = screen.getByLabelText("Delete Zone X");
    fireEvent.click(deleteBtn);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    // "Zone X" appears in both the tree and the dialog description — check dialog contains it
    expect(dialog.textContent).toMatch(/zone x/i);
  });
});
