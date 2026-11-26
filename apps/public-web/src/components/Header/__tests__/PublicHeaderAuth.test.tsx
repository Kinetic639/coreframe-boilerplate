import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { localeMock, refreshMock, signOutMock, successMock, errorMock } = vi.hoisted(() => ({
  localeMock: vi.fn(() => "pl"),
  refreshMock: vi.fn(),
  signOutMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => localeMock(),
  useTranslations: (namespace?: string) => (key: string) =>
    namespace === "auth.success" ? `success:${key}` : `logout:${key}`,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

import { PublicHeaderAuth } from "../PublicHeaderAuth";

describe("PublicHeaderAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    localeMock.mockReturnValue("pl");
    refreshMock.mockReset();
    signOutMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
  });

  it("links guests to the one shared sign-in page", () => {
    render(<PublicHeaderAuth userContext={null} />);

    expect(screen.getByRole("link", { name: /signIn/ })).toHaveAttribute(
      "href",
      "https://app.ambra-system.com/logowanie"
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("uses the English sign-in page on the English site", () => {
    localeMock.mockReturnValue("en");
    render(<PublicHeaderAuth userContext={null} />);

    expect(screen.getByRole("link", { name: /signIn/ })).toHaveAttribute(
      "href",
      "https://app.ambra-system.com/en/sign-in"
    );
  });

  it("renders dashboard and logs the user out successfully", async () => {
    signOutMock.mockResolvedValue(undefined);

    render(<PublicHeaderAuth userContext={{ user: { id: "user-1" } } as never} />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "https://app.ambra-system.com/dashboard/start"
    );

    fireEvent.click(screen.getByRole("button", { name: "logout:button" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledOnce();
    });
    expect(successMock).toHaveBeenCalledWith("success:logoutSuccess");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows an error toast and re-enables the button when logout fails", async () => {
    signOutMock.mockRejectedValue(new Error("boom"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PublicHeaderAuth userContext={{ user: { id: "user-1" } } as never} />);

    fireEvent.click(screen.getByRole("button", { name: "logout:button" }));

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Failed to log out. Please try again.");
    });

    expect(screen.getByRole("button", { name: "logout:button" })).toBeEnabled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
