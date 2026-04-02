import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfileForm } from "../UserProfileForm";

const { mockUpdateUserProfile, mockOnUpdate } = vi.hoisted(() => ({
  mockUpdateUserProfile: vi.fn(),
  mockOnUpdate: vi.fn(),
}));

vi.mock("@/lib/api/user-detail", () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: () => ({
    availableBranches: [
      { id: "b-1", name: "Warsaw" },
      { id: "b-2", name: "Berlin" },
    ],
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
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div>
      <select
        aria-label="Default Branch"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">No default branch</option>
        <option value="b-1">Warsaw</option>
        <option value="b-2">Berlin</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const user = {
  id: "user-1",
  email: "user@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
  default_branch_id: "b-1",
  branch: { name: "Warsaw" },
  created_at: "2026-04-01T10:00:00.000Z",
} as never;

describe("UserProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile details in read-only mode", () => {
    render(<UserProfileForm user={user} onUpdate={mockOnUpdate} />);

    expect(screen.getByText("User Profile")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("saves edited profile values", async () => {
    mockUpdateUserProfile.mockResolvedValue(undefined);

    render(<UserProfileForm user={user} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Grace" } });
    fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "Hopper" } });
    fireEvent.change(screen.getByLabelText("Default Branch"), { target: { value: "b-2" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith("user-1", {
        first_name: "Grace",
        last_name: "Hopper",
        default_branch_id: "b-2",
      });
    });

    expect(mockOnUpdate).toHaveBeenCalled();
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("cancels edits and restores original values", () => {
    render(<UserProfileForm user={user} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("shows fallback states and surfaces save errors", async () => {
    mockUpdateUserProfile.mockRejectedValue(new Error("Save failed"));

    render(
      <UserProfileForm
        user={
          {
            ...user,
            first_name: null,
            last_name: null,
            default_branch_id: null,
            branch: null,
          } as never
        }
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.getByText("No default branch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
