/**
 * @vitest-environment node
 *
 * Stages E4/E5 — InventoryReservationsService / InventoryBlocksService: RPC
 * arguments, result mapping and the stable error codes the UI translates.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  InventoryReservationsService,
  mapStockEngineError,
} from "../inventory-reservations.service";
import { InventoryBlocksService } from "../inventory-blocks.service";

function rpcClient(result: { data?: unknown; error?: { code?: string; message: string } }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as never, rpc };
}

const scope = { actorUserId: "u1", organizationId: "org", branchId: "br" };

describe("mapStockEngineError", () => {
  it.each([
    [{ code: "42501", message: "Missing warehouse.inventory.operate permission" }, "unauthorized"],
    [{ code: "28000", message: "p_actor_user_id must match" }, "unauthorized"],
    [{ code: "P0002", message: "Reservation not found" }, "not_found"],
    [{ code: "55000", message: "Repair order is not open" }, "not_open"],
    [{ code: "P0003", message: "Movement would strand committed stock" }, "insufficient_stock"],
    [
      {
        code: "22023",
        message: "Insufficient available stock to reserve (available 1, requested 2)",
      },
      "insufficient_stock",
    ],
    [
      { code: "22023", message: "A reason is required to release a reservation" },
      "reason_required",
    ],
    [{ code: "22023", message: "Line 1: the repair order still needs only 2" }, "exceeds_need"],
    [{ code: "22023", message: "The target line is for a different part" }, "wrong_part"],
    [
      {
        code: "22023",
        message:
          "Line 1: only 0 can be released (parts already in a container are taken out of it first)",
      },
      "in_container",
    ],
    [{ code: "22023", message: "Line 1 quantity must be positive" }, "invalid_request"],
    [{ code: "XX000", message: "boom" }, "failed"],
  ])("%o -> %s", (error, code) => {
    expect(mapStockEngineError(error)).toBe(code);
  });
});

describe("InventoryReservationsService", () => {
  it("reserveForRepairOrder sends one document's lines and maps the result", async () => {
    const { client, rpc } = rpcClient({
      data: {
        reservation_id: "r1",
        reservation_number: "REZ/2026/000100",
        lines: [
          {
            reservation_line_id: "rl1",
            repair_order_line_id: "rol1",
            location_id: "l1",
            quantity: "2",
          },
        ],
      },
    });
    const result = await InventoryReservationsService.reserveForRepairOrder(client, {
      ...scope,
      repairOrderId: "ro1",
      lines: [{ repairOrderLineId: "rol1", locationId: "l1", quantity: 2 }],
    });
    expect(rpc).toHaveBeenCalledWith("inventory_reserve_for_repair_order", {
      p_actor_user_id: "u1",
      p_organization_id: "org",
      p_branch_id: "br",
      p_repair_order_id: "ro1",
      p_lines: [{ repair_order_line_id: "rol1", location_id: "l1", quantity: 2, variant_id: null }],
      p_reason: null,
    });
    expect(result).toEqual({
      success: true,
      data: {
        reservationId: "r1",
        reservationNumber: "REZ/2026/000100",
        lines: [
          { reservationLineId: "rl1", repairOrderLineId: "rol1", locationId: "l1", quantity: 2 },
        ],
      },
    });
  });

  it("releaseLines passes the reason and a null quantity for 'all that is left'", async () => {
    const { client, rpc } = rpcClient({ data: { released_quantity: 3 } });
    const result = await InventoryReservationsService.releaseLines(client, {
      ...scope,
      lines: [{ reservationLineId: "rl1" }],
      reason: "Klient zrezygnował",
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_lines: [{ reservation_line_id: "rl1", quantity: null }],
      p_reason: "Klient zrezygnował",
    });
    expect(result).toEqual({ success: true, data: { releasedQuantity: 3 } });
  });

  it("transfer maps an engine refusal to a stable code and keeps the message", async () => {
    const { client } = rpcClient({
      error: { code: "22023", message: "The target repair order still needs only 1" },
    });
    const result = await InventoryReservationsService.transfer(client, {
      ...scope,
      reservationLineId: "rl1",
      quantity: 2,
      targetRepairOrderLineId: "rol2",
      reason: "Pilne",
    });
    expect(result).toEqual({
      success: false,
      error: "exceeds_need",
      message: "The target repair order still needs only 1",
    });
  });
});

describe("InventoryBlocksService", () => {
  it("block sends the reason code, reference and lines (a reserved part by its reservation line)", async () => {
    const { client, rpc } = rpcClient({
      data: {
        block_id: "b1",
        block_number: "BLK/2026/000001",
        lines: [
          {
            block_line_id: "bl1",
            variant_id: "v1",
            location_id: "l1",
            quantity: 1,
            released_reservation_line_id: "rl1",
          },
        ],
      },
    });
    const result = await InventoryBlocksService.block(client, {
      ...scope,
      reasonCode: "supplier_complaint",
      reference: { type: "helpdesk_ticket", number: "HD-0087" },
      lines: [{ quantity: 1, reservationLineId: "rl1" }],
    });
    expect(rpc).toHaveBeenCalledWith("inventory_block_stock", {
      p_actor_user_id: "u1",
      p_organization_id: "org",
      p_branch_id: "br",
      p_lines: [{ quantity: 1, variant_id: null, location_id: null, reservation_line_id: "rl1" }],
      p_reason_code: "supplier_complaint",
      p_description: null,
      p_reference_type: "helpdesk_ticket",
      p_reference_id: null,
      p_reference_number: "HD-0087",
    });
    expect(result.success && result.data.lines[0].releasedReservationLineId).toBe("rl1");
  });

  it("issue sends the exit kind and maps the posted document", async () => {
    const { client, rpc } = rpcClient({
      data: { movement_id: "m1", document_number: "ZWD/2026/000001", movement_type_code: "122" },
    });
    const result = await InventoryBlocksService.issue(client, {
      ...scope,
      kind: "return_to_supplier",
      lines: [{ blockLineId: "bl1" }],
      reason: "Reklamacja uznana",
      counterpartyName: "Inter Cars",
    });
    expect(rpc.mock.calls[0][0]).toBe("inventory_issue_blocked_stock");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_kind: "return_to_supplier",
      p_lines: [{ block_line_id: "bl1", quantity: null }],
      p_counterparty_name: "Inter Cars",
    });
    expect(result).toEqual({
      success: true,
      data: { movementId: "m1", documentNumber: "ZWD/2026/000001", movementTypeCode: "122" },
    });
  });

  it("unblock refusal without a reason maps to reason_required", async () => {
    const { client } = rpcClient({
      error: { code: "22023", message: "A reason is required to unblock stock" },
    });
    const result = await InventoryBlocksService.unblock(client, {
      ...scope,
      lines: [{ blockLineId: "bl1" }],
      reason: " ",
    });
    expect(result).toMatchObject({ success: false, error: "reason_required" });
  });
});
