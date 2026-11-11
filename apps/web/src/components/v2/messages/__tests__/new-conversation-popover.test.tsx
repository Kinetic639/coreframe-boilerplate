import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewConversationPopover } from "../new-conversation-popover";

const openDirect = vi.fn();
const createGroup = vi.fn();
const toastSuccess = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count !== undefined ? `${key}:${values.count}` : key,
}));
vi.mock("react-toastify", () => ({
  toast: { success: (text: string) => toastSuccess(text), error: vi.fn() },
}));
vi.mock("@/app/actions/messages", () => ({
  openDirectConversationAction: (input: unknown) => openDirect(input),
  createGroupConversationAction: (input: unknown) => createGroup(input),
}));
vi.mock("@/hooks/queries/messages", () => ({
  messagesKeys: { conversations: () => ["conversations"] },
  useChatPeople: () => ({
    isLoading: false,
    data: [
      {
        userId: "u-zofia",
        firstName: "Zofia",
        lastName: "Kowalska",
        email: "z@x.test",
        avatarUrl: null,
      },
      {
        userId: "u-anna",
        firstName: "Anna",
        lastName: "Nowak",
        email: "a@x.test",
        avatarUrl: null,
      },
      {
        userId: "u-jan",
        firstName: "Jan",
        lastName: "Kowalski",
        email: "j@x.test",
        avatarUrl: null,
      },
    ],
  }),
}));
vi.mock("../chat-provider", () => ({ useChat: () => ({ orgId: "o1", onlineIds: new Set() }) }));

function setup() {
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewConversationPopover onCreated={onCreated}>
        <button type="button">open</button>
      </NewConversationPopover>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));
  return { onCreated, search: screen.getByRole("combobox") };
}

describe("NewConversationPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    openDirect.mockResolvedValue({ success: true, data: "c-direct" });
    createGroup.mockResolvedValue({ success: true, data: "c-group" });
  });

  it("starts as a private message: people by name, no checkboxes, the first one highlighted", () => {
    setup();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "ANAnna Nowaka@x.testEnter",
      "JKJan Kowalskij@x.test",
      "ZKZofia Kowalskaz@x.test",
    ]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-multiselectable", "true");
    expect(screen.queryByRole("button", { name: "newConversation.sendInvites" })).toBeNull();
  });

  it("arrows move the highlight and Enter opens the 1:1 with that person", async () => {
    const { onCreated, search } = setup();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("c-direct"));
    expect(openDirect).toHaveBeenCalledWith({ userId: "u-jan" });
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("typing narrows the list; a click opens the conversation at once", async () => {
    const { onCreated, search } = setup();
    fireEvent.change(search, { target: { value: "zof" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("c-direct"));
    expect(openDirect).toHaveBeenCalledWith({ userId: "u-zofia" });
  });

  it('"create a group" shows checkboxes; people are invited, not added', async () => {
    const { onCreated } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "newConversation.modeGroup" }));
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByText("newConversation.groupHint")).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "newConversation.sendInvites" });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getAllByRole("option")[2]);
    // Picking people opens no conversation
    expect(openDirect).not.toHaveBeenCalled();
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "newConversation.groupName" }), {
      target: { value: " Magazyn " },
    });
    fireEvent.click(send);

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("c-group"));
    expect(createGroup).toHaveBeenCalledWith({ name: "Magazyn", userIds: ["u-anna", "u-zofia"] });
    expect(toastSuccess).toHaveBeenCalledWith("newConversation.invitesSent:2");
  });

  it("switching back to a person drops the selection and the group fields", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "newConversation.modeGroup" }));
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(screen.getByText("newConversation.selected:1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "newConversation.modeDirect" }));
    expect(screen.queryByRole("textbox", { name: "newConversation.groupName" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "newConversation.modeGroup" }));
    expect(screen.queryByText("newConversation.selected:1")).toBeNull();
    expect(screen.getByText("newConversation.pickPeople")).toBeInTheDocument();
  });
});
