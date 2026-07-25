import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRoleManager } from "../UserRoleManager";

const { mockAssignUserRole, mockRemoveUserRole, mockFetchAvailableRoles, mockOnUpdate } =
  vi.hoisted(() => ({
    mockAssignUserRole: vi.fn(),
    mockRemoveUserRole: vi.fn(),
    mockFetchAvailableRoles: vi.fn(),
    mockOnUpdate: vi.fn(),
  }));

vi.mock("@/lib/api/user-detail", () => ({
  assignUserRole: (...args: unknown[]) => mockAssignUserRole(...args),
  removeUserRole: (...args: unknown[]) => mockRemoveUserRole(...args),
  fetchAvailableRoles: (...args: unknown[]) => mockFetchAvailableRoles(...args),
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
        <option value="role-1">Org Admin</option>
        <option value="org">Organization</option>
        <option value="branch">Branch</option>
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
} as never;

const userWithRole = {
  id: "user-1",
  roles: [
    {
      id: "assignment-1",
      scope: "org",
      scope_name: "Organization",
      role: { name: "org_admin", is_basic: true },
    },
  ],
} as never;

describe("UserRoleManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAvailableRoles.mockResolvedValue([
      { id: "role-1", name: "Org Admin", is_basic: true },
    ]);
  });

  it("renders empty state and assigns the first role", async () => {
    mockAssignUserRole.mockResolvedValue(undefined);

    render(<UserRoleManager user={emptyUser} onUpdate={mockOnUpdate} />);

    expect(await screen.findByText("No roles assigned")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /assign first role/i }));

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[0], { target: { value: "role-1" } });
    fireEvent.click(screen.getByRole("button", { name: /assign role/i }));

    await waitFor(() => {
      expect(mockAssignUserRole).toHaveBeenCalledWith("user-1", "role-1", "org", "org-1");
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("renders assigned roles and removes a role", async () => {
    mockRemoveUserRole.mockResolvedValue(undefined);

    render(<UserRoleManager user={userWithRole} onUpdate={mockOnUpdate} />);

    expect(await screen.findByText("org_admin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove role/i }));

    await waitFor(() => {
      expect(mockRemoveUserRole).toHaveBeenCalledWith("assignment-1");
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });
});
