import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockRedirect, mockGetLocale } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRedirect: vi.fn(),
  mockGetLocale: vi.fn(),
}));

vi.mock("@/components/auth/forms/reset-password-form", () => ({
  ResetPasswordForm: ({ message, mode }: { message?: unknown; mode: string }) => (
    <div>{JSON.stringify({ message, mode })}</div>
  ),
}));

vi.mock("@/components/auth/AuthCard", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-card">{children}</div>
  ),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

vi.mock("next-intl/server", () => ({
  getLocale: mockGetLocale,
}));

import ResetPasswordPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLocale.mockResolvedValue("en");
});

describe("ResetPasswordPage", () => {
  it("redirects to forgot password when no user exists", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    await ResetPasswordPage({ searchParams: Promise.resolve({}) });

    expect(mockRedirect).toHaveBeenCalledWith({ href: "/forgot-password", locale: "en" });
  });

  it("renders reset form for authenticated users", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });

    const page = await ResetPasswordPage({
      searchParams: Promise.resolve({ success: "ok", mode: "set" }),
    });

    render(page);

    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
    expect(screen.getByText('{"message":{"message":"ok"},"mode":"set"}')).toBeInTheDocument();
  });
});
