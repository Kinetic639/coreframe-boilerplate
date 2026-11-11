/** @vitest-environment jsdom */

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataViewKeys } from "@/components/data-view/data-view-query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type { DataViewListParams } from "@/components/data-view/data-view.types";
import { useAcceptTicketMutation } from "../index";

const { acceptTicketAction } = vi.hoisted(() => ({ acceptTicketAction: vi.fn() }));

vi.mock("@/app/actions/help-desk", () => ({
  acceptTicketAction,
  closeTicketAction: vi.fn(),
  createTicketAction: vi.fn(),
  getTicketDetailAction: vi.fn(),
  getTicketTypeDefaultAcceptorsAction: vi.fn(),
  getTicketTypeDefaultRespondersAction: vi.fn(),
  listOrgMembersForTicketAssignmentAction: vi.fn(),
  listTicketTypesAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const params: DataViewListParams = {
  search: "",
  sort: null,
  page: 1,
  pageSize: 50,
  filters: {},
};

describe("Help Desk DataView invalidation", () => {
  beforeEach(() => {
    acceptTicketAction.mockResolvedValue({ success: true, data: {} });
  });

  it("invalidates the canonical list, sidebar, and selected detail after acceptance", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = dataViewScope.organization("org-1");
    const otherScope = dataViewScope.organization("org-2");
    queryClient.setQueryData(dataViewKeys.list("helpdesk-tickets", scope, params), { rows: [] });
    queryClient.setQueryData(dataViewKeys.sidebar("helpdesk-tickets", scope, params), {
      pages: [],
    });
    queryClient.setQueryData(dataViewKeys.detail("helpdesk-tickets", scope, "HD-1"), {
      id: "HD-1",
    });
    queryClient.setQueryData(dataViewKeys.list("helpdesk-tickets", otherScope, params), {
      rows: [{ id: "other-org" }],
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAcceptTicketMutation("HD-1", "org-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ticket_id: "00000000-0000-4000-8000-000000000001" });
    });

    expect(
      queryClient.getQueryState(dataViewKeys.list("helpdesk-tickets", scope, params))?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(dataViewKeys.sidebar("helpdesk-tickets", scope, params))
        ?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(dataViewKeys.detail("helpdesk-tickets", scope, "HD-1"))
        ?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(dataViewKeys.list("helpdesk-tickets", otherScope, params))
        ?.isInvalidated
    ).toBe(false);
  });
});
