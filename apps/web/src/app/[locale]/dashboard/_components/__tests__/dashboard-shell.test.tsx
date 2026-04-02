import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const setSidebarCollapsed = vi.fn();

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
  usePathname: () => "/dashboard/team",
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children, open, onOpenChange }: any) => (
    <div data-testid="sidebar-provider" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        collapse
      </button>
      {children}
    </div>
  ),
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
  SidebarMenuSub: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubButton: ({ children, asChild, ...props }: any) =>
    asChild ? <div>{children}</div> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: ({ user, isAdmin }: any) => (
    <div data-testid="nav-user">
      {user.name}:{user.email}:{String(isAdmin)}
    </div>
  ),
}));

vi.mock("../sidebar-branch-switcher", () => ({
  SidebarBranchSwitcher: ({ branches, activeBranchId }: any) => (
    <div data-testid="branch-switcher">
      {branches.length}:{activeBranchId}
    </div>
  ),
}));

vi.mock("../sidebar-org-header", () => ({
  SidebarOrgHeader: () => <div data-testid="org-header" />,
}));

vi.mock("@/lib/stores/v2/user-store", () => ({
  useUserStoreV2: () => ({
    user: {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      avatar_signed_url: "",
      avatar_url: "/avatar.png",
    },
  }),
}));

vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (selector: any) =>
    selector({
      sidebarCollapsed: false,
      setSidebarCollapsed,
    }),
}));

vi.mock("@/utils/user-helpers", () => ({
  getUserDisplayName: (first: string, last: string) => `${first} ${last}`,
}));

vi.mock("@/components/Dashboard/DashboardStatusBar", () => ({
  DashboardStatusBar: ({ initialLatestEvent }: any) => (
    <div data-testid="status-bar">{initialLatestEvent?.id ?? "none"}</div>
  ),
}));

vi.mock("@/components/v2/layout/dashboard-header", () => ({
  DashboardHeaderV2: () => <div data-testid="dashboard-header" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...parts: string[]) => parts.filter(Boolean).join(" "),
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

import { DashboardShell } from "../dashboard-shell";

describe("DashboardShell", () => {
  const sidebarModel = {
    main: [
      { id: "home", label: "Home", href: "/dashboard/home", iconKey: "home" },
      {
        id: "team",
        label: "Team",
        iconKey: "team",
        children: [
          { id: "members", label: "Members", href: "/dashboard/team", iconKey: "users" },
          {
            id: "soon",
            label: "Soon Child",
            iconKey: "clock",
            disabledReason: "coming_soon",
          },
        ],
      },
    ],
    footer: [{ id: "settings", label: "Settings", href: "/dashboard/settings", iconKey: "gear" }],
  } as any;

  const branches = [{ id: "b-1", name: "Warsaw" }] as any;

  it("renders navigation chrome, child content, and latest event", () => {
    render(
      <DashboardShell
        sidebarModel={sidebarModel}
        accessibleBranches={branches}
        activeBranchId="b-1"
        initialLatestEvent={{ id: "evt-1" } as any}
      >
        <div>Dashboard Content</div>
      </DashboardShell>
    );

    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("org-header")).toBeInTheDocument();
    expect(screen.getByTestId("branch-switcher")).toHaveTextContent("1:b-1");
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    expect(screen.getByTestId("status-bar")).toHaveTextContent("evt-1");
    expect(screen.getByRole("link", { name: /members/i })).toHaveAttribute(
      "href",
      "/dashboard/team"
    );
  });

  it("uses user store data and updates collapsed state on provider change", () => {
    render(
      <DashboardShell
        sidebarModel={sidebarModel}
        accessibleBranches={branches}
        activeBranchId="b-1"
        initialLatestEvent={null}
        isAdmin
      >
        <div>Child</div>
      </DashboardShell>
    );

    expect(screen.getByTestId("nav-user")).toHaveTextContent("Ada Lovelace:ada@example.com:true");
    expect(screen.getByText("Soon Child")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "collapse" }));
    expect(setSidebarCollapsed).toHaveBeenCalledWith(true);
  });
});
