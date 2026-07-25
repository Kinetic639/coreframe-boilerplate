import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickSwitcher } from "../quick-switcher";

const pushMock = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="quick-switcher-dialog">{children}</div> : null,
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input aria-label="Quick switcher input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: { heading?: string; children: React.ReactNode }) => (
    <section>
      {heading ? <h2>{heading}</h2> : null}
      {children}
    </section>
  ),
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

describe("QuickSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens on keyboard shortcut and navigates for href actions", async () => {
    render(<QuickSwitcher />);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(await screen.findByTestId("quick-switcher-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/start");
    expect(screen.queryByTestId("quick-switcher-dialog")).not.toBeInTheDocument();
  });

  it("runs custom actions instead of navigating", async () => {
    const actionMock = vi.fn();

    render(
      <QuickSwitcher
        actions={[
          {
            id: "custom",
            label: "Run Custom Action",
            description: "Do something special",
            action: actionMock,
          },
        ]}
      />
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.click(await screen.findByRole("button", { name: /run custom action/i }));

    expect(actionMock).toHaveBeenCalledOnce();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders custom placeholder and descriptions", async () => {
    render(
      <QuickSwitcher
        actions={[
          {
            id: "settings",
            label: "Settings",
            description: "Manage account settings",
            href: "/dashboard/account/preferences",
          },
        ]}
        placeholder="Jump anywhere..."
      />
    );

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(await screen.findByPlaceholderText("Jump anywhere...")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Manage account settings")).toBeInTheDocument();
  });
});
