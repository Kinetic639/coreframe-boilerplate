import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, getSettingsMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  getSettingsMock: vi.fn(),
}));

vi.mock("@/components/auth/forms/sign-up-form", () => ({
  SignUpForm: ({ message, invitationToken }: { message?: unknown; invitationToken?: string }) => (
    <div>{JSON.stringify({ message, invitationToken })}</div>
  ),
}));

vi.mock("@/components/form-message", () => ({
  FormMessage: ({ message }: { message: unknown }) => <div>{JSON.stringify(message)}</div>,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/server/services/site-settings.service", () => ({
  SiteSettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/metadata", () => ({
  generateAuthMetadata: vi.fn(),
}));

import Signup from "../page";

describe("SignUp page", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    getSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue({ registrationEnabled: true });
  });

  it("renders message-only branch", async () => {
    const page = await Signup({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ message: "done" }),
    });

    render(page);

    expect(screen.getByText('{"message":"done"}')).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders the sign-up form with the invitation token", async () => {
    const page = await Signup({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ invitation: "invite-1" } as never),
    });

    render(page);

    expect(
      screen.getByText('{"message":{"invitation":"invite-1"},"invitationToken":"invite-1"}')
    ).toBeInTheDocument();
    // Invitation links skip the registration gate.
    expect(getSettingsMock).not.toHaveBeenCalled();
  });

  it("redirects when registration is disabled and there is no invitation", async () => {
    getSettingsMock.mockResolvedValue({ registrationEnabled: false });

    await Signup({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({} as never),
    });

    expect(redirectMock).toHaveBeenCalledWith({ href: "/registration-disabled", locale: "en" });
  });
});
