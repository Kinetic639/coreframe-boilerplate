import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/forms/forgot-password-form", () => ({
  ForgotPasswordForm: ({ message }: { message: unknown }) => <div>{JSON.stringify(message)}</div>,
}));

vi.mock("@/components/auth/AuthCard", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-card">{children}</div>
  ),
}));

vi.mock("../../smtp-message", () => ({
  SmtpMessage: () => <div>smtp message</div>,
}));

vi.mock("@/lib/metadata", () => ({
  generatePageMetadata: vi.fn(),
}));

import ForgotPassword from "../page";

describe("ForgotPassword page", () => {
  it("renders forgot password form inside auth card and smtp message", async () => {
    const page = await ForgotPassword({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ message: "reset sent" }),
    });

    render(page);

    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
    expect(screen.getByText('{"message":"reset sent"}')).toBeInTheDocument();
    expect(screen.getByText("smtp message")).toBeInTheDocument();
  });
});
