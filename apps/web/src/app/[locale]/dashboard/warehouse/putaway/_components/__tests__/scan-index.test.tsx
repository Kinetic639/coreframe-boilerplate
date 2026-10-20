/**
 * @vitest-environment jsdom
 *
 * The putaway screen's code index: a code the phone knows is answered with
 * no request; an unknown one costs ONE request to the light scan endpoint
 * (which also brings the container / location behind it) and then joins
 * the index; a sticker put on a new container is known as that container.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScanIndex } from "../scan-index";
import type { RepairOrderInfo } from "../putaway-utils";

vi.mock("@/components/features/qr/qr-camera-scanner", () => ({
  extractToken: (text: string) => text.split("/qr/")[1] ?? text,
}));

const orders: Record<string, RepairOrderInfo> = {
  ro1: {
    zlNumber: "0042",
    clientName: "Kowalski",
    vehicleBrand: "VW",
    containers: [
      {
        id: "c1",
        code: "K-0042-01",
        status: "active",
        location: { id: "l1", code: "R-01", name: "Regał" },
      },
    ],
  },
};

const qrCodes = [
  {
    id: "q-loc",
    token: "LOC1",
    assignment: { target_type: "warehouse.location", target_id: "l1" },
  },
  {
    id: "q-con",
    token: "CON1",
    assignment: { target_type: "inventory.container", target_id: "c1" },
  },
  { id: "q-free", token: "FREE1", assignment: null },
];

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function index() {
  return renderHook(() => useScanIndex({ qrCodes, organizationId: "o1", branchId: "b1", orders }))
    .result.current;
}

describe("useScanIndex", () => {
  it("answers known codes on the phone, with no request", async () => {
    const scan = index();
    const location = await scan.resolve("https://app/qr/LOC1");
    const container = await scan.resolve("CON1");
    const sticker = await scan.resolve("FREE1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(location).toMatchObject({ ok: true, local: true, lookup: { id: "q-loc" } });
    expect(container).toMatchObject({
      ok: true,
      local: true,
      container: { id: "c1", code: "K-0042-01", repairOrderId: "ro1", zlNumber: "0042" },
    });
    expect(sticker).toMatchObject({ ok: true, local: true, lookup: { assignment: null } });
  });

  it("asks the light endpoint once for an unknown code, then knows it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          lookup: { id: "q-new", token: "NEW1", label: null, status: "active", assignment: null },
        },
      }),
    });
    const scan = index();
    const first = await scan.resolve("NEW1");
    expect(first).toMatchObject({ ok: true, local: false, lookup: { id: "q-new" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/warehouse/putaway/scan?");
    expect(String(fetchMock.mock.calls[0][0])).toContain("token=NEW1");

    const again = await scan.resolve("NEW1");
    expect(again).toMatchObject({ ok: true, local: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unknown code, and a lost connection, without guessing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { lookup: null } }),
    });
    const scan = index();
    expect(await scan.resolve("NOPE")).toEqual({ ok: false, reason: "notFound" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await scan.resolve("NOPE2")).toEqual({ ok: false, reason: "offline" });
  });

  it("a sticker bound to a new container is known as that container", async () => {
    const scan = index();
    scan.bindSticker("q-free", "c1");
    expect(await scan.resolve("FREE1")).toMatchObject({
      ok: true,
      local: true,
      container: { id: "c1" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
