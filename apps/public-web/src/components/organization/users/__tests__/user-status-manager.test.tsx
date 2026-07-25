import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatusManager } from "../UserStatusManager";

const { mockUpdateUserStatus, mockOnUpdate } = vi.hoisted(() => ({
  mockUpdateUserStatus: vi.fn(),
  mockOnUpdate: vi.fn(),
}));

vi.mock("@/lib/api/user-detail", () => ({
  updateUserStatus: (...args: unknown[]) => mockUpdateUserStatus(...args),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
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

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div>
      <select aria-label="New Status" value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const user = {
  id: "user-1",
  status_id: "active",
  created_at: "2026-04-01T10:00:00.000Z",
  role_assignments: [{ role: { name: "admin" } }],
  branch_assignments: [{ branch: { name: "Warsaw" } }],
} as never;

describe("UserStatusManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current user status", () => {
    render(<UserStatusManager user={user} onUpdate={mockOnUpdate} />);

    expect(screen.getByText("User Status & Settings")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("updates the user status", async () => {
    mockUpdateUserStatus.mockResolvedValue(undefined);

    render(<UserStatusManager user={user} onUpdate={mockOnUpdate} />);

    fireEvent.change(screen.getByLabelText("New Status"), { target: { value: "suspended" } });
    fireEvent.change(screen.getByLabelText("Reason (Optional)"), {
      target: { value: "Policy breach" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update status/i }));

    await waitFor(() => {
      expect(mockUpdateUserStatus).toHaveBeenCalledWith("user-1", "suspended");
    });

    expect(mockOnUpdate).toHaveBeenCalled();
    expect(screen.getByText("User status updated to Suspended")).toBeInTheDocument();
  });
});
