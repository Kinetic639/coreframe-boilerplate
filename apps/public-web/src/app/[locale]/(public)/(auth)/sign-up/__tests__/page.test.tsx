import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/forms/sign-up-form", () => ({
  SignUpForm: ({ message, invitationToken }: { message?: unknown; invitationToken?: string }) => (
    <div>{JSON.stringify({ message, invitationToken })}</div>
  ),
}));

vi.mock("@/components/form-message", () => ({
  FormMessage: ({ message }: { message: unknown }) => <div>{JSON.stringify(message)}</div>,
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

import Signup from "../page";

describe("SignUp page", () => {
  it("renders message-only branch", async () => {
    const page = await Signup({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ message: "done" }),
    });

    render(page);

    expect(screen.getByText('{"message":"done"}')).toBeInTheDocument();
  });

  it("renders signup form and smtp message", async () => {
    const page = await Signup({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ message: "", invitation: "invite-1" }),
    });

    render(page);

    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
    expect(
      screen.getByText('{"message":{"invitation":"invite-1"},"invitationToken":"invite-1"}')
    ).toBeInTheDocument();
    expect(screen.getByText("smtp message")).toBeInTheDocument();
  });
});
