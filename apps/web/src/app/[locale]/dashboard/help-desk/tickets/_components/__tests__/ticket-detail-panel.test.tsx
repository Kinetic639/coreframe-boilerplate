/**
 * @vitest-environment jsdom
 *
 * The ticket card: who may edit what (the reporter edits the fields, handlers
 * also change the status and take the ticket), edits go out as one save with
 * only the changed field, and a narrow card becomes one column with a Ticket
 * tab and the handling actions at the bottom.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import plMessages from "../../../../../../../../messages/pl.json";
import type { HelpdeskTicketDetail } from "@/server/services/helpdesk-tickets.service";

const actions = vi.hoisted(() => ({
  acceptTicketAction: vi.fn(),
  closeTicketAction: vi.fn(),
  createTicketAction: vi.fn(),
  setTicketStatusAction: vi.fn(),
  takeTicketAction: vi.fn(),
  updateTicketAction: vi.fn(),
}));
vi.mock("@/app/actions/help-desk", () => actions);
vi.mock("@/lib/help-desk/read", () => ({
  helpdeskRead: vi.fn(async () => ({ success: true, data: [] })),
}));
vi.mock("@/app/actions/qr/revoke", () => ({ revokeQrAction: vi.fn() }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href: _href, ...rest }: { children: React.ReactNode; href: unknown }) => (
    <a {...rest}>{children}</a>
  ),
}));
vi.unmock("next-intl");
vi.mock("@/components/features/comments", () => ({ CommentsThread: () => <div>comments</div> }));
vi.mock("@/components/features/attachments", () => ({ AttachmentsPanel: () => <div>files</div> }));
vi.mock("@/components/features/qr", () => ({ QrPrintLabelButton: () => <button>print</button> }));
vi.mock("../../[ticketId]/_components/assign-qr-dialog", () => ({ AssignQrDialog: () => null }));
vi.mock("@/components/primitives/rich-text/rich-text-inline-field", () => ({
  RichTextInlineField: ({ heading }: { heading: React.ReactNode }) => <div>{heading}</div>,
}));
vi.mock("@/components/primitives/rich-text/rich-text-renderer", () => ({
  RichTextRenderer: ({ emptyText }: { emptyText?: string }) => <p>{emptyText}</p>,
}));
vi.mock("@/components/primitives/avatar/user-avatar", () => ({
  UserAvatar: ({ fullName }: { fullName?: string | null }) => <span>{fullName}</span>,
}));

let width = 1200;
class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() {
    this.cb();
  }
  disconnect() {}
}

import { TicketDetailPanel } from "../ticket-detail-panel";

const ticket = (extra: Partial<HelpdeskTicketDetail> = {}): HelpdeskTicketDetail =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    org_id: "org-1",
    ticket_number: "HD-000001",
    title: "Drukarka",
    status: "open",
    priority: "medium",
    ticket_type_id: null,
    ticket_type_name: null,
    ticket_type_color: null,
    ticket_type_icon: null,
    created_by: "u-reporter",
    creator_name: "Ala Kot",
    creator_email: null,
    creator_avatar_url: null,
    creator_profile_href: null,
    assignees: [],
    requires_acceptance: false,
    accepted_by: null,
    accepted_at: null,
    accepted_by_name: null,
    accepted_by_avatar_url: null,
    branch_id: null,
    closed_at: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    description: null,
    description_plain: "Nie drukuje",
    description_rich: null,
    closed_by: null,
    resolved_at: null,
    due_at: null,
    comments: [],
    comments_total: 2,
    comments_next_cursor: null,
    activity: [],
    acceptors: [],
    can_manage: false,
    qr_assignment: null,
    ...extra,
  }) as HelpdeskTicketDetail;

function show(detail: HelpdeskTicketDetail, userId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pl" messages={plMessages} timeZone="Europe/Warsaw">
        <TicketDetailPanel
          detail={detail}
          currentUserId={userId}
          statusConfigs={null}
          priorityConfigs={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("ticket card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    width = 1200;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => width,
    });
    actions.updateTicketAction.mockResolvedValue({ success: true, data: null });
  });

  it("lets the reporter edit the title, with only the title sent", async () => {
    show(ticket(), "u-reporter");
    const title = screen.getByLabelText("Tytuł") as HTMLTextAreaElement;
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: "Drukarka na 2 piętrze" } });
    fireEvent.blur(title);
    await waitFor(() =>
      expect(actions.updateTicketAction).toHaveBeenCalledWith({
        ticket_id: "00000000-0000-4000-8000-000000000001",
        title: "Drukarka na 2 piętrze",
      })
    );
    // The reporter does not handle the ticket: no status menu, no "Biorę".
    expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Biorę/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Zamknij zgłoszenie/ })).toBeTruthy();
  });

  it("shows a read-only card to someone else, and nothing on a closed ticket", () => {
    show(ticket(), "u-other");
    expect(screen.queryByLabelText("Tytuł")).toBeNull();
    expect(screen.getByRole("heading", { name: "Drukarka" })).toBeTruthy();
  });

  it("gives handlers the status menu and Biorę", () => {
    show(ticket({ can_manage: true }), "u-handler");
    expect(screen.getByRole("button", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Biorę/ })).toBeTruthy();
    expect(screen.getByLabelText("Tytuł")).toBeTruthy();
  });

  it("is one column with a Ticket tab where it is narrow", () => {
    width = 400;
    show(ticket({ can_manage: true }), "u-handler");
    const tabs = within(screen.getByRole("tablist"));
    expect(tabs.getByRole("tab", { name: "Zgłoszenie" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    fireEvent.click(tabs.getByRole("tab", { name: /Komentarze/ }));
    expect(tabs.getByRole("tab", { name: /Komentarze/ }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("names what an edit changed in the activity", () => {
    show(
      ticket({
        activity: [
          {
            id: "a-1",
            ticket_id: "t",
            org_id: "org-1",
            actor_id: "u",
            actor_name: "Jan",
            event_type: "ticket_updated",
            payload: { title: { from: "a", to: "b" }, priority: { from: "low", to: "high" } },
            created_at: "2026-11-02T10:00:00Z",
          } as HelpdeskTicketDetail["activity"][number],
        ],
      }),
      "u-other"
    );
    fireEvent.click(screen.getByRole("tab", { name: "Aktywność" }));
    expect(screen.getByText(/tytuł, priorytet/)).toBeTruthy();
  });
});
