import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderSearch } from "../header-search";

const pushMock = vi.fn();
const useAppStoreV2Mock = vi.fn();

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
    }),
  };
});

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: () => useAppStoreV2Mock(),
}));

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="command-dialog">
        <button onClick={() => onOpenChange(false)}>Close</button>
        {children}
      </div>
    ) : null,
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input aria-label="Command input" placeholder={placeholder} />
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

describe("HeaderSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStoreV2Mock.mockReturnValue({
      userModules: [
        { id: "warehouse", label: "Warehouse", slug: "warehouse" },
        { id: "tools", label: "Tools", slug: "tools" },
      ],
    });
    Object.defineProperty(window.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
  });

  it("renders desktop and mobile search buttons with Mac shortcut text", () => {
    render(<HeaderSearch />);

    expect(screen.getByLabelText("Search (⌘K)")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("uses Ctrl+K label on non-Mac platforms", async () => {
    Object.defineProperty(window.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });

    render(<HeaderSearch />);

    expect(await screen.findByLabelText("Search (Ctrl+K)")).toBeInTheDocument();
  });

  it("opens the command dialog from keyboard shortcut and navigates on selection", async () => {
    render(<HeaderSearch />);

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(await screen.findByTestId("command-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /warehouse/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/warehouse");
    expect(screen.queryByTestId("command-dialog")).not.toBeInTheDocument();
  });

  it("opens the command dialog from the button and shows available navigation items", async () => {
    render(<HeaderSearch />);

    fireEvent.click(screen.getByLabelText("Search (⌘K)"));

    expect(await screen.findByText("Navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /warehouse/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command or search...")).toBeInTheDocument();
  });
});
