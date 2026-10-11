import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "@/lib/notifications/types";
import { HeaderNotifications } from "../header-notifications";

const listMock = vi.fn();
const countMock = vi.fn();
const setReadMock = vi.fn();
const markAllMock = vi.fn();
const toastMock = vi.fn();
const push = vi.fn();
const realtime = vi.hoisted(() => ({
  handlers: [] as Array<(message: { payload: unknown }) => void>,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && "count" in values ? `${key}:${values.count}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: unknown } & Record<string, unknown>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("react-toastify", () => ({ toast: (...args: unknown[]) => toastMock(...args) }));
vi.mock("@/app/actions/notifications", () => ({
  listNotificationsAction: (input: unknown) => listMock(input),
  getUnreadNotificationsCountAction: () => countMock(),
  setNotificationsReadAction: (input: unknown) => setReadMock(input),
  markAllNotificationsReadAction: () => markAllMock(),
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector: (s: { activeOrgId: string }) => unknown) =>
    selector({ activeOrgId: "o1" }),
}));
vi.mock("@/lib/stores/v2/user-store", () => ({
  useUserStoreV2: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "me" } }),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    realtime: { setAuth: async () => undefined },
    getChannels: () => [],
    removeChannel: async () => undefined,
    channel: () => {
      const channel = {
        on: (_type: string, _filter: unknown, cb: (message: { payload: unknown }) => void) => {
          realtime.handlers.push(cb);
          return channel;
        },
        subscribe: (cb?: (status: string) => void) => {
          cb?.("SUBSCRIBED");
          return channel;
        },
      };
      return channel;
    },
  }),
}));

const now = Date.now();
const notification = (overrides: Partial<AppNotification>): AppNotification => ({
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "o1",
  type: "ticket.assigned",
  target_type: "helpdesk.ticket",
  target_id: "t1",
  target_code: "HD-000014",
  title: "Nie drukuje drukarka etykiet",
  snippet: null,
  data: {},
  created_at: new Date(now - 12 * 60_000).toISOString(),
  read_at: null,
  actor: { user_id: "u-marta", first_name: "Marta", last_name: "Nowak", email: null },
  ...overrides,
});

const rows = [
  notification({}),
  notification({
    id: "22222222-2222-4222-8222-222222222222",
    type: "comment",
    target_type: "planning.task",
    target_id: "p1",
    target_code: "PT-000008",
    title: "Inwentaryzacja regału",
    snippet: "Zrobione do połowy",
    read_at: new Date(now - 60_000).toISOString(),
    created_at: new Date(now - 3 * 24 * 3600_000).toISOString(),
  }),
];

function renderBell() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HeaderNotifications />
    </QueryClientProvider>
  );
}

async function openDrawer() {
  renderBell();
  expect(await screen.findByTestId("notifications-count")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "open" }));
  await screen.findAllByTestId("notification-row");
}

describe("HeaderNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.handlers.length = 0;
    countMock.mockResolvedValue({ success: true, data: 1 });
    listMock.mockResolvedValue({ success: true, data: { notifications: rows, nextCursor: null } });
    setReadMock.mockResolvedValue({ success: true, data: 1 });
    markAllMock.mockResolvedValue({ success: true, data: 1 });
  });

  it("shows the unread count and loads the list only when opened, grouped by day", async () => {
    renderBell();
    expect(await screen.findByTestId("notifications-count")).toHaveTextContent("1");
    expect(listMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    const items = await screen.findAllByTestId("notification-row");
    expect(items).toHaveLength(2);
    expect(screen.getByText("groups.today")).toBeInTheDocument();
    expect(screen.getByText("groups.earlier")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Marta Nowak")).toBeInTheDocument();
    expect(within(items[0]!).getByText("HD-000014")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Zrobione do połowy")).toBeInTheDocument();
  });

  it("the envelope toggles read and unread without opening the notification", async () => {
    await openDrawer();
    const [first] = screen.getAllByTestId("notification-row");
    expect(first).toHaveAttribute("data-unread", "true");

    fireEvent.click(within(first!).getByRole("button", { name: "markRead" }));
    await waitFor(() =>
      expect(setReadMock).toHaveBeenCalledWith({ ids: [rows[0]!.id], read: true })
    );
    expect(screen.getAllByTestId("notification-row")[0]).toHaveAttribute("data-unread", "false");
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(
      within(screen.getAllByTestId("notification-row")[0]!).getByRole("button", {
        name: "markUnread",
      })
    );
    await waitFor(() =>
      expect(setReadMock).toHaveBeenLastCalledWith({ ids: [rows[0]!.id], read: false })
    );
  });

  it("marks everything read", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: /markAll/ }));
    await waitFor(() => expect(markAllMock).toHaveBeenCalled());
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("notification-row")
        .every((row) => row.getAttribute("data-unread") === "false")
    ).toBe(true);
  });

  it("opening a notification marks it read and links to its object", async () => {
    await openDrawer();
    const link = within(screen.getAllByTestId("notification-row")[0]!).getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/help-desk/tickets/t1");
    fireEvent.click(link);
    await waitFor(() =>
      expect(setReadMock).toHaveBeenCalledWith({ ids: [rows[0]!.id], read: true })
    );
  });

  it("a live notification raises the count and shows a toast while the drawer is closed", async () => {
    renderBell();
    expect(await screen.findByTestId("notifications-count")).toHaveTextContent("1");
    await waitFor(() => expect(realtime.handlers).toHaveLength(1));

    act(() => {
      realtime.handlers[0]!({
        payload: notification({
          id: "33333333-3333-4333-8333-333333333333",
          type: "task.assigned",
        }),
      });
    });
    await waitFor(() => expect(screen.getByTestId("notifications-count")).toHaveTextContent("2"));
    expect(toastMock).toHaveBeenCalledTimes(1);

    // Another organization's notification is ignored
    act(() => {
      realtime.handlers[0]!({ payload: notification({ id: "x", organization_id: "other" }) });
    });
    expect(screen.getByTestId("notifications-count")).toHaveTextContent("2");
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});
