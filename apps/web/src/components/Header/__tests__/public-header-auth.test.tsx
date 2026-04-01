import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockSignOut, mockSuccess, mockError } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSignOut: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    onClick?: () => void;
    disabled?: boolean;
  }) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <span>spinner</span>,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => {
    if (ns === "auth.logout") {
      return { button: "Log out", loggingOut: "Logging out" }[key] ?? key;
    }
    return { logoutSuccess: "Logged out" }[key] ?? key;
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mockSuccess,
    error: mockError,
  },
}));

import { PublicHeaderAuth } from "../PublicHeaderAuth";

describe("PublicHeaderAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign-in and sign-up buttons for guests", () => {
    render(<PublicHeaderAuth userContext={null} />);

    expect(screen.getByRole("link", { name: /zaloguj się/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: /rozpocznij za darmo/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });

  it("renders dashboard and logs out authenticated users", async () => {
    mockSignOut.mockResolvedValue(undefined);

    render(<PublicHeaderAuth userContext={{ user: { id: "u-1" } } as never} />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard/start"
    );

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith("Logged out");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows an error toast if logout fails", async () => {
    mockSignOut.mockRejectedValue(new Error("fail"));

    render(<PublicHeaderAuth userContext={{ user: { id: "u-1" } } as never} />);

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith("Failed to log out. Please try again.");
    });
  });
});
