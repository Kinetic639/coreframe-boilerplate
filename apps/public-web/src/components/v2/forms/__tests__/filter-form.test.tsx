import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FilterForm } from "../filter-form";

const SheetContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(
  null
);
const formWrapperSpy = vi.fn();

vi.mock("../form-wrapper", () => ({
  FormWrapper: ({
    children,
    onSubmit,
    submitLabel,
    resetLabel,
  }: {
    children: React.ReactNode;
    onSubmit: (data: { search: string }) => void;
    submitLabel?: string;
    resetLabel?: string;
  }) => {
    formWrapperSpy({ submitLabel, resetLabel });
    return (
      <div>
        {children}
        <button type="button" onClick={() => onSubmit({ search: "widget" })}>
          mock-submit
        </button>
      </div>
    );
  },
}));

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
  SheetContent: ({ children }: { children: React.ReactNode }) => {
    const context = useContext(SheetContext);
    return context?.open ? <div data-testid="filter-sheet">{children}</div> : null;
  },
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const schema = z.object({
  search: z.string(),
});

describe("FilterForm", () => {
  it("renders the default trigger with active filter badge", () => {
    render(
      <FilterForm schema={schema} onApply={vi.fn()} activeFiltersCount={3}>
        <div>Filters body</div>
      </FilterForm>
    );

    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens the sheet and applies filters through the form wrapper", () => {
    const onApply = vi.fn();

    render(
      <FilterForm schema={schema} onApply={onApply}>
        <div>Filters body</div>
      </FilterForm>
    );

    fireEvent.click(screen.getByText("Filters"));
    expect(screen.getByTestId("filter-sheet")).toBeInTheDocument();
    expect(screen.getByText("Apply filters to narrow down your results")).toBeInTheDocument();

    fireEvent.click(screen.getByText("mock-submit"));
    expect(onApply).toHaveBeenCalledWith({ search: "widget" });
    expect(screen.queryByTestId("filter-sheet")).not.toBeInTheDocument();
    expect(formWrapperSpy).toHaveBeenCalledWith(
      expect.objectContaining({ submitLabel: "Apply Filters", resetLabel: "Clear All" })
    );
  });

  it("supports custom trigger and clear action", () => {
    const onClear = vi.fn();

    render(
      <FilterForm
        schema={schema}
        onApply={vi.fn()}
        onClear={onClear}
        activeFiltersCount={2}
        trigger={<span>Open Filters</span>}
      >
        <div>Filters body</div>
      </FilterForm>
    );

    fireEvent.click(screen.getByText("Open Filters"));
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("filter-sheet")).not.toBeInTheDocument();
  });
});
