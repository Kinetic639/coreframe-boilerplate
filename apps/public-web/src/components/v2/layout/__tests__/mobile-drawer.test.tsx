import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MobileDrawer } from "../mobile-drawer";

const SheetContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(
  null
);

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    children,
    open: controlledOpen,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = (nextOpen: boolean) => {
      setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    };
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
  SheetContent: ({
    children,
    side,
    className,
  }: {
    children: React.ReactNode;
    side?: string;
    className?: string;
  }) => {
    const context = useContext(SheetContext);
    return context?.open ? (
      <div data-testid="mobile-drawer-content" data-side={side} className={className}>
        {children}
      </div>
    ) : null;
  },
}));

describe("MobileDrawer", () => {
  it("renders the default trigger and opens drawer content", () => {
    render(<MobileDrawer>Drawer Content</MobileDrawer>);

    fireEvent.click(screen.getByText("Toggle navigation menu"));

    expect(screen.getByTestId("mobile-drawer-content")).toHaveAttribute("data-side", "left");
    expect(screen.getByText("Drawer Content")).toBeInTheDocument();
  });

  it("uses a custom trigger and custom side/className", () => {
    render(
      <MobileDrawer
        trigger={<span>Open Custom Drawer</span>}
        side="right"
        className="custom-drawer"
      >
        Custom Content
      </MobileDrawer>
    );

    fireEvent.click(screen.getByText("Open Custom Drawer"));

    expect(screen.getByTestId("mobile-drawer-content")).toHaveAttribute("data-side", "right");
    expect(screen.getByTestId("mobile-drawer-content")).toHaveClass(
      "w-[300px]",
      "sm:w-[400px]",
      "p-0",
      "custom-drawer"
    );
  });
});
