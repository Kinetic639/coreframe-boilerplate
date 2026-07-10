import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { CountSessionListResult } from "@/hooks/queries/warehouse/audits";
import { AuditsDashboardClient } from "../audits-dashboard-client";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  listInventoryCountSessionsAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "scopeLocations") return `Scope: ${values?.count} location(s)`;
    if (key === "itemsCount") return `(${values?.count} items)`;
    if (key === "createdOn") return `Created: ${values?.date}`;
    if (key === "varianceDetected") return `${values?.count} variance(s) detected`;
    return key;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: unknown }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

function makeData(overrides: Partial<CountSessionListResult> = {}): CountSessionListResult {
  return {
    rows: [
      {
        id: "s1",
        count_number: "CNT-1",
        status: "draft",
        scope: {
          count_type: "location",
          location_ids: ["loc-1", "loc-2"],
          include_children: false,
        },
        notes: null,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        approved_at: null,
        total_lines: 10,
        counted_lines: 0,
        variance_lines: 0,
      },
      {
        id: "s2",
        count_number: "CNT-2",
        status: "submitted",
        scope: { count_type: "supplier", supplier_id: "sup-1" },
        notes: null,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-02T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        approved_at: null,
        total_lines: 5,
        counted_lines: 5,
        variance_lines: 2,
      },
      {
        id: "s3",
        count_number: "CNT-3",
        status: "approved",
        scope: { count_type: "location", location_ids: ["loc-1"] },
        notes: null,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-03T00:00:00Z",
        updated_at: "2026-01-03T00:00:00Z",
        approved_at: "2026-01-03T01:00:00Z",
        total_lines: 3,
        counted_lines: 3,
        variance_lines: 0,
      },
    ],
    totalCount: 3,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe("AuditsDashboardClient", () => {
  it("computes stat card values from the session list", () => {
    render(
      <AuditsDashboardClient branchId="branch-1" initialData={makeData()} canManage={true} />,
      { wrapper: makeWrapper() }
    );

    // open (draft) = 1, review (submitted) = 1, posted (approved) = 1, total = 3
    const values = screen.getAllByText(/^[0-9]+$/).map((el) => el.textContent);
    expect(values).toEqual(expect.arrayContaining(["1", "1", "1", "3"]));
  });

  it("filters the session list by search term", async () => {
    render(
      <AuditsDashboardClient branchId="branch-1" initialData={makeData()} canManage={true} />,
      { wrapper: makeWrapper() }
    );

    expect(screen.getByText("CNT-1")).toBeInTheDocument();
    expect(screen.getByText("CNT-2")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("searchPlaceholder"), "CNT-2");

    expect(screen.queryByText("CNT-1")).not.toBeInTheDocument();
    expect(screen.getByText("CNT-2")).toBeInTheDocument();
  });

  it("shows a variance badge only for non-posted sessions with variance lines", () => {
    render(
      <AuditsDashboardClient branchId="branch-1" initialData={makeData()} canManage={true} />,
      { wrapper: makeWrapper() }
    );

    expect(screen.getByText("2 variance(s) detected")).toBeInTheDocument();
  });

  it("hides the 'new audit' button when the user cannot manage audits", () => {
    render(
      <AuditsDashboardClient branchId="branch-1" initialData={makeData()} canManage={false} />,
      { wrapper: makeWrapper() }
    );

    expect(screen.queryByText("newAudit")).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no sessions", () => {
    render(
      <AuditsDashboardClient
        branchId="branch-1"
        initialData={makeData({ rows: [], totalCount: 0 })}
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    expect(screen.getByText("noSessionsTitle")).toBeInTheDocument();
  });
});
