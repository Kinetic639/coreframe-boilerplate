import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "in 3 days",
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild }: any) =>
    asChild ? <div>{children}</div> : <button>{children}</button>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: any }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

import { InviteResolveClient } from "../invite-resolve-client";

const invitations = [
  {
    id: "i-1",
    org_name: "Acme",
    org_name_2: "Warehouse",
    role_name: "Manager",
    branch_name: "Warsaw",
    expires_at: "2026-04-10T00:00:00Z",
    token: "tok-1",
  },
] as never;

describe("InviteResolveClient", () => {
  it("renders invitation cards and skip CTA", () => {
    render(
      <InviteResolveClient
        invitations={invitations}
        userEmail="a@example.com"
        skipHref="/onboarding"
      />
    );

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("Acme Warehouse")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /detailsButton/i })).toHaveAttribute(
      "href",
      JSON.stringify({ pathname: "/invite/[token]", params: { token: "tok-1" } })
    );
    expect(screen.getByRole("link", { name: /skipButton/i })).toHaveAttribute(
      "href",
      "/onboarding"
    );
  });
});
