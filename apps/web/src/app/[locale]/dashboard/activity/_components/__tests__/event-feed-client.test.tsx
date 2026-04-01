import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

vi.mock("@/components/audit/event-icons", () => ({
  EventCategoryIcon: ({ category }: { category: string }) => <span>{`category:${category}`}</span>,
  EventIntentIcon: ({ intent }: { intent: string }) => <span>{`intent:${intent}`}</span>,
}));

vi.mock("@/lib/audit/event-visual-model", () => ({
  INTENT_LABEL_MAP: {
    create: "Created",
    update: "Updated",
  },
}));

import { EventFeedClient } from "../event-feed-client";

const baseEvent = {
  id: "evt-1",
  created_at: "2026-03-01T12:30:00Z",
  category: "members",
  event_tier: "enhanced",
  intent: "create",
  action_key: "members.created",
  summary: "Member created",
  ip_address: "127.0.0.1",
  user_agent: "Vitest Browser",
} as never;

describe("EventFeedClient", () => {
  it("renders an empty state for the first page with no events", () => {
    render(
      <EventFeedClient
        events={[]}
        total={0}
        limit={20}
        offset={0}
        scope="personal"
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders event content and audit metadata", () => {
    render(
      <EventFeedClient
        events={[baseEvent]}
        total={1}
        limit={20}
        offset={0}
        scope="audit"
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("Member created")).toBeInTheDocument();
    expect(screen.getByText("category:members")).toBeInTheDocument();
    expect(screen.getByText("intent:create")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("members.created")).toBeInTheDocument();
    expect(screen.getByText(/ip: 127.0.0.1/i)).toBeInTheDocument();
    expect(screen.getByText(/ua: Vitest Browser/i)).toBeInTheDocument();
  });

  it("renders pagination controls and requests page changes", () => {
    const onPageChange = vi.fn();

    render(
      <EventFeedClient
        events={[baseEvent]}
        total={25}
        limit={10}
        offset={10}
        scope="org"
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText(/pagination:/i)).toBeInTheDocument();
    expect(screen.getByText(/pageOf:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 0);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 20);
  });
});
