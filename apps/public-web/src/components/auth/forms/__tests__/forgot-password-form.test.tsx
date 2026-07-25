import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { replaceMock, forgotPasswordActionMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  forgotPasswordActionMock: vi.fn(),
}));

vi.mock("@/app/[locale]/actions", () => ({
  forgotPasswordAction: forgotPasswordActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ForgotPasswordForm } from "../forgot-password-form";

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    forgotPasswordActionMock.mockReset();
    window.history.replaceState({}, "", "/forgot-password?message=old");
  });

  it("shows validation errors for an invalid email address", async () => {
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("emailLabel"), { target: { value: "not-an-email" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
    expect(forgotPasswordActionMock).not.toHaveBeenCalled();
  });

  it("replaces the current URL and submits the email", async () => {
    forgotPasswordActionMock.mockResolvedValue(undefined);
    render(<ForgotPasswordForm message={{ success: "Saved" }} />);

    fireEvent.change(screen.getByLabelText("emailLabel"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/forgot-password");
    });

    const formData = forgotPasswordActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("email")).toBe("user@example.com");
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
