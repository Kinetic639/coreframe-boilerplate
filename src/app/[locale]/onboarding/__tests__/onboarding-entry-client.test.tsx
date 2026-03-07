import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Get Started",
      description: "You need to join or create an organization to continue.",
      signedInAs: "Signed in as",
      pendingInviteHint: "You have a pending invitation. Review it to join an organization.",
      reviewInviteButton: "Review Invitation",
      createOrgHint: "Contact your administrator for an invitation.",
      signOutButton: "Sign Out",
    };
    return map[key] ?? key;
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/[locale]/actions", () => ({
  signOutAction: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { OnboardingEntryClient } from "../_components/onboarding-entry-client";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OnboardingEntryClient", () => {
  it("renders user email in signed-in-as line", () => {
    render(<OnboardingEntryClient userEmail="user@example.com" pendingInviteToken={null} />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<OnboardingEntryClient userEmail="user@example.com" pendingInviteToken={null} />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("shows createOrgHint when no pending invite token", () => {
    render(<OnboardingEntryClient userEmail="user@example.com" pendingInviteToken={null} />);
    expect(screen.getByText("Contact your administrator for an invitation.")).toBeInTheDocument();
    expect(screen.queryByText("Review Invitation")).not.toBeInTheDocument();
  });

  it("shows pending invite hint and review button when token is present", () => {
    render(
      <OnboardingEntryClient userEmail="user@example.com" pendingInviteToken="abc-token-123" />
    );
    expect(
      screen.getByText("You have a pending invitation. Review it to join an organization.")
    ).toBeInTheDocument();
    const reviewLink = screen.getByRole("link", { name: /review invitation/i });
    expect(reviewLink).toBeInTheDocument();
    expect(reviewLink).toHaveAttribute("href", "/invite/abc-token-123");
  });

  it("does not show createOrgHint when pending invite token is present", () => {
    render(
      <OnboardingEntryClient userEmail="user@example.com" pendingInviteToken="abc-token-123" />
    );
    expect(
      screen.queryByText("Contact your administrator for an invitation.")
    ).not.toBeInTheDocument();
  });

  it("review invite link points to correct invite URL", () => {
    render(<OnboardingEntryClient userEmail="user@example.com" pendingInviteToken="xyz-999" />);
    expect(screen.getByRole("link", { name: /review invitation/i })).toHaveAttribute(
      "href",
      "/invite/xyz-999"
    );
  });
});
