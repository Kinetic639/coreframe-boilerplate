import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FormWrapper } from "../form-wrapper";
import { Select } from "../select";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    defaultValue,
    disabled,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    defaultValue?: string;
    disabled?: boolean;
  }) => (
    <div data-value={defaultValue} data-disabled={disabled ? "true" : "false"}>
      {typeof children === "function" ? children({ onValueChange }) : children}
      <button type="button" onClick={() => onValueChange?.("admin")}>
        choose-admin
      </button>
    </div>
  ),
  SelectTrigger: ({
    id,
    className,
    children,
  }: {
    id?: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <button type="button" id={id} className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    disabled?: boolean;
  }) => (
    <div data-value={value} data-disabled={disabled ? "true" : "false"}>
      {children}
    </div>
  ),
}));

const schema = z.object({
  role: z.string().min(1, "Role is required"),
});

describe("Select", () => {
  it("renders label, description, placeholder, and options", () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Select
          name="role"
          label="Role"
          description="Choose the account role"
          placeholder="Pick a role"
          options={[
            { value: "admin", label: "Admin" },
            { value: "viewer", label: "Viewer", disabled: true },
          ]}
        />
      </FormWrapper>
    );

    expect(screen.getByText("Choose the account role")).toBeInTheDocument();
    expect(screen.getByText("Pick a role")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Viewer").closest("div")).toHaveAttribute("data-disabled", "true");
  });

  it("supports required indicator and disabled state", () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Select
          name="role"
          label="Role"
          required
          disabled
          options={[{ value: "admin", label: "Admin" }]}
        />
      </FormWrapper>
    );

    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("choose-admin").parentElement).toHaveAttribute("data-disabled", "true");
  });

  it("shows validation styling after submit when field is empty", async () => {
    render(
      <FormWrapper schema={schema} onSubmit={vi.fn()}>
        <Select name="role" label="Role" options={[{ value: "admin", label: "Admin" }]} />
      </FormWrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Role" })).toHaveClass("border-red-600");
  });
});
