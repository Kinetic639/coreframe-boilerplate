import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
    asChild,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
  }) => (asChild ? <div>{children}</div> : <button onClick={onClick}>{children}</button>),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      home: "Home",
      account: "Account",
      dashboard: "Dashboard",
      adminPanel: "Admin Panel",
      diagnostics: "Diagnostics",
      logOut: "Log out",
    })[key] ?? key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard/start",
}));

vi.mock("@/app/[locale]/actions", () => ({
  signOutAction: vi.fn(),
}));

import { NavUser } from "../nav-user";

describe("NavUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user info and initials fallback", () => {
    render(<NavUser user={{ name: "Alice Smith", email: "alice@example.com", avatar: "" }} />);

    expect(screen.getAllByText("Alice Smith")[0]).toBeInTheDocument();
    expect(screen.getAllByText("alice@example.com")[0]).toBeInTheDocument();
    expect(screen.getAllByText("AS")[0]).toBeInTheDocument();
  });

  it("routes to menu destinations for admins", () => {
    render(
      <NavUser user={{ name: "Alice Smith", email: "alice@example.com", avatar: "" }} isAdmin />
    );

    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    fireEvent.click(screen.getByRole("button", { name: /account/i }));
    fireEvent.click(screen.getByRole("button", { name: /admin panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /diagnostics/i }));

    expect(mockPush).toHaveBeenNthCalledWith(1, "/");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/dashboard/account");
    expect(mockPush).toHaveBeenNthCalledWith(3, "/admin");
    expect(mockPush).toHaveBeenNthCalledWith(4, "/dashboard/diagnostics");
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
