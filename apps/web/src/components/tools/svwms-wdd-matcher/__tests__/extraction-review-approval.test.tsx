/**
 * @vitest-environment jsdom
 *
 * Component tests: ExtractionReviewView's Phase 4/5 approval UI.
 *
 * Scope is deliberately narrow -- the header/approval-status-strip only,
 * not the full extraction/results tabs (heavy PDF/parsing machinery,
 * covered elsewhere). Mirrors the existing mocking convention from
 * tool-detail-client.test.tsx (mock the hook module wholesale rather than
 * wrapping in a real QueryClientProvider).
 */
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

function render(ui: ReactElement) {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return rtlRender(ui, { wrapper: Wrapper });
}

const { mockApproveMutate, mockCan, approveMutationState } = vi.hoisted(() => ({
  mockApproveMutate: vi.fn(),
  mockCan: vi.fn(() => true),
  approveMutationState: { isPending: false, data: undefined as unknown },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({
    can: mockCan,
    cannot: () => false,
    canAny: () => true,
    canAll: () => true,
  }),
}));

vi.mock("@/app/actions/tools/wdd-matcher", () => ({
  listSessionsAction: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/hooks/queries/tools/wdd-matcher", () => ({
  wddMatcherKeys: {
    enhancedPdfData: (id: string) => ["enhanced-pdf-data", id],
  },
  useSessionExtractedDataQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useSessionResultsQuery: () => ({ data: undefined, isLoading: false }),
  useRunMatchingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExportCsvMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useEnhancedPdfDataMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useApproveSessionMutation: () => ({
    mutate: mockApproveMutate,
    isPending: approveMutationState.isPending,
    data: approveMutationState.data,
  }),
}));

import { ExtractionReviewView } from "../extraction-review-view";
import type { WddMatcherSession } from "@/server/services/wdd-matcher.service";

function makeSession(overrides: Partial<WddMatcherSession> = {}): WddMatcherSession {
  return {
    id: "session-1",
    organization_id: "org-1",
    branch_id: "branch-1",
    name: "Session 1",
    status: "ready_for_review",
    match_summary: null,
    created_by: "user-1",
    approved_by: null,
    approved_at: null,
    created_at: "2026-09-10T10:00:00.000Z",
    updated_at: "2026-09-10T10:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

describe("ExtractionReviewView -- approval UI (Phase 4/5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    approveMutationState.isPending = false;
    approveMutationState.data = undefined;
  });

  it("shows the Approve button when the session is ready_for_review and the caller can approve", () => {
    render(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "ready_for_review" })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );

    expect(screen.getByTestId("approve-session-button")).toBeInTheDocument();
    expect(screen.queryByTestId("approval-status-strip")).not.toBeInTheDocument();
  });

  it("hides the Approve button when the caller lacks the approve permission (server-side enforcement is the real gate; this is UX only)", () => {
    mockCan.mockReturnValue(false);

    render(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "ready_for_review" })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );

    expect(screen.queryByTestId("approve-session-button")).not.toBeInTheDocument();
  });

  it("does not render any approval control for a non-ready, non-approved status (e.g. processing) -- no misleading active control", () => {
    render(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "processing" as never })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );

    expect(screen.queryByTestId("approve-session-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approval-status-strip")).not.toBeInTheDocument();
  });

  it("marks the session reviewed when the button is clicked, and shows its loading state", () => {
    const { rerender } = render(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "ready_for_review" })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );

    fireEvent.click(screen.getByTestId("approve-session-button"));
    expect(mockApproveMutate).toHaveBeenCalledWith("session-1", expect.anything());

    approveMutationState.isPending = true;
    rerender(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "ready_for_review" })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );
    expect(screen.getByTestId("approve-session-button")).toBeDisabled();
  });

  it("shows the reviewed state pointing to the repair-order import (the Matcher creates no orders)", () => {
    render(
      <ExtractionReviewView
        sessionId="session-1"
        matchedSession={makeSession({ status: "approved", approved_by: "user-1" })}
        onMatchingComplete={noop}
        onBack={noop}
      />
    );

    expect(screen.getByTestId("approval-status-strip")).toBeInTheDocument();
    expect(screen.getByText("approval.goToRepairOrderImport").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/workshop/import"
    );
    expect(screen.queryByTestId("retry-materialization-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approve-session-button")).not.toBeInTheDocument();
  });
});
