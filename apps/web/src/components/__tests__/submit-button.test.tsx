import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-dom", () => ({
  useFormStatus: vi.fn(),
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}));

import { SubmitButton } from "../submit-button";
import { useFormStatus } from "react-dom";

describe("SubmitButton", () => {
  it("renders children when not pending", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false } as never);

    render(<SubmitButton>Save</SubmitButton>);

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });

  it("renders pending text and disables the button while pending", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: true } as never);

    render(<SubmitButton pendingText="Saving...">Save</SubmitButton>);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("respects the explicit disabled prop", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false } as never);

    render(<SubmitButton disabled>Save</SubmitButton>);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
