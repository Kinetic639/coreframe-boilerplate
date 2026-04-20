import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { resetPasswordActionMock } = vi.hoisted(() => ({
  resetPasswordActionMock: vi.fn(),
}));

vi.mock("@/app/[locale]/actions", () => ({
  resetPasswordAction: resetPasswordActionMock,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}));

vi.mock("@/components/auth/password-strength", () => ({
  PasswordStrength: ({ password }: { password: string }) => (
    <div data-testid="password-strength">{password}</div>
  ),
}));

import { ResetPasswordForm } from "../reset-password-form";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    resetPasswordActionMock.mockReset();
  });

  it("renders set-password mode copy and toggles password visibility", () => {
    render(<ResetPasswordForm mode="set" />);

    expect(screen.getByText("setTitle")).toBeInTheDocument();
    expect(screen.getByText("setDescription")).toBeInTheDocument();

    const passwordInput = screen.getByLabelText("passwordLabel");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("shows validation errors for mismatched passwords", async () => {
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText("passwordLabel"), {
      target: { value: "Password1" },
    });
    fireEvent.change(screen.getByLabelText("confirmPasswordLabel"), {
      target: { value: "Password2" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(resetPasswordActionMock).not.toHaveBeenCalled();
  });

  it("submits matching passwords and renders the message and strength indicator", async () => {
    resetPasswordActionMock.mockResolvedValue(undefined);
    render(<ResetPasswordForm message={{ success: "Updated" }} />);

    fireEvent.change(screen.getByLabelText("passwordLabel"), {
      target: { value: "Password1" },
    });
    fireEvent.change(screen.getByLabelText("confirmPasswordLabel"), {
      target: { value: "Password1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => {
      expect(resetPasswordActionMock).toHaveBeenCalledOnce();
    });

    const formData = resetPasswordActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("password")).toBe("Password1");
    expect(formData.get("confirmPassword")).toBe("Password1");
    expect(screen.getByTestId("password-strength")).toHaveTextContent("Password1");
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });
});
