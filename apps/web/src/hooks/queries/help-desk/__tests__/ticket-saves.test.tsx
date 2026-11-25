/** @vitest-environment jsdom */

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ticketKeys, type TicketList } from "@/lib/help-desk/ticket-queries";
import { useSetTicketStatusMutation } from "../index";
import { clearOwnTicketSaves, isOwnTicketSave } from "../own-saves";

const { setTicketStatusAction } = vi.hoisted(() => ({ setTicketStatusAction: vi.fn() }));

vi.mock("@/app/actions/help-desk", () => ({
  acceptTicketAction: vi.fn(),
  closeTicketAction: vi.fn(),
  createTicketAction: vi.fn(),
  setTicketStatusAction,
  takeTicketAction: vi.fn(),
}));
vi.mock("@/lib/help-desk/read", () => ({ helpdeskRead: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TICKET = "00000000-0000-4000-8000-000000000001";
const params = { search: "", page: 1, pageSize: 50, sort: null, filters: {} };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(ticketKeys.list("org-1", params), {
    rows: [{ id: TICKET, ticket_number: "HD-1", status: "open", title: "A" }],
    totalCount: 1,
    page: 1,
    pageSize: 50,
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSetTicketStatusMutation("HD-1", "org-1"), { wrapper });
  const status = () =>
    queryClient.getQueryData<TicketList>(ticketKeys.list("org-1", params))?.rows[0].status;
  return { queryClient, result, status };
}

describe("ticket status save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOwnTicketSaves();
  });

  it("shows the new status before the server answers and keeps the saved row", async () => {
    let answer: (value: unknown) => void = () => {};
    setTicketStatusAction.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result, status } = setup();

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.mutateAsync({ ticket_id: TICKET, status: "waiting" });
      await Promise.resolve();
    });
    expect(status()).toBe("waiting");
    expect(isOwnTicketSave(TICKET)).toBe(true);

    await act(async () => {
      answer({
        success: true,
        data: { id: TICKET, org_id: "org-1", ticket_number: "HD-1", status: "waiting", title: "B" },
      });
      await pending;
    });
    expect(status()).toBe("waiting");
  });

  it("puts the old status back when the server refuses", async () => {
    setTicketStatusAction.mockResolvedValue({ success: false, error: "Insufficient permissions" });
    const { result, status } = setup();
    await act(async () => {
      await result.current
        .mutateAsync({ ticket_id: TICKET, status: "resolved" })
        .catch(() => undefined);
    });
    expect(status()).toBe("open");
  });
});
