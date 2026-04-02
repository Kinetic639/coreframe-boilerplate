import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/v2/utility/avatar", () => ({
  Avatar: ({ alt, fallback }: any) => <div>{alt ?? fallback}</div>,
}));

vi.mock("@/components/v2/feedback/loading-skeleton", () => ({
  LoadingSkeleton: () => <div data-testid="loading-skeleton" />,
}));

import { HeaderMessages } from "../header-messages";

describe("HeaderMessages", () => {
  it("renders unread summary and marks one message as read", () => {
    render(<HeaderMessages />);

    expect(screen.getByLabelText("Messages (3 unread)")).toBeInTheDocument();
    expect(screen.getByText("You have 3 unread messages")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Mark as read")[0]);

    expect(screen.getByText("You have 2 unread messages")).toBeInTheDocument();
    expect(screen.queryAllByText("Mark as read")).toHaveLength(2);
  });

  it("marks all messages as read and clears the unread badge", () => {
    render(<HeaderMessages />);

    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));

    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    expect(screen.getByLabelText(/messages/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
  });

  it("removes every message and shows the empty state", () => {
    render(<HeaderMessages />);

    for (const button of screen.getAllByRole("button", { name: /remove message/i })) {
      fireEvent.click(button);
    }

    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
