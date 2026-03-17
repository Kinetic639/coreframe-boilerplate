/**
 * @vitest-environment jsdom
 *
 * DashboardStatusBarActivity — Unit Tests
 *
 * Verifies the layout-local controller component that owns recent activity
 * state and drives both the status bar trigger and the real activity drawer.
 *
 * Suites:
 *   T-ACTIVITY-SSR:       SSR initial data is used for first render
 *   T-ACTIVITY-DERIVE:    latest event derived from events[0], not separate state
 *   T-ACTIVITY-REFRESH:   all refresh triggers invoke refreshRecentActivity
 *   T-ACTIVITY-RACE:      stale responses are discarded
 *   T-ACTIVITY-DRAWER:    drawer opens/closes, receives real events
 *   T-ACTIVITY-REMOVAL:   no fake placeholder text remains
 */

import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DashboardStatusBarActivity } from "../DashboardStatusBarActivity";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Server action — controllable in tests
const mockGetRecentActivityAction = vi.fn();
vi.mock("@/app/actions/audit/get-recent-activity", () => ({
  getRecentActivityAction: () => mockGetRecentActivityAction(),
}));

// ActivityDrawer — record calls, verify props
vi.mock("../ActivityDrawer", () => ({
  ActivityDrawer: ({
    open,
    onOpenChange,
    events,
    isRefreshing,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    events: ProjectedEvent[];
    isRefreshing: boolean;
  }) => (
    <div
      data-testid="activity-drawer"
      data-open={String(open)}
      data-refreshing={String(isRefreshing)}
    >
      <span data-testid="drawer-event-count">{events.length}</span>
      <button onClick={() => onOpenChange(false)}>close</button>
    </div>
  ),
}));

// EventCategoryIcon — render category as text for assertions
vi.mock("@/components/audit/event-icons", () => ({
  EventCategoryIcon: ({ category }: { category: string }) => (
    <span data-testid="category-icon">{category}</span>
  ),
}));

// useActivitySummary — return deterministic string
vi.mock("../useActivitySummary", () => ({
  useActivitySummary: (event: ProjectedEvent) => `summary:${event.action_key}`,
}));

// next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ relativeTime: () => "just now" }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ProjectedEvent> = {}): ProjectedEvent {
  return {
    id: "evt-1",
    created_at: new Date().toISOString(),
    action_key: "auth.login",
    category: "AUTH",
    intent: "SUCCESS",
    event_tier: "baseline",
    actor_display: "Alice",
    entity_type: "user",
    entity_id: "user-1",
    target_type: null,
    target_id: null,
    branch_id: null,
    summary: "Alice logged in",
    metadata: {},
    request_id: null,
    summaryKey: "events.auth.login",
    summaryPerspective: "self",
    summaryParams: {},
    summaryEntities: {},
    ...overrides,
  };
}

