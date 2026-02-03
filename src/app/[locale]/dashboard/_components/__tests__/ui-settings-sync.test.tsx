/**
 * UiSettingsSync Component Tests
 *
 * Tests for bidirectional sync between localStorage (Zustand) and database.
 * Follows TDD pattern with comprehensive coverage.
 *
 * @vitest-environment jsdom
 */

import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";

// Track mock calls
const mockHydrateFromDb = vi.fn();
const mockSetLastSyncedAt = vi.fn();
const mockGetSettingsForSync = vi.fn().mockReturnValue({
  theme: "dark",
  sidebarCollapsed: false,
  updatedAt: "2026-02-01T12:00:00Z",
});

// Mock state that can be updated between tests
let mockSyncState = {
  _lastSyncedAt: null as string | null,
  _syncVersion: 0,
};

// Mock Zustand store - simpler approach using function mock
vi.mock("@/lib/stores/v2/ui-store", () => {
  return {
    useUiStoreV2: (selector: (state: Record<string, unknown>) => unknown) => {
      const fullState = {
        _lastSyncedAt: mockSyncState._lastSyncedAt,
        _syncVersion: mockSyncState._syncVersion,
        hydrateFromDb: mockHydrateFromDb,
        setLastSyncedAt: mockSetLastSyncedAt,
        getSettingsForSync: mockGetSettingsForSync,
      };
      return selector(fullState);
    },
    selectUiSyncState: (state: { _lastSyncedAt: string | null; _syncVersion: number }) => ({
      _lastSyncedAt: state._lastSyncedAt,
      _syncVersion: state._syncVersion,
    }),
  };
});

// Mock mutate function
const mockMutate = vi.fn();
let mockDbSettings: {
  ui?: { theme?: string; sidebarCollapsed?: boolean };
  updated_at?: string;
} | null = null;
let mockIsFetched = false;

vi.mock("@/hooks/queries/user-preferences", () => ({
  useDashboardSettingsQuery: () => ({
    data: mockDbSettings,
    isFetched: mockIsFetched,
  }),
  useSyncUiSettingsMutation: () => ({
    mutate: mockMutate,
  }),
}));

// Import component after mocks
import { UiSettingsSync } from "../ui-settings-sync";

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("UiSettingsSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset mock state
    mockSyncState = {
      _lastSyncedAt: null,
      _syncVersion: 0,
    };
    mockDbSettings = null;
    mockIsFetched = false;

    // Reset getSettingsForSync mock
    mockGetSettingsForSync.mockReturnValue({
      theme: "dark",
      sidebarCollapsed: false,
      updatedAt: "2026-02-01T12:00:00Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing (invisible component)", () => {
    const { container } = render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(container.firstChild).toBeNull();
  });

  it("does not sync before data is fetched", () => {
    mockIsFetched = false;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockHydrateFromDb).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("hydrates from DB when DB has newer data", () => {
    // Setup: DB has newer data than localStorage
    mockDbSettings = {
      ui: { theme: "light", sidebarCollapsed: true },
      updated_at: "2026-02-02T12:00:00Z", // Newer
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z"; // Older
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockHydrateFromDb).toHaveBeenCalledWith({
      theme: "light",
      sidebarCollapsed: true,
      updatedAt: "2026-02-02T12:00:00Z",
    });
  });

  it("syncs to DB when localStorage has newer data", () => {
    // Setup: localStorage has newer data than DB
    mockDbSettings = {
      ui: { theme: "light" },
      updated_at: "2026-02-01T10:00:00Z", // Older
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z"; // Newer
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockMutate).toHaveBeenCalled();
  });

  it("syncs to DB when DB has no settings", () => {
    // Setup: DB has no updated_at (empty settings)
    mockDbSettings = {};
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockMutate).toHaveBeenCalled();
  });

  it("syncs to DB when DB is null (no preferences)", () => {
    // Setup: No preferences record in DB
    mockDbSettings = null;
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockMutate).toHaveBeenCalled();
  });

  it("hydrates from DB when localStorage has no timestamp", () => {
    // Setup: localStorage has no _lastSyncedAt (fresh install)
    mockDbSettings = {
      ui: { theme: "dark" },
      updated_at: "2026-02-01T12:00:00Z",
    };
    mockSyncState._lastSyncedAt = null;
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockHydrateFromDb).toHaveBeenCalledWith({
      theme: "dark",
      sidebarCollapsed: undefined,
      updatedAt: "2026-02-01T12:00:00Z",
    });
  });

  it("does not hydrate when DB has no UI settings", () => {
    // Setup: DB has timestamp but no UI settings
    mockDbSettings = {
      updated_at: "2026-02-02T12:00:00Z",
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    // Should not call hydrateFromDb because there's no UI settings to hydrate
    expect(mockHydrateFromDb).not.toHaveBeenCalled();
  });

  it("debounces sync when _syncVersion changes", async () => {
    mockIsFetched = true;
    mockDbSettings = {
      ui: { theme: "dark" },
      updated_at: "2026-02-01T12:00:00Z",
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockSyncState._syncVersion = 1;

    const { rerender } = render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    // Clear initial sync call
    mockMutate.mockClear();

    // Simulate _syncVersion change (user changed settings)
    mockSyncState._syncVersion = 2;
    rerender(<UiSettingsSync />);

    // Should not call mutate immediately (debounce)
    expect(mockMutate).not.toHaveBeenCalled();

    // Fast forward past debounce delay (500ms)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Now should have synced
    expect(mockMutate).toHaveBeenCalled();
  });

  it("cancels pending sync on unmount", async () => {
    mockIsFetched = true;
    mockDbSettings = {
      ui: { theme: "dark" },
      updated_at: "2026-02-01T12:00:00Z",
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockSyncState._syncVersion = 1;

    const { unmount, rerender } = render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    // Clear initial sync
    mockMutate.mockClear();

    // Trigger a sync
    mockSyncState._syncVersion = 2;
    rerender(<UiSettingsSync />);

    // Unmount before debounce completes
    unmount();

    // Fast forward past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Should NOT have synced because component unmounted
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("updates lastSyncedAt after successful sync", () => {
    mockIsFetched = true;
    mockDbSettings = null;
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";

    // Mock mutate to call onSuccess callback
    mockMutate.mockImplementation((_settings: unknown, options?: { onSuccess?: () => void }) => {
      if (options?.onSuccess) {
        options.onSuccess();
      }
    });

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    expect(mockSetLastSyncedAt).toHaveBeenCalledWith("2026-02-01T12:00:00Z");
  });

  it("does not sync again when timestamps match (both sides synced)", () => {
    // Setup: Both sides have same timestamp (already in sync)
    mockDbSettings = {
      ui: { theme: "dark" },
      updated_at: "2026-02-01T12:00:00Z",
    };
    mockSyncState._lastSyncedAt = "2026-02-01T12:00:00Z";
    mockIsFetched = true;

    render(<UiSettingsSync />, {
      wrapper: createWrapper(),
    });

    // Should not hydrate or sync when timestamps match
    expect(mockHydrateFromDb).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
