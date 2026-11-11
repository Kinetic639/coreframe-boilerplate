import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDirectoryRow } from "@/lib/contacts/types";
import { HeaderContacts } from "../header-contacts";

const listMock = vi.fn();
const startChat = vi.fn();
const permissions = vi.hoisted(() => ({ crm: true }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href: _href, ...props }: { children: React.ReactNode; href: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/app/actions/contacts", () => ({
  listContactsDirectoryAction: (input: unknown) => listMock(input),
}));
vi.mock("@/hooks/use-debounce", () => ({ useDebounce: (value: string) => value }));
vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({ can: () => permissions.crm }),
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector: (s: { activeOrgId: string }) => unknown) =>
    selector({ activeOrgId: "o1" }),
}));
vi.mock("@/components/v2/messages/chat-provider", () => ({
  useOptionalChat: () => ({ meId: "me", onlineIds: new Set(["u-anna"]) }),
}));
vi.mock("@/components/v2/messages/use-start-direct-chat", () => ({
  useStartDirectChat: () => startChat,
}));

const row = (overrides: Partial<ContactDirectoryRow>): ContactDirectoryRow => ({
  key: "member:u-anna",
  kind: "member",
  user_id: "u-anna",
  contact_id: null,
  display_name: "Anna Zielińska",
  first_name: "Anna",
  last_name: "Zielińska",
  email: "anna@x.pl",
  phone: "+48 600 100 200",
  mobile: null,
  job_title: "Help Desk",
  branch_id: "b1",
  branch_name: "CNP Poznań",
  avatar_url: null,
  visibility_scope: null,
  ...overrides,
});

const page = {
  rows: [
    row({}),
    row({
      key: "member:me",
      user_id: "me",
      display_name: "Michał Stępień",
      email: "me@x.pl",
      phone: null,
    }),
    row({
      key: "c1",
      kind: "external",
      user_id: null,
      contact_id: "c1",
      display_name: "Jan Dostawca",
      email: null,
      phone: null,
      job_title: null,
      branch_name: null,
      visibility_scope: "organization",
    }),
  ],
  totalCount: 3,
  page: 1,
  pageSize: 100,
  memberCount: 2,
  externalCount: 1,
};

function openDrawer() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HeaderContacts />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "title" }));
}

describe("HeaderContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.crm = true;
    listMock.mockResolvedValue({ success: true, data: page });
  });

  it("loads the directory only when opened and marks employees", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HeaderContacts />
      </QueryClientProvider>
    );
    expect(listMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "title" }));
    expect(await screen.findByText("Anna Zielińska")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith({ kind: "all", search: null, pageSize: 100 });

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
      "member",
      "member",
      "external",
    ]);
    expect(screen.getByText("member")).toBeInTheDocument(); // Anna
    expect(screen.getByText("you")).toBeInTheDocument(); // the viewer
    expect(screen.getAllByText("Help Desk · CNP Poznań")).toHaveLength(2);
  });

  it("offers message only for other employees; e-mail and call when the data is there", async () => {
    openDrawer();
    await screen.findByText("Anna Zielińska");

    // One "message" button: not for the viewer, not for the external contact
    const message = screen.getAllByRole("button", { name: "message" });
    expect(message).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "call" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "email" })).toHaveLength(2);

    fireEvent.click(message[0]!);
    expect(startChat).toHaveBeenCalledWith("u-anna");
  });

  it("filters by kind and searches on the server", async () => {
    openDrawer();
    await screen.findByText("Anna Zielińska");

    fireEvent.click(screen.getByRole("tab", { name: /tabs.members/ }));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith({ kind: "member", search: null, pageSize: 100 })
    );

    fireEvent.change(screen.getByRole("textbox", { name: "search" }), {
      target: { value: " anna " },
    });
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith({ kind: "member", search: "anna", pageSize: 100 })
    );
  });

  it("without CRM access: no external tab and no link to the module", async () => {
    permissions.crm = false;
    openDrawer();
    await screen.findByText("Anna Zielińska");
    expect(screen.queryByRole("tab", { name: /tabs.external/ })).not.toBeInTheDocument();
    expect(screen.queryByText("openModule")).not.toBeInTheDocument();
  });
});
