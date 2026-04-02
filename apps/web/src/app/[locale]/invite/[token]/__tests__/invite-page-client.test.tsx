import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPush,
  mockAcceptInvitationAction,
  mockDeclineInvitationAction,
  mockGetMyPendingInvitationsAction,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockAcceptInvitationAction: vi.fn(),
  mockDeclineInvitationAction: vi.fn(),
  mockGetMyPendingInvitationsAction: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/organization/invitations", () => ({
  acceptInvitationAction: (...args: unknown[]) => mockAcceptInvitationAction(...args),
  declineInvitationAction: (...args: unknown[]) => mockDeclineInvitationAction(...args),
}));

vi.mock("@/app/actions/organization/invite-preview", () => ({
  getMyPendingInvitationsAction: (...args: unknown[]) => mockGetMyPendingInvitationsAction(...args),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "in 3 days",
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, onClick, disabled, ...props }: any) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

import { InvitePageClient } from "../_components/invite-page-client";

const realSetTimeout = globalThis.setTimeout;

const preview = {
  reason_code: "INVITE_PENDING",
  org_name: "Acme",
  org_name_2: "Warehouse",
  inviter_name: "Admin",
  branch_name: "Warsaw",
  invited_email: "user@example.com",
  expires_at: "2026-04-10T00:00:00Z",
} as never;

describe("InvitePageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders not found state", () => {
    render(
      <InvitePageClient
        token="tok-1"
        preview={{ reason_code: "INVITE_NOT_FOUND" } as never}
        userEmail={null}
        locale="en"
      />
    );

    expect(screen.getByText("notFoundTitle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hasAccount" })).toHaveAttribute("href", "/sign-in");
  });

  it("renders login and signup CTAs for unauthenticated users", () => {
    render(<InvitePageClient token="tok-1" preview={preview} userEmail={null} locale="en" />);

    expect(screen.getByText("loginRequired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hasAccount" })).toHaveAttribute(
      "href",
      JSON.stringify({ pathname: "/sign-in", query: { returnUrl: "/invite/tok-1" } })
    );
    expect(screen.getByRole("link", { name: "noAccount" })).toHaveAttribute(
      "href",
      JSON.stringify({ pathname: "/sign-up", query: { invitation: "tok-1" } })
    );
  });

  it("accepts an invitation and shows the dashboard CTA", async () => {
    mockAcceptInvitationAction.mockResolvedValue({ success: true });

    render(
      <InvitePageClient token="tok-1" preview={preview} userEmail="user@example.com" locale="en" />
    );

    fireEvent.click(screen.getByRole("button", { name: "acceptButton" }));

    await waitFor(() => {
      expect(mockAcceptInvitationAction).toHaveBeenCalledWith("tok-1");
    });

    expect(screen.getByText("successMessage")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "goToDashboardButton" })).toHaveAttribute(
      "href",
      "/dashboard/start"
    );
  });

  it("renders the mismatch warning for a different authenticated email", () => {
    render(
      <InvitePageClient token="tok-1" preview={preview} userEmail="other@example.com" locale="en" />
    );

    expect(screen.getByText(/emailMismatch/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "goToDashboard" })).toHaveAttribute(
      "href",
      "/dashboard/start"
    );
  });

  it("declines an invitation and routes to resolve when pending invites remain", async () => {
    mockDeclineInvitationAction.mockResolvedValue({ success: true });
    mockGetMyPendingInvitationsAction.mockResolvedValue({
      success: true,
      invitations: [{ id: "pending-1" }],
    });
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback: (...args: any[]) => void, ms?: number, ...args: any[]) =>
        realSetTimeout(callback, ms === 3000 ? 0 : ms, ...args)) as typeof setTimeout);

    render(
      <InvitePageClient token="tok-1" preview={preview} userEmail="user@example.com" locale="en" />
    );

    fireEvent.click(screen.getByRole("button", { name: "declineButton" }));

    await waitFor(() => {
      expect(mockDeclineInvitationAction).toHaveBeenCalledWith("tok-1");
    });

    expect(mockGetMyPendingInvitationsAction).toHaveBeenCalled();
    expect(screen.getByText("declineSuccessMessage")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "continueButton" })).toHaveAttribute(
      "href",
      "/invite/resolve"
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/invite/resolve");
    });

    timeoutSpy.mockRestore();
  });

  it("renders terminal invite states", () => {
    render(
      <InvitePageClient
        token="tok-1"
        preview={{ reason_code: "INVITE_EXPIRED" } as never}
        userEmail="user@example.com"
        locale="pl"
      />
    );

    expect(screen.getByText("expiredTitle")).toBeInTheDocument();
    expect(screen.getByText("expiredWarning")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "goToDashboard" })).toHaveAttribute(
      "href",
      "/dashboard/start"
    );
  });
});
