/**
 * @vitest-environment jsdom
 *
 * DashboardStatusBarActivity — Unit Tests
 *
 * Verifies the compact status-bar activity preview component.
 * No drawer — click navigates to the activity page.
 *
 * Suites:
 *   T-ACTIVITY-SSR:       SSR initial data renders immediately without fetch
 *   T-ACTIVITY-ICONS:     category icon + intent icon are shown for latest event
 *   T-ACTIVITY-NAV:       clicking the preview navigates to /dashboard/activity
 *   T-ACTIVITY-FALLBACK:  empty-state renders correctly when there is no event
 *   T-ACTIVITY-REFRESH:   all refresh triggers invoke getLatestActivityAction
 *   T-ACTIVITY-INVALIDATE: same-tab coreframe:activity-produced signal refreshes preview
 *   T-ACTIVITY-RACE:      stale responses are discarded
 *   T-ACTIVITY-REMOVAL:   no drawer, no fake placeholder data
 *   T-ACTIVITY-ANIMATION: animated wrapper updates key on event change
 */

import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DashboardStatusBarActivity } from "../DashboardStatusBarActivity";
import { ACTIVITY_PRODUCED_EVENT } from "@/lib/audit/activity-invalidation";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetLatestActivityAction = vi.fn();
vi.mock("@/app/actions/audit/get-latest-activity", () => ({
  getLatestActivityAction: () => mockGetLatestActivityAction(),
}));

vi.mock("@/components/audit/event-icons", () => ({
  EventCategoryIcon: ({ category }: { category: string }) => (
    <span data-testid="category-icon" data-category={category} />
  ),
  EventIntentIcon: ({ intent }: { intent: string }) => (
    <span data-testid="intent-icon" data-intent={intent} />
  ),
}));

vi.mock("../useActivitySummary", () => ({
  useActivitySummary: (event: ProjectedEvent) => `summary:${event.action_key}`,
}));

// Framer-motion — render children directly, no animation in tests
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    span: ({
      children,
      className,
      ...rest
    }: React.HTMLAttributes<HTMLSpanElement> & { "data-key"?: string }) => (
      <span className={className} {...rest}>
        {children}
      </span>
    ),
  },
}));

// next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    relativeTime: () => "2m ago",
  }),
}));

// i18n Link — render as <a> so we can inspect href
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
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

const EVENT_A = makeEvent({ id: "evt-a", action_key: "auth.login", category: "AUTH" });
const EVENT_B = makeEvent({
  id: "evt-b",
  action_key: "org.created",
  category: "ORGANIZATION",
  intent: "CREATE",
});

function successResult(event: ProjectedEvent | null) {
  return { success: true as const, data: { event } };
}

