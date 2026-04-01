import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BillingClient } from "../_components/billing-client";

describe("BillingClient", () => {
  it("renders an empty state when billing data is unavailable", () => {
    render(<BillingClient initialBilling={null} />);

    expect(screen.getByText(/no billing information available/i)).toBeInTheDocument();
  });

  it("renders the current plan and enabled modules", () => {
    render(
      <BillingClient
        initialBilling={
          {
            plan_name: "pro",
            enabled_modules: ["warehouse", "organization-management", "mystery-module"],
            updated_at: "2026-03-10T12:00:00Z",
          } as never
        }
      />
    );

    expect(screen.getByText("Current Plan")).toBeInTheDocument();
    expect(screen.getAllByText("pro")).toHaveLength(2);
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("mystery-module")).toBeInTheDocument();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  it("shows a message when the plan has no enabled modules", () => {
    render(
      <BillingClient
        initialBilling={
          {
            plan_name: "starter",
            enabled_modules: [],
            updated_at: null,
          } as never
        }
      />
    );

    expect(screen.getByText(/no modules enabled/i)).toBeInTheDocument();
  });
});
