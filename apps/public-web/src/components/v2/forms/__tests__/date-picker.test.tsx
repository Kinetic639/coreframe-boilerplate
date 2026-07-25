import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FormWrapper } from "../form-wrapper";
import { DatePicker } from "../date-picker";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
    disabled,
  }: {
    onSelect?: (date?: Date) => void;
    disabled?: (date: Date) => boolean;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect?.(new Date("2026-04-01T00:00:00.000Z"))}>
        pick-date
      </button>
      <span data-testid="disabled-before-min">
        {disabled?.(new Date("2026-03-01T00:00:00.000Z")) ? "true" : "false"}
      </span>
      <span data-testid="disabled-after-max">
        {disabled?.(new Date("2026-05-01T00:00:00.000Z")) ? "true" : "false"}
      </span>
    </div>
  ),
}));

const schema = z.object({
  dueDate: z.string().min(1, "Date is required"),
});

describe("DatePicker", () => {
  it("renders label, description, and placeholder", () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <DatePicker
          name="dueDate"
          label="Due Date"
          description="Choose a deadline"
          placeholder="Pick when this is due"
        />
      </FormWrapper>
    );

    expect(screen.getByText("Choose a deadline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pick when this is due/i })).toBeInTheDocument();
  });

  it("applies min/max date disabling rules", () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <DatePicker
          name="dueDate"
          label="Due Date"
          minDate={new Date("2026-03-15T00:00:00.000Z")}
          maxDate={new Date("2026-04-15T00:00:00.000Z")}
        />
      </FormWrapper>
    );

    expect(screen.getByTestId("disabled-before-min")).toHaveTextContent("true");
    expect(screen.getByTestId("disabled-after-max")).toHaveTextContent("true");
  });

  it("shows validation error when required date is missing", async () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <DatePicker name="dueDate" label="Due Date" />
      </FormWrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Required")).toBeInTheDocument();
  });
});
