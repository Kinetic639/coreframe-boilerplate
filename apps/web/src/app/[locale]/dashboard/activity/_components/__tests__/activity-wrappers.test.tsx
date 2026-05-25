import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetPersonalActivityAction = vi.fn();
const mockGetOrgActivityAction = vi.fn();
const mockGetAuditFeedAction = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
  },
}));

vi.mock("@/app/actions/audit/get-personal-activity", () => ({
  getPersonalActivityAction: (...args: unknown[]) => mockGetPersonalActivityAction(...args),
}));

vi.mock("@/app/actions/audit/get-org-activity", () => ({
  getOrgActivityAction: (...args: unknown[]) => mockGetOrgActivityAction(...args),
}));

vi.mock("@/app/actions/audit/get-audit-feed", () => ({
  getAuditFeedAction: (...args: unknown[]) => mockGetAuditFeedAction(...args),
}));

vi.mock("../event-feed-client", () => ({
  EventFeedClient: ({
    events,
    total,
    limit,
    offset,
    scope,
    onPageChange,
  }: {
    events: Array<{ id: string; summary: string }>;
    total: number;
    limit: number;
    offset: number;
    scope: string;
    onPageChange: (newOffset: number) => void;
  }) => (
    <div>
      <div data-testid={`${scope}-events`}>{events.map((event) => event.summary).join(",")}</div>
      <div data-testid={`${scope}-meta`}>{`${total}:${limit}:${offset}`}</div>
      <button onClick={() => onPageChange(limit)}>next page</button>
    </div>
  ),
}));

import { PersonalActivityWrapper } from "../personal-activity-wrapper";
import { OrgActivityWrapper } from "@/app/[locale]/dashboard/analytics/activity/_components/org-activity-wrapper";
import { AuditFeedWrapper } from "@/app/[locale]/dashboard/analytics/audit/_components/audit-feed-wrapper";

const initialEvents = [
  {
    id: "evt-1",
    summary: "Initial event",
  },
] as never;

describe("activity wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders personal activity heading and initial feed data", () => {
    render(<PersonalActivityWrapper initialEvents={initialEvents} initialTotal={3} limit={10} />);

    expect(screen.getByText("personalTitle")).toBeInTheDocument();
    expect(screen.getByText("personalDescription")).toBeInTheDocument();
    expect(screen.getByTestId("personal-events")).toHaveTextContent("Initial event");
    expect(screen.getByTestId("personal-meta")).toHaveTextContent("3:10:0");
  });

  it("loads the next personal activity page", async () => {
    mockGetPersonalActivityAction.mockResolvedValue({
      success: true,
      data: {
        events: [{ id: "evt-2", summary: "Loaded personal event" }],
        total: 4,
      },
    });

    render(<PersonalActivityWrapper initialEvents={initialEvents} initialTotal={3} limit={10} />);

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(mockGetPersonalActivityAction).toHaveBeenCalledWith(10, 10);
      expect(screen.getByTestId("personal-events")).toHaveTextContent("Loaded personal event");
      expect(screen.getByTestId("personal-meta")).toHaveTextContent("4:10:10");
    });
  });

  it("renders org activity heading and updates feed on page change", async () => {
    mockGetOrgActivityAction.mockResolvedValue({
      success: true,
      data: {
        events: [{ id: "evt-3", summary: "Loaded org event" }],
        total: 5,
      },
    });

    render(<OrgActivityWrapper initialEvents={initialEvents} initialTotal={2} limit={20} />);

    expect(screen.getByText("orgTitle")).toBeInTheDocument();
    expect(screen.getByText("orgDescription")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(mockGetOrgActivityAction).toHaveBeenCalledWith(20, 20);
      expect(screen.getByTestId("org-events")).toHaveTextContent("Loaded org event");
      expect(screen.getByTestId("org-meta")).toHaveTextContent("5:20:20");
    });
  });

  it("renders audit feed heading and keeps initial data when fetch fails", async () => {
    mockGetAuditFeedAction.mockResolvedValue({ success: false });

    render(<AuditFeedWrapper initialEvents={initialEvents} initialTotal={6} limit={15} />);

    expect(screen.getByText("auditTitle")).toBeInTheDocument();
    expect(screen.getByText("auditDescription")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(mockGetAuditFeedAction).toHaveBeenCalledWith(15, 15);
    });
    expect(screen.getByTestId("audit-events")).toHaveTextContent("Initial event");
    expect(screen.getByTestId("audit-meta")).toHaveTextContent("6:15:0");
  });
});
