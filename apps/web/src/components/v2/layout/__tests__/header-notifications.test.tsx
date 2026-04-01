import { fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it } from "vitest";
import { HeaderNotifications } from "../header-notifications";

const SheetContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(
  null
);

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
  },
  SheetTrigger: ({ children }: { children: React.ReactElement }) => {
    const context = useContext(SheetContext);
    if (!context) return children;
    return (
      <button type="button" onClick={() => context.setOpen(true)}>
        {children}
      </button>
    );
  },
  SheetContent: ({ children }: { children: React.ReactNode }) => {
    const context = useContext(SheetContext);
    return context?.open ? <div data-testid="notifications-sheet">{children}</div> : null;
  },
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("HeaderNotifications", () => {
  const openDrawer = () => {
    render(<HeaderNotifications />);
    fireEvent.click(screen.getByLabelText("Notifications (3 unread)"));
  };

  it("shows unread count and initial notifications", async () => {
    openDrawer();

    expect(await screen.findByTestId("notifications-sheet")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("You have 3 unread notifications")).toBeInTheDocument();
    expect(screen.getByText("System Update")).toBeInTheDocument();
    expect(screen.getByText("Team Invitation")).toBeInTheDocument();
  });

  it("marks a single notification as read", async () => {
    openDrawer();

    fireEvent.click(
      await screen.findAllByRole("button", { name: "Mark as read" }).then((buttons) => buttons[0]!)
    );

    expect(screen.getByText("You have 2 unread notifications")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark as read" })).toHaveLength(2);
  });

  it("marks all notifications as read", async () => {
    openDrawer();

    fireEvent.click(await screen.findByRole("button", { name: /mark all as read/i }));

    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
  });

  it("removes notifications and can reach the empty state", async () => {
    openDrawer();

    for (let index = 0; index < 5; index += 1) {
      const removeButtons = await screen.findAllByRole("button", { name: "Remove notification" });
      fireEvent.click(removeButtons[0]!);
    }

    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("renders color-coded notification actions in the list", async () => {
    openDrawer();

    const notificationList = await screen.findByTestId("notifications-sheet");
    const warningCard = within(notificationList).getByText("Low Stock Alert").closest("div");

    expect(within(notificationList).getByText("Report Generated")).toBeInTheDocument();
    expect(warningCard).toBeInTheDocument();
  });
});
