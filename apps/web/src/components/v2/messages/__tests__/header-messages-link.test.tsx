import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderMessagesLink } from "../header-messages-link";

const chat = vi.hoisted(() => ({ value: null as { orgId: string } | null }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../chat-provider", () => ({ useOptionalChat: () => chat.value }));
vi.mock("@/hooks/queries/messages", () => ({
  useConversations: () => ({
    data: [
      { id: "a", unread_count: 2, muted: false },
      { id: "b", unread_count: 1, muted: true },
      { id: "c", unread_count: 0, muted: false },
    ],
  }),
}));

describe("HeaderMessagesLink", () => {
  it("renders nothing without access to messages", () => {
    chat.value = null;
    const { container } = render(<HeaderMessagesLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the Messages page with the unread conversations count, hidden from lg up", () => {
    chat.value = { orgId: "o1" };
    render(<HeaderMessagesLink />);
    const link = screen.getByTestId("header-messages-link");
    expect(link).toHaveAttribute("href", "/dashboard/messages");
    expect(link).toHaveTextContent("1");
    expect(link.className).toContain("lg:hidden");
  });
});
