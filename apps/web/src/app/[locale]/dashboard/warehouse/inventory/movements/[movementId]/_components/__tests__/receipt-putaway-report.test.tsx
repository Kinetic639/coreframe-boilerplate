/**
 * @vitest-environment jsdom
 *
 * Zone 5 — PZ putaway report: status badge and CSV export content.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { ReceiptPutawayReport } from "../receipt-putaway-report";

const lines = [
  {
    lineNumber: 1,
    sku: "5H0807221",
    productName: "Zderzak przedni",
    quantity: 1,
    unitCode: "szt",
    zlNumber: "184213",
    putaway: [
      {
        locationCode: "ZLC-01",
        locationName: "Regał",
        quantity: 1,
        documentNumber: "MM/2026/000001",
      },
    ],
    containers: [{ code: "K-184213-02", locationCode: "ZLC-01", locationName: "Regał" }],
    pendingQuantity: 0,
  },
  {
    lineNumber: 2,
    sku: "WHT005263",
    productName: "Spinka; zestaw",
    quantity: 20,
    unitCode: "szt",
    zlNumber: "184213",
    putaway: [],
    containers: [],
    pendingQuantity: 20,
  },
];

describe("ReceiptPutawayReport", () => {
  it("shows how much still waits in the receiving zone", () => {
    render(<ReceiptPutawayReport documentNumber="PZ/2026/000010" lines={lines} />);
    expect(screen.getByTestId("receipt-report-status")).toHaveTextContent(
      'statusWaiting:{"waiting":"20","total":"21"}'
    );
    expect(screen.getAllByTestId("receipt-report-row")).toHaveLength(2);
  });

  it("shows done when nothing waits", () => {
    render(<ReceiptPutawayReport documentNumber="PZ/2026/000010" lines={[lines[0]]} />);
    expect(screen.getByTestId("receipt-report-status")).toHaveTextContent("statusDone");
  });

  it("exports a semicolon CSV with quoting and the PZ number in the file name", async () => {
    let captured: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => {
      captured = b;
      return "blob:csv";
    }) as never;
    URL.revokeObjectURL = vi.fn();
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") (el as HTMLAnchorElement).click = click;
      return el;
    });

    render(<ReceiptPutawayReport documentNumber="PZ/2026/000010" lines={lines} />);
    fireEvent.click(screen.getByTestId("receipt-report-csv"));

    expect(click).toHaveBeenCalled();
    const anchor = spy.mock.results.find((r) => (r.value as HTMLElement).tagName === "A")
      ?.value as HTMLAnchorElement;
    expect(anchor.download).toBe("PZ-2026-000010-rozlokowanie.csv");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(captured as unknown as Blob);
    });
    expect(text).toContain(
      "5H0807221;Zderzak przedni;1 szt;184213;ZLC-01 · Regał (1);K-184213-02;0"
    );
    expect(text).toContain('"Spinka; zestaw"');
    spy.mockRestore();
  });
});
