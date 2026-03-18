import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { FormWrapper } from "../form-wrapper";
import { describe, it, expect, vi } from "vitest";
import { useFormContext } from "react-hook-form";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const testSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

// Test component that uses the form context
function TestFormField({ name }: { name: string }) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div>
      <label htmlFor={name}>{name}</label>
      <input id={name} {...register(name)} />
      {errors[name] && <p className="text-red-600">{errors[name]?.message as string}</p>}
    </div>
  );
}

describe("FormWrapper", () => {
  it("renders children and form elements", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <div>Test Form</div>
      </FormWrapper>
    );

    expect(screen.getByText("Test Form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("validates with Zod schema on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TestFormField name="email" />
        <TestFormField name="password" />
      </FormWrapper>
    );

    // Submit with empty fields
    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });

    // onSubmit should not be called with invalid data
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays field-level errors correctly", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TestFormField name="email" />
        <TestFormField name="password" />
      </FormWrapper>
    );

    const emailInput = screen.getByLabelText("email");
    const passwordInput = screen.getByLabelText("password");

    // Enter invalid email
    await user.type(emailInput, "invalid-email");
    await user.type(passwordInput, "short");

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    // Should show both field errors
    await waitFor(() => {
      expect(screen.getByText("Invalid email")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
    });
  });

  it("disables submit button during loading state", async () => {
    const onSubmit = vi.fn();

    const { rerender } = render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit} loading={false}>
        <div>Test</div>
      </FormWrapper>
    );

    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).not.toBeDisabled();

    // Rerender with loading state
    rerender(
      <FormWrapper schema={testSchema} onSubmit={onSubmit} loading={true}>
        <div>Test</div>
      </FormWrapper>
    );

    expect(submitButton).toBeDisabled();
  });

  it("calls onSuccess with validated data on successful submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit} onSuccess={onSuccess}>
        <TestFormField name="email" />
        <TestFormField name="password" />
      </FormWrapper>
    );

    const emailInput = screen.getByLabelText("email");
    const passwordInput = screen.getByLabelText("password");

    // Enter valid data
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    // Should call onSubmit and onSuccess with validated data
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(onSuccess).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("calls onError when submit fails", async () => {
    const user = userEvent.setup();
    const error = new Error("Submit failed");
    const onSubmit = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit} onError={onError}>
        <TestFormField name="email" />
        <TestFormField name="password" />
      </FormWrapper>
    );

    const emailInput = screen.getByLabelText("email");
    const passwordInput = screen.getByLabelText("password");

    // Enter valid data
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    // Should call onError
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
