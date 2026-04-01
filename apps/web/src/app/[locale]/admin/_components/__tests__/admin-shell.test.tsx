import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((value: string) => value) as ((value: string) => string) & {
      has: (value: string) => boolean;
    };
    t.has = () => true;
    return t;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  usePathname: () => "/admin/users",
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
  Sidebar: ({ children }: any) => <aside>{children}</aside>,
  SidebarHeader: ({ children }: any) => <div>{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarFooter: ({ children }: any) => <div>{children}</div>,
  SidebarRail: () => <div data-testid="sidebar-rail" />,
  SidebarInset: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children, asChild, ...props }: any) =>
    asChild ? <div>{children}</div> : <button {...props}>{children}</button>,
  SidebarTrigger: () => <button type="button">Trigger</button>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: ({ user, isAdmin }: any) => (
    <div data-testid="nav-user">
      {user.name}:{user.email}:{String(isAdmin)}
    </div>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock("@/lib/sidebar/v2/icon-map", () => ({
  getIconComponent: () => () => <span data-testid="icon" />,
}));

vi.mock("@/lib/sidebar/v2/active", () => ({
  isItemActive: (item: any, pathname: string) => item.href === pathname,
}));

vi.mock("@/lib/sidebar/v2/label", () => ({
  resolveSidebarLabel: (item: any) => item.label,
}));

vi.mock("@/lib/i18n/unsafe-href", () => ({
  toUnsafeI18nHref: (href: string) => href,
}));

import { AdminShell } from "../admin-shell";

describe("AdminShell", () => {
  const sidebarModel = {
    main: [
      { id: "users", label: "Users", href: "/admin/users", iconKey: "users" },
      {
        id: "soon",
        label: "Soon Feature",
        iconKey: "clock",
        disabledReason: "coming_soon",
      },
    ],
    footer: [],
  } as any;

  const user = {
    name: "Admin User",
    email: "admin@example.com",
    avatar: "/avatar.png",
  };

  it("renders header, navigation items, and content", () => {
    render(
      <AdminShell sidebarModel={sidebarModel} user={user}>
        <div>Admin Content</div>
      </AdminShell>
    );

    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("shows disabled items and admin user footer", () => {
    render(
      <AdminShell sidebarModel={sidebarModel} user={user}>
        <div>Child</div>
      </AdminShell>
    );

    expect(screen.getByText("Soon Feature")).toBeInTheDocument();
    expect(screen.getByText("Soon")).toBeInTheDocument();
    expect(screen.getByTestId("nav-user")).toHaveTextContent("Admin User:admin@example.com:true");
  });
});
