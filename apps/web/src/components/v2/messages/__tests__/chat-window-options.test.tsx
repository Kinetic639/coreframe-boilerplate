import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWindowOptions } from "../chat-window-options";

const push = vi.fn();
const muteMock = vi.fn();
const leaveMock = vi.fn();
const removeAvatarMock = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name?: string }) =>
    values?.name ? `${key}:${values.name}` : key,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/messages", () => ({
  muteConversationAction: (input: unknown) => muteMock(input),
  leaveConversationAction: (input: unknown) => leaveMock(input),
  removeGroupAvatarAction: (input: unknown) => removeAvatarMock(input),
  setGroupAvatarAction: vi.fn(),
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/queries/messages", () => ({
  messagesKeys: {
    conversations: (orgId: string) => ["messages", "conversations", orgId],
    conversation: (id: string) => ["messages", "conversation", id],
  },
}));
vi.mock("../chat-provider", () => ({ useChat: () => ({ orgId: "o1" }) }));

function renderOptions(props: Partial<React.ComponentProps<typeof ChatWindowOptions>> = {}) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatWindowOptions
        conversationId="c1"
        isGroup={false}
        groupName=""
        muted={false}
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>
  );
  // Radix opens the menu from the keyboard (pointer events are not simulated in jsdom)
  fireEvent.keyDown(screen.getByRole("button", { name: "window.options" }), { key: "Enter" });
  return { onClose };
}

describe("ChatWindowOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    muteMock.mockResolvedValue({ success: true, data: null });
    leaveMock.mockResolvedValue({ success: true, data: null });
    removeAvatarMock.mockResolvedValue({ success: true, data: null });
  });

  it("1:1: open in full view, mute, close — no group options", async () => {
    const { onClose } = renderOptions();
    expect(await screen.findByRole("menuitem", { name: "window.openFull" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "page.leave" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "window.manageGroup" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "page.mute" }));
    await waitFor(() =>
      expect(muteMock).toHaveBeenCalledWith({
        conversationId: "c1",
        until: "2100-01-01T00:00:00.000Z",
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a muted conversation offers unmuting", async () => {
    renderOptions({ muted: true });
    fireEvent.click(await screen.findByRole("menuitem", { name: "page.unmute" }));
    await waitFor(() =>
      expect(muteMock).toHaveBeenCalledWith({ conversationId: "c1", until: null })
    );
  });

  it("group: leaving asks first, then leaves and closes the window", async () => {
    const { onClose } = renderOptions({ isGroup: true, groupName: "Magazyn CNP" });
    expect(await screen.findByRole("menuitem", { name: "window.manageGroup" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "page.leave" }));
    expect(leaveMock).not.toHaveBeenCalled();
    expect(await screen.findByText("page.confirmLeave:Magazyn CNP")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "page.leave" }));
    await waitFor(() => expect(leaveMock).toHaveBeenCalledWith({ conversationId: "c1" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("opens the Messages page on the conversation", async () => {
    renderOptions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "window.openFull" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/dashboard/messages", query: { c: "c1" } });
  });

  it("group photo: hidden from members who do not manage the group", async () => {
    renderOptions({ isGroup: true, groupName: "Magazyn" });
    await screen.findByRole("menuitem", { name: "window.manageGroup" });
    expect(screen.queryByRole("menuitem", { name: "page.addPhoto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "page.removePhoto" })).not.toBeInTheDocument();
  });

  it("group photo: the owner can add one, or change and remove it", async () => {
    renderOptions({ isGroup: true, groupName: "Magazyn", canManage: true, hasPhoto: true });
    expect(await screen.findByRole("menuitem", { name: "page.changePhoto" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "page.removePhoto" }));
    await waitFor(() => expect(removeAvatarMock).toHaveBeenCalledWith({ conversationId: "c1" }));
  });
});
