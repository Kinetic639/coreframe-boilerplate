import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatConversationSummary } from "@/lib/messages/types";
import { MAX_CHAT_WINDOWS, useChatWindowsStore } from "@/lib/stores/v2/chat-windows-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessagesBar } from "../messages-bar";

function renderBar() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MessagesBar />
    </QueryClientProvider>
  );
}

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, unknown>) =>
        values && "count" in values ? `${key}:${values.count}` : key,
      { has: () => true }
    ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href: _href, ...props }: { children: React.ReactNode; href: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

const conversations: ChatConversationSummary[] = [
  {
    id: "c-read",
    kind: "direct",
    name: null,
    created_at: "2026-10-09T08:00:00.000Z",
    activity_at: "2026-10-09T10:00:00.000Z",
    unread_count: 0,
    muted: false,
    member_count: 2,
    members: [
      {
        user_id: "me",
        first_name: "Michał",
        last_name: "S",
        email: null,
        avatar_url: null,
        role: "member",
        last_read_at: "",
      },
      {
        user_id: "u-anna",
        first_name: "Anna",
        last_name: "Zielińska",
        email: null,
        avatar_url: null,
        role: "member",
        last_read_at: "",
      },
    ],
    last_message: null,
  },
  {
    id: "c-unread",
    kind: "group",
    name: "Magazyn CNP",
    created_at: "2026-10-09T08:00:00.000Z",
    activity_at: "2026-10-09T09:00:00.000Z",
    unread_count: 2,
    muted: false,
    member_count: 4,
    members: [],
    last_message: {
      id: "m1",
      author_id: "u-anna",
      kind: "text",
      body_plain: "PZ zaksięgowany",
      system_event: null,
      attachment_count: 0,
      created_at: "2026-10-09T09:00:00.000Z",
      deleted: false,
    },
  },
];

vi.mock("@/hooks/queries/messages", () => ({
  useConversations: () => ({ data: conversations, isLoading: false, isError: false }),
  useChatPeople: () => ({ data: [], isLoading: false }),
  messagesKeys: { conversations: () => ["x"] },
}));
vi.mock("../chat-provider", () => ({
  useChat: () => ({ orgId: "o1", meId: "me", meName: "Michał", onlineIds: new Set(["u-anna"]) }),
}));

describe("MessagesBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatWindowsStore.setState({ expanded: false, windows: [], storageKey: null });
    useChatWindowsStore.getState().hydrate("me", "o1");
  });

  it("collapsed: unread conversations first, badge on the messages icon, click opens a window", () => {
    renderBar();
    expect(screen.getByTestId("messages-bar")).toHaveAttribute("data-expanded", "false");

    const avatars = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") !== "bar.expand");
    expect(avatars[0]).toHaveAttribute("aria-label", "Magazyn CNP");
    expect(avatars[1]).toHaveAttribute("aria-label", "Anna Zielińska");
    // 1 conversation with unread messages
    expect(screen.getByRole("button", { name: "bar.expand" })).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Anna Zielińska" }));
    expect(useChatWindowsStore.getState().windows).toEqual([
      { conversationId: "c-read", collapsed: false },
    ]);
  });

  it("the messages icon expands the bar into the list, collapse brings the rail back", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "bar.expand" }));
    expect(screen.getByTestId("messages-bar")).toHaveAttribute("data-expanded", "true");
    expect(screen.getByText("bar.unread")).toBeInTheDocument();
    expect(screen.getByText("PZ zaksięgowany")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "bar.collapse" }));
    expect(screen.getByTestId("messages-bar")).toHaveAttribute("data-expanded", "false");
  });
});

describe("chat windows store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatWindowsStore.setState({ expanded: false, windows: [], storageKey: null });
  });

  it("keeps at most three windows, newest on the right, and remembers them", () => {
    const store = useChatWindowsStore.getState();
    store.hydrate("me", "o1");
    ["a", "b", "c", "d"].forEach((id) => useChatWindowsStore.getState().openWindow(id));
    expect(useChatWindowsStore.getState().windows.map((w) => w.conversationId)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(useChatWindowsStore.getState().windows).toHaveLength(MAX_CHAT_WINDOWS);

    useChatWindowsStore.getState().toggleCollapsed("c");
    useChatWindowsStore.getState().setExpanded(true);

    // Another page load: the saved state comes back
    useChatWindowsStore.setState({ expanded: false, windows: [], storageKey: null });
    useChatWindowsStore.getState().hydrate("me", "o1");
    const state = useChatWindowsStore.getState();
    expect(state.expanded).toBe(true);
    expect(state.windows).toEqual([
      { conversationId: "b", collapsed: false },
      { conversationId: "c", collapsed: true },
      { conversationId: "d", collapsed: false },
    ]);
  });

  it("re-opening an open conversation brings it to the right, expanded", () => {
    const store = useChatWindowsStore.getState();
    store.hydrate("me", "o1");
    store.openWindow("a");
    useChatWindowsStore.getState().openWindow("b", { collapsed: true });
    useChatWindowsStore.getState().openWindow("a", { collapsed: true });
    useChatWindowsStore.getState().openWindow("b");
    expect(useChatWindowsStore.getState().windows).toEqual([
      { conversationId: "a", collapsed: true },
      { conversationId: "b", collapsed: false },
    ]);
  });
});