// ---------------------------------------------------------------------------
// T-ACTIVITY-SSR: SSR initial data renders immediately without fetch
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-SSR: SSR initial data is used for first render", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(null)));
  afterEach(() => vi.clearAllMocks());

  it("renders the event summary from initialLatestEvent without a fetch", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();
  });

  it("does not block on first-render fetch — summary is visible immediately", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    // Summary from SSR data is present synchronously — no fetch needed before first paint
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();
  });

  it("renders relative timestamp from SSR initial event", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    expect(screen.getByText("2m ago")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-ICONS: category + intent icons present for latest event
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-ICONS: category and intent icons are shown", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(null)));
  afterEach(() => vi.clearAllMocks());

  it("renders the category icon for the latest event", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    const icon = screen.getByTestId("category-icon");
    expect(icon).toHaveAttribute("data-category", "AUTH");
  });

  it("renders the intent icon for the latest event", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    const icon = screen.getByTestId("intent-icon");
    expect(icon).toHaveAttribute("data-intent", "SUCCESS");
  });

  it("no category or intent icons rendered when there is no latest event", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.queryByTestId("category-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("intent-icon")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-NAV: clicking navigates to the activity page
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-NAV: click navigates to /dashboard/activity", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(null)));
  afterEach(() => vi.clearAllMocks());

  it("renders a link pointing to /dashboard/activity", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/activity");
  });

  it("link is present even when there is no latest event", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/activity");
  });

  it("does not render a button that opens a drawer", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    // Only link elements, no drawer-open buttons
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-FALLBACK: empty state renders correctly
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-FALLBACK: fallback when no latest event", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(null)));
  afterEach(() => vi.clearAllMocks());

  it("shows 'No recent activity' text when initialLatestEvent is null", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });

  it("does not show a fake hardcoded event summary in the fallback", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.queryByText(/Products List/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SKU-12345/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Purchase Order/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-REFRESH: all refresh triggers call getLatestActivityAction
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-REFRESH: all refresh triggers invoke the action", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetLatestActivityAction.mockResolvedValue(successResult(EVENT_A));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("window focus triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    const callsBefore = mockGetLatestActivityAction.mock.calls.length;

    await act(async () => {
      fireEvent(window, new Event("focus"));
    });

    expect(mockGetLatestActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("document visibilitychange to visible triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    const callsBefore = mockGetLatestActivityAction.mock.calls.length;

    Object.defineProperty(document, "visibilityState", { value: "visible", writable: true });

    await act(async () => {
      fireEvent(document, new Event("visibilitychange"));
    });

    expect(mockGetLatestActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("polling interval triggers a refresh after 30 seconds", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    const callsBefore = mockGetLatestActivityAction.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockGetLatestActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("event listeners and interval are cleaned up on unmount", () => {
    const winAdd = vi.spyOn(window, "addEventListener");
    const winRemove = vi.spyOn(window, "removeEventListener");
    const docAdd = vi.spyOn(document, "addEventListener");
    const docRemove = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    unmount();

    expect(winRemove.mock.calls.length).toBeGreaterThanOrEqual(winAdd.mock.calls.length - 1);
    expect(docRemove.mock.calls.length).toBeGreaterThanOrEqual(docAdd.mock.calls.length - 1);
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-INVALIDATE: same-tab invalidation signal updates preview
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-INVALIDATE: coreframe:activity-produced custom event refreshes preview", () => {
  beforeEach(() => {
    mockGetLatestActivityAction.mockResolvedValue(successResult(EVENT_B));
  });
  afterEach(() => vi.clearAllMocks());

  it("dispatching the invalidation event triggers a refresh", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    const callsBefore = mockGetLatestActivityAction.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ACTIVITY_PRODUCED_EVENT));
    });

    expect(mockGetLatestActivityAction.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("after invalidation signal, preview reflects the refreshed event", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ACTIVITY_PRODUCED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText("summary:org.created")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-RACE: stale responses are discarded
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-RACE: stale older responses do not overwrite newer state", () => {
  afterEach(() => vi.clearAllMocks());

  it("discards a slow response that resolves after a newer one", async () => {
    let resolveStale!: (v: ReturnType<typeof successResult>) => void;
    const stalePromise = new Promise<ReturnType<typeof successResult>>(
      (res) => (resolveStale = res)
    );

    // First call is slow (stale), second is fast (fresh with EVENT_B)
    mockGetLatestActivityAction
      .mockReturnValueOnce(stalePromise)
      .mockResolvedValueOnce(successResult(EVENT_B));

    render(<DashboardStatusBarActivity initialLatestEvent={null} />);

    // Trigger first (slow) refresh via focus
    await act(async () => {
      fireEvent(window, new Event("focus"));
    });

    // Trigger second (fast) refresh via visibility
    Object.defineProperty(document, "visibilityState", { value: "visible", writable: true });
    await act(async () => {
      fireEvent(document, new Event("visibilitychange"));
    });

    // Fast response resolves — EVENT_B should be shown
    await waitFor(() => {
      expect(screen.getByText("summary:org.created")).toBeInTheDocument();
    });

    // Now let the stale first response resolve — must NOT overwrite
    await act(async () => {
      resolveStale(successResult(EVENT_A));
    });

    // Still EVENT_B (the newer response)
    expect(screen.queryByText("summary:auth.login")).not.toBeInTheDocument();
    expect(screen.getByText("summary:org.created")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-REMOVAL: no drawer, no mock data
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-REMOVAL: drawer and fake data are gone", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(null)));
  afterEach(() => vi.clearAllMocks());

  it("does not render an activity-drawer element", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.queryByTestId("activity-drawer")).not.toBeInTheDocument();
  });

  it("does not render a Sheet or drawer trigger button", () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-ACTIVITY-ANIMATION: animated wrapper updates on event change
// ---------------------------------------------------------------------------

describe("T-ACTIVITY-ANIMATION: content transitions when latest event changes", () => {
  beforeEach(() => mockGetLatestActivityAction.mockResolvedValue(successResult(EVENT_B)));
  afterEach(() => vi.clearAllMocks());

  it("shows updated summary after refresh without layout regression", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={EVENT_A} />);
    expect(screen.getByText("summary:auth.login")).toBeInTheDocument();

    await act(async () => {
      fireEvent(window, new Event("focus"));
    });

    await waitFor(() => {
      expect(screen.getByText("summary:org.created")).toBeInTheDocument();
    });

    // No extra elements injected — link is still the single root element
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("switching from null to event does not break rendering", async () => {
    render(<DashboardStatusBarActivity initialLatestEvent={null} />);
    expect(screen.getByText("No recent activity")).toBeInTheDocument();

    await act(async () => {
      fireEvent(window, new Event("focus"));
    });

    await waitFor(() => {
      expect(screen.getByText("summary:org.created")).toBeInTheDocument();
      expect(screen.queryByText("No recent activity")).not.toBeInTheDocument();
    });
  });
});
