import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({ usePermissions: vi.fn() }));

vi.mock("@/hooks/queries/organization", () => ({
  usePositionsQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useCreatePositionMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePositionMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePositionMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

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

import { PositionsClient } from "../_components/positions-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import type { OrgPosition } from "@/server/services/organization.service";
import type { PaginatedResult } from "@/components/data-view/data-view.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function setupPermissions(canManage = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (p: string) => (p === "members.manage" ? canManage : false),
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const samplePosition: OrgPosition = {
  id: "pos-1",
  org_id: "org-1",
  name: "Engineer",
  description: "Software engineer",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  created_by: null,
  deleted_at: null,
};

function makeInitialData(positions: OrgPosition[] = []): PaginatedResult<OrgPosition> {
  return { rows: positions, totalCount: positions.length, page: 1, pageSize: 50 };
}

function renderClient(positions: OrgPosition[] = []) {
  return render(
    <PositionsClient initialData={makeInitialData(positions)} allPositions={positions} />,
    { wrapper: createWrapper() }
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PositionsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // pos-1: Create Position button visible when user has members.manage
  it("renders Create Position button when user has members.manage", () => {
    setupPermissions(true);
    renderClient();
    expect(screen.getByRole("button", { name: /createButton/i })).toBeInTheDocument();
  });

  // pos-2: Create Position button hidden when user lacks members.manage
  it("hides Create Position button when user lacks members.manage", () => {
    setupPermissions(false);
    renderClient();
    expect(screen.queryByRole("button", { name: /createButton/i })).not.toBeInTheDocument();
  });

  // pos-3: Dialog opens when Create Position is clicked
  it("opens create dialog when Create Position is clicked", async () => {
    setupPermissions(true);
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /createButton/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  // pos-4: Renders without crashing with position data
  it("renders without crashing with position data", () => {
    setupPermissions(true);
    renderClient([samplePosition]);
    expect(document.body).toBeTruthy();
  });
});
