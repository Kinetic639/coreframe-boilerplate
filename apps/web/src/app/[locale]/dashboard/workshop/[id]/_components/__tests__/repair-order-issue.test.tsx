/**
 * @vitest-environment jsdom
 *
 * Phase 10F — "Wydaj części (RW)": two groups (container parts to prepare,
 * reserved material to tick off), recipient required, quantity bounds,
 * issue -> toast with the RW number -> refresh.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  },
}));

const h = vi.hoisted(() => ({
  list: vi.fn(),
  issue: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-toastify", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/app/actions/workshop/issue", () => ({
  listRepairOrderIssueCandidatesAction: (...a: unknown[]) => h.list(...a),
  issueRepairOrderPartsAction: (...a: unknown[]) => h.issue(...a),
}));

import { RepairOrderIssue } from "../repair-order-issue";

const candidates = [
  {
    kind: "allocation",
    sourceId: "al1",
    repairOrderLineId: "rol1",
    productCode: "5H0807221",
    productName: "Zderzak",
    sku: "5H0807221GRU",
    outstanding: 1,
    location: { id: "zlc", code: "ZLC-01", name: "Regał" },
    containers: ["K-184213-02"],
  },
  {
    kind: "reservation",
    sourceId: "rl2",
    repairOrderLineId: "rol2",
    productCode: "WHT005263",
    productName: "Spinka",
    sku: "WHT005263",
    outstanding: 20,
    location: { id: "bin", code: "SZ-02", name: "Kuweta" },
    containers: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.list.mockResolvedValue({ success: true, data: candidates });
});

async function openDialog() {
  render(<RepairOrderIssue repairOrderId="ro1" zlNumber="184213" canOperate />);
  fireEvent.click(screen.getByTestId("issue-open"));
  await waitFor(() => expect(screen.getAllByTestId("issue-row")).toHaveLength(2));
}

describe("RepairOrderIssue", () => {
  it("is hidden without operate permission", () => {
    render(<RepairOrderIssue repairOrderId="ro1" zlNumber="184213" canOperate={false} />);
    expect(screen.queryByTestId("issue-open")).not.toBeInTheDocument();
  });

  it("splits container parts and tick-off material, recipient required", async () => {
    await openDialog();
    expect(screen.getByTestId("issue-group-prepare")).toHaveTextContent("5H0807221GRU");
    expect(screen.getByTestId("issue-group-tickoff")).toHaveTextContent("WHT005263");
    expect(screen.getByTestId("issue-confirm")).toBeDisabled();
    fireEvent.change(screen.getByTestId("issue-recipient"), { target: { value: "Jan Kowalski" } });
    expect(screen.getByTestId("issue-confirm")).toBeEnabled();
  });

  it("rejects a quantity above what is left", async () => {
    await openDialog();
    fireEvent.change(screen.getByTestId("issue-recipient"), { target: { value: "Jan" } });
    fireEvent.change(screen.getAllByTestId("issue-row-qty")[1], { target: { value: "25" } });
    expect(screen.getByTestId("issue-confirm")).toBeDisabled();
  });

  it("issues the checked lines on one RW and refreshes", async () => {
    h.issue.mockResolvedValue({ success: true, data: { documentNumber: "RW/2026/000001" } });
    await openDialog();
    fireEvent.change(screen.getByTestId("issue-recipient"), { target: { value: "Jan Kowalski" } });
    fireEvent.change(screen.getAllByTestId("issue-row-qty")[1], { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("issue-confirm"));
    await waitFor(() =>
      expect(h.issue).toHaveBeenCalledWith({
        repairOrderId: "ro1",
        recipient: "Jan Kowalski",
        note: null,
        lines: [
          { kind: "allocation", sourceId: "al1", repairOrderLineId: "rol1", quantity: 1 },
          { kind: "reservation", sourceId: "rl2", repairOrderLineId: "rol2", quantity: 12 },
        ],
      })
    );
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.toastSuccess).toHaveBeenCalledWith('issued:{"number":"RW/2026/000001"}');
  });

  it("shows the translated error and keeps the dialog on failure", async () => {
    h.issue.mockResolvedValue({ success: false, error: "not_enough" });
    await openDialog();
    fireEvent.change(screen.getByTestId("issue-recipient"), { target: { value: "Jan" } });
    fireEvent.click(screen.getByTestId("issue-confirm"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("errors.not_enough"));
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("explains when nothing is ready to issue", async () => {
    h.list.mockResolvedValue({ success: true, data: [] });
    render(<RepairOrderIssue repairOrderId="ro1" zlNumber="184213" canOperate />);
    fireEvent.click(screen.getByTestId("issue-open"));
    await waitFor(() => expect(screen.getByTestId("issue-empty")).toBeInTheDocument());
  });
});
