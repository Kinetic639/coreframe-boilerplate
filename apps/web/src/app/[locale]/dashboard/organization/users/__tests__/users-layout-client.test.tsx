import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `label:${key}`,
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
}));

import { UsersLayoutClient } from "../_components/users-layout-client";

describe("UsersLayoutClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the navigation tabs and child content", () => {
    mockUsePathname.mockReturnValue("/dashboard/organization/users/members");

    render(
      <UsersLayoutClient>
        <div>child content</div>
      </UsersLayoutClient>
    );

    expect(screen.getByRole("link", { name: /label:list/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /label:invitations/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /label:roles/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /label:positions/i })).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("marks the current pathname tab as active", () => {
    mockUsePathname.mockReturnValue("/dashboard/organization/users/roles");

    render(
      <UsersLayoutClient>
        <div>child content</div>
      </UsersLayoutClient>
    );

    expect(screen.getByRole("link", { name: /label:roles/i })).toHaveClass(
      "border-primary",
      "text-primary"
    );
    expect(screen.getByRole("link", { name: /label:list/i })).toHaveClass("border-transparent");
  });
});
