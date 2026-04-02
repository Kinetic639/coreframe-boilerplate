import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockCheckOrgSlugAction, mockCreateOrganizationAction, mockToastError } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockCheckOrgSlugAction: vi.fn(),
    mockCreateOrganizationAction: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === "titleWithName") return `titleWithName:${values?.name}`;
    if (key === "priceFree") return "Free";
    if (key === "pricePaid") return `${values?.amount} PLN`;
    if (key === "limitUnlimited") return `Unlimited ${values?.unit}`;
    if (key === "limitCount") return `${values?.count} ${values?.unit}`;
    if (key === "unitBranches") return "branches";
    if (key === "unitMembers") return "members";
    return key;
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children }: any) => <div>{children}</div>,
  },
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type = "button", ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, onKeyDown, ...props }: any) => (
    <input value={value} onChange={onChange} onKeyDown={onKeyDown} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/app/actions/onboarding", () => ({
  checkOrgSlugAction: (...args: unknown[]) => mockCheckOrgSlugAction(...args),
  createOrganizationAction: (...args: unknown[]) => mockCreateOrganizationAction(...args),
}));

import { OnboardingWizardClient } from "../onboarding-wizard-client";

describe("OnboardingWizardClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOrgSlugAction.mockResolvedValue({ available: true });
    mockCreateOrganizationAction.mockResolvedValue({ success: true });
  });

  const plans = [
    {
      id: "free-plan",
      name: "free",
      display_name: "Free plan",
      max_branches: 1,
      max_members: 3,
      price_monthly_cents: 0,
    },
    {
      id: "pro-plan",
      name: "pro",
      display_name: "Pro plan",
      max_branches: -1,
      max_members: 10,
      price_monthly_cents: 4900,
    },
  ] as any;

  it("generates a slug, advances through the steps, and submits successfully", async () => {
    render(<OnboardingWizardClient userEmail="ada@example.com" firstName="Ada" plans={plans} />);

    expect(screen.getByText("titleWithName:Ada")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("orgNameLabel"), {
      target: { value: "Acme Warehouse" },
    });
    fireEvent.click(screen.getByRole("button", { name: /orgSlugGenerate/i }));

    await waitFor(() => {
      expect(mockCheckOrgSlugAction).toHaveBeenCalledWith("acme-warehouse");
    });

    fireEvent.click(screen.getByRole("button", { name: /nextButton/i }));
    expect(screen.getByLabelText("branchNameLabel")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("branchNameLabel"), {
      target: { value: "North Hub" },
    });
    fireEvent.click(screen.getByRole("button", { name: /nextButton/i }));

    expect(screen.getByText("Free plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pro plan/i }));
    fireEvent.click(screen.getByRole("button", { name: /createButton/i }));

    await waitFor(() => {
      expect(mockCreateOrganizationAction).toHaveBeenCalledWith(
        "Acme Warehouse",
        "North Hub",
        "pro-plan",
        null,
        "acme-warehouse"
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/start");
    });
  });

  it("shows validation and handles failed creation", async () => {
    mockCreateOrganizationAction.mockResolvedValueOnce({ success: false });

    render(<OnboardingWizardClient userEmail="ada@example.com" plans={plans} />);

    fireEvent.click(screen.getByRole("button", { name: /nextButton/i }));
    expect(screen.getByText("orgSlugRequired")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("orgNameLabel"), {
      target: { value: "Beta Org" },
    });
    fireEvent.change(screen.getByLabelText("orgSlugLabel"), {
      target: { value: "beta-org" },
    });

    await waitFor(() => {
      expect(mockCheckOrgSlugAction).toHaveBeenCalledWith("beta-org");
    });

    fireEvent.click(screen.getByRole("button", { name: /nextButton/i }));
    fireEvent.click(screen.getByRole("button", { name: /nextButton/i }));
    fireEvent.click(screen.getByRole("button", { name: /createButton/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("createError");
    });

    expect(screen.getByText("planStepTitle")).toBeInTheDocument();
  });
});
