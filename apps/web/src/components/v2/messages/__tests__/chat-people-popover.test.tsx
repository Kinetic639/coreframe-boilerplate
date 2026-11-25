import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMemberProfile } from "@/lib/messages/types";
import { ChatPeoplePopover } from "../chat-people-popover";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../chat-provider", () => ({
  useChat: () => ({ meId: "me", onlineIds: new Set(["u2"]) }),
}));

function person(userId: string, firstName: string): ChatMemberProfile {
  return {
    user_id: userId,
    first_name: firstName,
    last_name: null,
    email: null,
    avatar_url: null,
    role: "member",
    last_read_at: "2026-11-25T10:00:00Z",
  };
}

const people = [person("me", "Michał"), person("u1", "Anna"), person("u2", "Zenon")];

describe("ChatPeoplePopover", () => {
  it("opens on tap / click and lists people with their status, online first", async () => {
    render(
      <ChatPeoplePopover people={people} title="window.membersList" showStatus>
        3 osoby
      </ChatPeoplePopover>
    );
    expect(screen.queryByTestId("chat-people-popover")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3 osoby" }));

    const list = await screen.findByTestId("chat-people-popover");
    expect(list).toHaveTextContent("window.membersList");
    const names = Array.from(list.querySelectorAll("li")).map((li) => li.textContent);
    // Initials (avatar), name, status
    expect(names).toEqual([
      "ZZenonwindow.online",
      "AAnnawindow.offline",
      "MMichał (window.you)window.offline",
    ]);
  });

  it("readers: names only, and a text when nobody is listed", async () => {
    const { unmount } = render(
      <ChatPeoplePopover people={[person("u1", "Anna")]} title="window.readByList">
        Przeczytane przez 1
      </ChatPeoplePopover>
    );
    fireEvent.click(screen.getByRole("button", { name: "Przeczytane przez 1" }));
    const list = await screen.findByTestId("chat-people-popover");
    expect(list).toHaveTextContent("Anna");
    expect(list).not.toHaveTextContent("window.offline");
    unmount();

    render(
      <ChatPeoplePopover people={[]} title="window.readByList" emptyText="window.noReaders">
        0
      </ChatPeoplePopover>
    );
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    expect(await screen.findByText("window.noReaders")).toBeInTheDocument();
  });
});
