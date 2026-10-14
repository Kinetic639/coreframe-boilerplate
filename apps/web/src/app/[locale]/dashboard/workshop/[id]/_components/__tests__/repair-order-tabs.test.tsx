import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { RepairOrderTabs, isRepairOrderTab, type RepairOrderTab } from "../repair-order-tabs";

const tabs = (["overview", "lines", "warehouse", "documents", "related"] as RepairOrderTab[]).map(
  (id) => ({
    id,
    label: id,
    count: id === "related" ? 3 : id === "lines" ? 0 : undefined,
    content: <div data-testid={`panel-${id}`}>{id} content</div>,
  })
);

describe("RepairOrderTabs", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/dashboard/workshop/r1?tab=stock#warehouse");
  });

  it("opens the requested tab; the other panels stay mounted but hidden", () => {
    render(<RepairOrderTabs tabs={tabs} initialTab="warehouse" label="sections" />);
    expect(screen.getByRole("tab", { name: "warehouse" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("panel-warehouse").parentElement).toHaveAttribute(
      "data-state",
      "active"
    );
    // Still in the document: an edit in progress in another tab is not lost
    expect(screen.getByTestId("panel-overview").parentElement).toHaveAttribute(
      "data-state",
      "inactive"
    );
  });

  it("shows a count only when there is something to count", () => {
    render(<RepairOrderTabs tabs={tabs} initialTab="overview" label="sections" />);
    expect(screen.getByRole("tab", { name: "related 3" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "lines" })).toBeInTheDocument();
  });

  it("switching keeps the tab in the URL without the old anchor", () => {
    render(<RepairOrderTabs tabs={tabs} initialTab="warehouse" label="sections" />);
    // Radix tabs activate on mouse down / focus
    fireEvent.mouseDown(screen.getByRole("tab", { name: "related 3" }), { button: 0 });
    expect(window.location.search).toBe("?tab=related");
    expect(window.location.hash).toBe("");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "overview" }), { button: 0 });
    expect(window.location.search).toBe("");
  });

  it("knows its tab ids", () => {
    expect(isRepairOrderTab("related")).toBe(true);
    expect(isRepairOrderTab("stock")).toBe(false);
    expect(isRepairOrderTab(undefined)).toBe(false);
  });
});
