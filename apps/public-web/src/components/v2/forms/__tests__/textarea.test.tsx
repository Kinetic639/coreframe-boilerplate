import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FormWrapper } from "../form-wrapper";
import { Textarea } from "../textarea";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const schema = z.object({
  notes: z.string().min(5, "Notes must be at least 5 characters"),
});

describe("Textarea", () => {
  it("renders label, description, and required indicator", () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Textarea
          name="notes"
          label="Notes"
          description="Add context for your teammates"
          required
        />
      </FormWrapper>
    );

    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
    expect(screen.getByText("Add context for your teammates")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows character count when maxLength is provided", async () => {
    const user = userEvent.setup();

    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Textarea name="notes" label="Notes" maxLength={50} />
      </FormWrapper>
    );

    const input = screen.getByLabelText(/Notes/);
    await user.type(input, "hello world");

    expect(screen.getByText("11/50")).toBeInTheDocument();
  });

  it("displays validation errors", async () => {
    const user = userEvent.setup();

    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Textarea name="notes" label="Notes" />
      </FormWrapper>
    );

    await user.type(screen.getByLabelText(/Notes/), "bad");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Notes must be at least 5 characters")).toBeInTheDocument();
  });
});
