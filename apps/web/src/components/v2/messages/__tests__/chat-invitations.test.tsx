import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInvitations } from "../chat-invitations";

const respond = vi.fn();
let invitations: unknown[] = [];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name?: string; count?: number }) =>
    values?.name ? `${key}:${values.name}` : values?.count ? `${key}:${values.count}` : key,
}));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/actions/messages", () => ({
  respondToChatInvitationAction: (input: unknown) => respond(input),
}));
vi.mock("@/hooks/queries/messages", () => ({
  messagesKeys: { invitations: () => ["invitations"], conversations: () => ["conversations"] },
  useChatInvitations: () => ({ data: invitations }),
}));
vi.mock("../chat-provider", () => ({ useChat: () => ({ orgId: "o1" }) }));

const invitation = {
  conversation_id: "c1",
  name: "Magazyn CNP",
  created_at: "2026-10-11T10:00:00Z",
  member_count: 3,
  invited_by: {
    user_id: "u1",
    first_name: "Marta",
    last_name: "Nowak",
    email: null,
    avatar_url: null,
  },
};

function setup() {
  const onJoined = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatInvitations onJoined={onJoined} />
    </QueryClientProvider>
  );
  return { onJoined };
}

describe("ChatInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invitations = [invitation];
    respond.mockResolvedValue({ success: true, data: null });
  });

  it("renders nothing without invitations", () => {
    invitations = [];
    setup();
    expect(screen.queryByTestId("chat-invitations")).toBeNull();
  });

  it("shows the group, who invites and how many people are in it", () => {
    setup();
    expect(screen.getByText("Magazyn CNP")).toBeInTheDocument();
    expect(screen.getByText(/invitations\.from:Marta Nowak/)).toHaveTextContent("window.members:3");
  });

  it('"Join" accepts and opens the group', async () => {
    const { onJoined } = setup();
    fireEvent.click(screen.getByRole("button", { name: "invitations.join" }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith("c1"));
    expect(respond).toHaveBeenCalledWith({ conversationId: "c1", accept: true });
  });

  it('"Decline" answers no and opens nothing', async () => {
    const { onJoined } = setup();
    fireEvent.click(screen.getByRole("button", { name: "invitations.decline" }));
    await waitFor(() =>
      expect(respond).toHaveBeenCalledWith({ conversationId: "c1", accept: false })
    );
    expect(onJoined).not.toHaveBeenCalled();
  });
});
