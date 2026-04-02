import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserPermissionOverrides } from "../UserPermissionOverrides";

const {
  mockUpsertPermissionOverride,
  mockRemovePermissionOverride,
  mockFetchAvailablePermissions,
  mockOnUpdate,
} = vi.hoisted(() => ({
  mockUpsertPermissionOverride: vi.fn(),
  mockRemovePermissionOverride: vi.fn(),
  mockFetchAvailablePermissions: vi.fn(),
  mockOnUpdate: vi.fn(),
}));

vi.mock("@/lib/api/user-detail", () => ({
  upsertPermissionOverride: (...args: unknown[]) => mockUpsertPermissionOverride(...args),
  removePermissionOverride: (...args: unknown[]) => mockRemovePermissionOverride(...args),
  fetchAvailablePermissions: (...args: unknown[]) => mockFetchAvailablePermissions(...args),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: () => ({
    activeOrg: { id: "org-1" },
    availableBranches: [{ id: "b-1", name: "Warsaw" }],
  }),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, asChild, ...props }: any) =>
    asChild ? (
      <div>{children}</div>
    ) : (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : <div>{children}</div>),
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div>
      <select aria-label="select" value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="">empty</option>
        <option value="permission-1">Users View</option>
        <option value="global">Organization-wide</option>
        <option value="b-1">Warsaw</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled }: any) => (
    <input
      aria-label="switch"
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const emptyUser = {
  id: "user-1",
  roles: [],
  permissionOverrides: [],
} as never;

const userWithOverride = {
  id: "user-1",
  roles: [{ id: "role-assignment-1", role: { name: "org_admin" }, scope: "org" }],
  permissionOverrides: [
    {
      id: "override-1",
      permission_id: "permission-1",
      allowed: true,
      scope: "org",
      scope_id: "org-1",
      permission: { label: "Users View", slug: "users.view" },
    },
  ],
} as never;

const userWithBranchOverride = {
  id: "user-1",
  roles: [],
  permissionOverrides: [
    {
      id: "override-2",
      permission_id: "permission-1",
      allowed: false,
      scope: "branch",
      scope_id: "b-1",
      permission: { label: "Users View", slug: "users.manage" },
    },
  ],
} as never;

describe("UserPermissionOverrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAvailablePermissions.mockResolvedValue([
      { id: "permission-1", label: "Users View", slug: "users.view" },
    ]);
  });

  it("renders empty state and adds an override", async () => {
    mockUpsertPermissionOverride.mockResolvedValue(undefined);

    render(<UserPermissionOverrides user={emptyUser} onUpdate={mockOnUpdate} />);

    expect(await screen.findByText("No permission overrides")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /add override/i })[0]);

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[0], { target: { value: "permission-1" } });
    fireEvent.click(screen.getAllByLabelText("switch")[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /add override/i })[1]);

    await waitFor(() => {
      expect(mockUpsertPermissionOverride).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        "permission-1",
        false,
        null
      );
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("toggles and removes overrides", async () => {
    mockUpsertPermissionOverride.mockResolvedValue(undefined);
    mockRemovePermissionOverride.mockResolvedValue(undefined);

    render(<UserPermissionOverrides user={userWithOverride} onUpdate={mockOnUpdate} />);

    expect(screen.getAllByText("Users View").length).toBeGreaterThan(0);
    const overrideRow = screen.getByText("users.view").closest("tr");
    expect(overrideRow).not.toBeNull();
    fireEvent.click(within(overrideRow as HTMLTableRowElement).getByLabelText("switch"));

    await waitFor(() => {
      expect(mockUpsertPermissionOverride).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        "permission-1",
        false,
        null
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /remove override/i }));

    await waitFor(() => {
      expect(mockRemovePermissionOverride).toHaveBeenCalledWith("override-1");
    });
  });

  it("adds a branch-scoped override", async () => {
    mockUpsertPermissionOverride.mockResolvedValue(undefined);

    render(<UserPermissionOverrides user={emptyUser} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add override/i })[0]);

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[0], { target: { value: "permission-1" } });
    fireEvent.change(selects[1], { target: { value: "b-1" } });
    fireEvent.click(screen.getAllByRole("button", { name: /add override/i })[1]);

    await waitFor(() => {
      expect(mockUpsertPermissionOverride).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        "permission-1",
        true,
        "b-1"
      );
    });
  });

  it("renders branch scope details and shows update errors", async () => {
    mockUpsertPermissionOverride.mockRejectedValue(new Error("Toggle failed"));

    render(<UserPermissionOverrides user={userWithBranchOverride} onUpdate={mockOnUpdate} />);

    const overrideRow = screen.getByText("users.manage").closest("tr");
    expect(overrideRow).not.toBeNull();
    expect(within(overrideRow as HTMLTableRowElement).getByText("Warsaw")).toBeInTheDocument();
    expect(within(overrideRow as HTMLTableRowElement).getByText("Denied")).toBeInTheDocument();
    fireEvent.click(within(overrideRow as HTMLTableRowElement).getByLabelText("switch"));

    expect(await screen.findByText("Toggle failed")).toBeInTheDocument();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
