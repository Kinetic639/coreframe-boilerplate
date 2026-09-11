/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key.split(".").pop(),
}));

import { RepairOrderStatusBadge } from "../repair-order-status-badge";

describe("RepairOrderStatusBadge", () => {
  it.each(["open", "closed", "archived"])("renders a label for status '%s'", (status) => {
    render(<RepairOrderStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("falls back gracefully for an unknown status value instead of crashing", () => {
    render(<RepairOrderStatusBadge status="some_future_status" />);
    expect(screen.getByText("some_future_status")).toBeInTheDocument();
  });
});
