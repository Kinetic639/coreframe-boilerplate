import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInForm } from "../sign-in-form";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/[locale]/actions", () => ({
  signInAction: vi.fn(),
}));

vi.mock("../AuthCard", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ children, pendingText, ...props }: any) => (
    <button {...props} data-pending-text={pendingText}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/form-message", () => ({
  FormMessage: ({ message }: { message: { message: string } }) => <div>{message.message}</div>,
}));

describe("SignInForm", () => {
  it("renders fields, links, and return url", () => {
    render(<SignInForm returnUrl="/dashboard/start" message={{ message: "Signed out" }} />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByLabelText("emailLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("passwordLabel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/dashboard/start")).toHaveAttribute("type", "hidden");
    expect(screen.getByRole("link", { name: "signUp" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "forgotPassword" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });
});