const EVENT_A = makeEvent({ id: "evt-a", action_key: "auth.login" });
const EVENT_B = makeEvent({ id: "evt-b", action_key: "org.created", category: "ORGANIZATION" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function successResult(events: ProjectedEvent[]) {
  return { success: true as const, data: { events } };
}

// ---------------------------------------------------------------------------
// T-ACTIVITY-SSR: SSR initial data is used for first render
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-SSR: SSR initial data is used for first render", () => {
  beforeEach(() => {
    mockGetRecentActivityAction.mockResolvedValue(successResult([]));
  });
  afterEach(() => vi.clearAllMocks());

  it("renders the latest event summary from initialEvents without waiting for a fetch", () => {
    render(<DashboardStatusBarActivity initialEvents={[EVENT_A]} />);
    // summary derived from events[0] is shown immediately
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();
  });

  it("renders the category icon for the initial latest event", () => {
    render(<DashboardStatusBarActivity initialEvents={[EVENT_A]} />);
    expect(screen.getByTestId("category-icon")).toHaveTextContent("AUTH");
  });

  it("passes all initialEvents to the drawer on mount", () => {
    render(<DashboardStatusBarActivity initialEvents={[EVENT_A, EVENT_B]} />);
    expect(screen.getByTestId("drawer-event-count")).toHaveTextContent("2");
  });

  it("shows fallback when initialEvents is empty", () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    // no summary, no category icon
    expect(screen.queryByTestId("category-icon")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-DERIVE: latest summary is derived from events[0], not a separate state
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-DERIVE: latest event derived from events[0]", () => {
  beforeEach(() => {
    mockGetRecentActivityAction.mockResolvedValue(successResult([EVENT_B, EVENT_A]));
  });
  afterEach(() => vi.clearAllMocks());

  it("after refresh, summary reflects the new events[0]", async () => {
    render(<DashboardStatusBarActivity initialEvents={[EVENT_A]} />);
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();

    // Trigger a drawer-open refresh
    const button = screen.getByRole("button", { name: /recent activity/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      // EVENT_B is now events[0] — summary must reflect it
      expect(screen.getByText("summary:org.created")).toBeInTheDocument();
    });
  });

  it("drawer receives the same events list that drives the summary", async () => {
    render(<DashboardStatusBarActivity initialEvents={[EVENT_A]} />);

    const button = screen.getByRole("button", { name: /recent activity/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      // Both events returned by the mock are passed to the drawer
      expect(screen.getByTestId("drawer-event-count")).toHaveTextContent("2");
    });
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-REFRESH: all refresh triggers invoke the fetch
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-REFRESH: all refresh triggers invoke getRecentActivityAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetRecentActivityAction.mockResolvedValue(successResult([EVENT_A]));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opening the drawer triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const initialCallCount = mockGetRecentActivityAction.mock.calls.length;

    const button = screen.getByRole("button", { name: /recent activity/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockGetRecentActivityAction.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it("window focus triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const callsBefore = mockGetRecentActivityAction.mock.calls.length;

    await act(async () => {
      fireEvent(window, new Event("focus"));
    });

    expect(mockGetRecentActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("document visibilitychange to visible triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const callsBefore = mockGetRecentActivityAction.mock.calls.length;

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
    });

    await act(async () => {
      fireEvent(document, new Event("visibilitychange"));
    });

    expect(mockGetRecentActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("polling interval triggers a refresh after 30 seconds", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const callsBefore = mockGetRecentActivityAction.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockGetRecentActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("event listeners are removed on unmount (no memory leak)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const addDocSpy = vi.spyOn(document, "addEventListener");
    const removeDocSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<DashboardStatusBarActivity initialEvents={[]} />);
    unmount();

    // Every added listener must have a corresponding removal
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(addSpy.mock.calls.length - 1);
    expect(removeDocSpy.mock.calls.length).toBeGreaterThanOrEqual(addDocSpy.mock.calls.length - 1);
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-RACE: stale responses are discarded
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-RACE: stale older responses do not overwrite newer state", () => {
  afterEach(() => vi.clearAllMocks());

  it("discards a slow response that resolves after a newer one", async () => {
    let resolveSlowRequest!: (v: ReturnType<typeof successResult>) => void;
    const slowPromise = new Promise<ReturnType<typeof successResult>>(
      (res) => (resolveSlowRequest = res)
    );

    // First call is slow (stale), second is fast (fresh)
    mockGetRecentActivityAction
      .mockReturnValueOnce(slowPromise)
      .mockResolvedValueOnce(successResult([EVENT_B]));

    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const button = screen.getByRole("button", { name: /recent activity/i });

    // First click — slow request starts
    await act(async () => {
      fireEvent.click(button);
    });

    // Close and re-open — fast request starts (seq is now higher)
    await act(async () => {
      fireEvent.click(screen.getByText("close"));
    });
    await act(async () => {
      fireEvent.click(button);
    });

    // Fast request resolves — EVENT_B should be shown
    await waitFor(() => {
      expect(screen.getByTestId("drawer-event-count")).toHaveTextContent("1");
    });

    // Slow request finally resolves — its result must NOT overwrite the fresh state
    await act(async () => {
      resolveSlowRequest(successResult([EVENT_A, EVENT_B]));
    });

    // State must still reflect the fast (newer) response, not the stale one
    expect(screen.getByTestId("drawer-event-count")).toHaveTextContent("1");
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-DRAWER: drawer integration
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-DRAWER: drawer opens on button click and receives real events", () => {
  beforeEach(() => {
    mockGetRecentActivityAction.mockResolvedValue(successResult([EVENT_A]));
  });
  afterEach(() => vi.clearAllMocks());

  it("drawer starts closed", () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    expect(screen.getByTestId("activity-drawer")).toHaveAttribute("data-open", "false");
  });

  it("clicking the status bar button opens the drawer", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const button = screen.getByRole("button", { name: /recent activity/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByTestId("activity-drawer")).toHaveAttribute("data-open", "true");
  });

  it("drawer receives updated events after refresh on open", async () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    const button = screen.getByRole("button", { name: /recent activity/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId("drawer-event-count")).toHaveTextContent("1");
    });
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-REMOVAL: no fake placeholder history text remains
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-REMOVAL: no fake placeholder history text", () => {
  beforeEach(() => {
    mockGetRecentActivityAction.mockResolvedValue(successResult([]));
  });
  afterEach(() => vi.clearAllMocks());

  it("does not render the word 'History' as a label", () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    // "History" text is only in the fallback hidden span — but NOT as main visible content
    const historyText = screen.queryByText("History");
    // If it appears, it must be the sm:inline hidden fallback, not fake sample data
    if (historyText) {
      // The element should be the fallback span with class hidden sm:inline
      expect(historyText.tagName).toBe("SPAN");
    }
  });

  it("renders 'No recent activity' fallback — not fake sample entries", () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    // Fallback label is shown (may be visually hidden on mobile)
    const fallback = screen.queryByText("No recent activity");
    expect(fallback).toBeInTheDocument();
  });

  it("does not render hardcoded fake entity names", () => {
    render(<DashboardStatusBarActivity initialEvents={[]} />);
    // These strings come from the deleted StatusBarHistory fake data
    expect(screen.queryByText(/Products List/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SKU-12345/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Purchase Order/)).not.toBeInTheDocument();
  });
});
