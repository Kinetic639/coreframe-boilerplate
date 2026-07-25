import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "../confirmation-dialog";

const AlertDialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
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
    return (
      <AlertDialogContext.Provider value={{ open, setOpen }}>
        {children}
      </AlertDialogContext.Provider>
    );
  },
  AlertDialogTrigger: ({
    children,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>;
  }) => {
    const context = useContext(AlertDialogContext);
    if (!context) return children;
    return React.cloneElement(children, {
      ...children.props,
      onClick: () => context.setOpen(true),
    });
  },
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => {
    const context = useContext(AlertDialogContext);
    return context?.open ? <div data-testid="confirmation-dialog">{children}</div> : null;
  },
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

describe("ConfirmationDialog", () => {
  it("opens and confirms destructive actions", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmationDialog
        title="Delete item"
        description="This action cannot be undone"
        variant="destructive"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(screen.getByTestId("confirmation-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete item")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /confirm/i })[1]!);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument()
    );
  });

  it("renders custom trigger, children, and cancel callback", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        title="Archive"
        description="Archive this item?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        trigger={<span>Open Archive Dialog</span>}
      >
        <div>Extra content</div>
      </ConfirmationDialog>
    );

    fireEvent.click(screen.getByText("Open Archive Dialog"));
    expect(screen.getByText("Extra content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows processing state when confirm is pending", async () => {
    let resolvePromise: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(<ConfirmationDialog title="Save" description="Apply changes" onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /confirm/i })[1]!);

    expect(await screen.findByRole("button", { name: /processing/i })).toBeDisabled();
    resolvePromise?.();
    await waitFor(() =>
      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument()
    );
  });
});
