import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: any) =>
    asChild ? <div>{children}</div> : <button {...props}>{children}</button>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

vi.mock("@/app/[locale]/actions", () => ({
  signOutAction: vi.fn(),
}));

import { OnboardingInvitePendingClient } from "../onboarding-invite-pending-client";

describe("OnboardingInvitePendingClient", () => {
  it("renders pending invites and primary CTA", () => {
    render(
      <OnboardingInvitePendingClient
        userEmail="a@example.com"
        firstName="Alice"
        invites={[{ id: "1", token: "tok-1", orgName: "Acme" }]}
      />
    );

    expect(screen.getByText(/titleWithName/)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /reviewButton/i })[0]).toHaveAttribute(
      "href",
      "/invite/tok-1"
    );
    expect(screen.getByRole("button", { name: /signOutButton/i })).toBeInTheDocument();
  });

  it("renders the extra invites message for multiple invites", () => {
    render(
      <OnboardingInvitePendingClient
        userEmail="a@example.com"
        invites={[
          { id: "1", token: "tok-1", orgName: "Acme" },
          { id: "2", token: "tok-2", orgName: null },
        ]}
      />
    );

    expect(screen.getByText(/moreInvites/)).toBeInTheDocument();
    expect(screen.getByText(/unknownOrg/)).toBeInTheDocument();
  });
});
