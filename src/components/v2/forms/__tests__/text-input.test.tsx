import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { FormWrapper } from "../form-wrapper";
import { TextInput } from "../text-input";
import { describe, it, expect, vi } from "vitest";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const testSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Username must be at least 3 characters"),
});

describe("TextInput", () => {
  it("renders with label and placeholder", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput name="username" label="Username" placeholder="Enter username" />
      </FormWrapper>
    );

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
  });

  it("displays validation error message", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput name="email" label="Email" />
      </FormWrapper>
    );

    const input = screen.getByLabelText("Email");
    await user.type(input, "invalid-email");

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    expect(await screen.findByText("Invalid email")).toBeInTheDocument();
  });

  it("renders with description", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput name="username" label="Username" description="Choose a unique username" />
      </FormWrapper>
    );

    expect(screen.getByText("Choose a unique username")).toBeInTheDocument();
  });

  it("supports different input types", () => {
    const onSubmit = vi.fn();
    const schema = z.object({ password: z.string() });

    render(
      <FormWrapper schema={schema} onSubmit={onSubmit}>
        <TextInput name="password" label="Password" type="password" />
      </FormWrapper>
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
  });

  it("renders as disabled when disabled prop is true", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput name="username" label="Username" disabled />
      </FormWrapper>
    );

    const input = screen.getByLabelText("Username");
    expect(input).toBeDisabled();
  });

  it("shows required indicator when required prop is true", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput name="username" label="Username" required />
      </FormWrapper>
    );

    expect(screen.getByText(/username/i)).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders prefix and suffix elements", () => {
    const onSubmit = vi.fn();

    render(
      <FormWrapper schema={testSchema} onSubmit={onSubmit}>
        <TextInput
          name="username"
          label="Username"
          prefix={<span>@</span>}
          suffix={<span>.com</span>}
        />
      </FormWrapper>
    );

    expect(screen.getByText("@")).toBeInTheDocument();
    expect(screen.getByText(".com")).toBeInTheDocument();
  });
});
