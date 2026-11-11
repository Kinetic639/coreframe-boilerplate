import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/warehouse/internal-orders", () => ({ shipInternalOrderAction: vi.fn() }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { zwLineSquares } from "../internal-order-status";
import { destinationBranchOf } from "@/app/[locale]/dashboard/warehouse/internal-orders/_components/ship-internal-order-dialog";

const line = (over: Partial<Parameters<typeof zwLineSquares>[0]>) => ({
  quantity: 10,
  ordered: false,
  reservedQuantity: 0,
  issuedQuantity: 0,
  cancelledAt: null,
  ...over,
});

describe("zwLineSquares", () => {
  it("marks Z only for a line ordered in Ambra", () => {
    expect(zwLineSquares(line({ ordered: true })).z).toBe("full");
    expect(zwLineSquares(line({ ordered: false })).z).toBe("none");
  });

  it("fills R and W in full, half (part of the quantity) or not at all", () => {
    expect(zwLineSquares(line({ reservedQuantity: 10 })).r).toBe("full");
    expect(zwLineSquares(line({ reservedQuantity: 3 })).r).toBe("half");
    expect(zwLineSquares(line({ issuedQuantity: 0 })).w).toBe("none");
    expect(zwLineSquares(line({ issuedQuantity: 10, reservedQuantity: 0 }))).toMatchObject({
      r: "none",
      w: "full",
    });
  });

  it("a cancelled line is A and no longer Z", () => {
    expect(zwLineSquares(line({ ordered: true, cancelledAt: "2026-10-21" }))).toMatchObject({
      z: "none",
      a: "full",
    });
  });
});

describe("destinationBranchOf", () => {
  const branches = [
    { id: "b1", name: "Wysogotowo", externalCodes: ["WYSOG", "3642"] },
    { id: "b2", name: "Gołężycka", externalCodes: ["GOLEZ"] },
  ];

  it("finds the branch by the note code, then by the client's unit number", () => {
    expect(destinationBranchOf({ destinationCode: "golez", clientName: null }, branches)?.id).toBe(
      "b2"
    );
    expect(
      destinationBranchOf(
        { destinationCode: null, clientName: "3642 Blacharnia Audi (83570)" },
        branches
      )?.id
    ).toBe("b1");
    expect(
      destinationBranchOf({ destinationCode: "XYZ", clientName: "Kowalski" }, branches)
    ).toBeNull();
  });
});
