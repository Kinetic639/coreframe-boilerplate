import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PutawayScanService } from "../putaway-scan.service";

function rpcClient(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as never, rpc };
}

const input = {
  actorUserId: "u",
  organizationId: "o",
  branchId: "b",
  locationId: "loc",
  containerId: null,
  newContainerRepairOrderId: "ro",
  lines: [{ variantId: "v", quantity: 2, repairOrderLineId: "rol" }],
};

describe("PutawayScanService.putawayBatch", () => {
  it("posts the batch and maps the result", async () => {
    const { client, rpc } = rpcClient({
      data: {
        location_id: "loc",
        container_id: "c",
        container_code: "K-0042-01",
        container_created: true,
        line_count: 1,
      },
    });
    const result = await PutawayScanService.putawayBatch(client, input);
    expect(rpc).toHaveBeenCalledWith("inventory_putaway_batch", {
      p_actor_user_id: "u",
      p_organization_id: "o",
      p_branch_id: "b",
      p_location_id: "loc",
      p_container_id: null,
      p_new_container_repair_order_id: "ro",
      p_lines: [{ variant_id: "v", quantity: 2, repair_order_line_id: "rol" }],
    });
    expect(result).toEqual({
      success: true,
      data: {
        locationId: "loc",
        containerId: "c",
        containerCode: "K-0042-01",
        containerCreated: true,
        lineCount: 1,
      },
    });
  });

  it.each([
    [{ code: "42501", message: "x" }, "unauthorized"],
    [
      { code: "22023", message: "A part of another repair order cannot go into this container" },
      "mixed_orders",
    ],
    [{ code: "55000", message: "Repair order is not open" }, "order_not_open"],
    [
      { code: "22023", message: "Not enough free stock of this item in the receiving zone" },
      "not_enough",
    ],
    [
      { code: "22023", message: "Destination is not a valid stockable location in this branch" },
      "invalid_destination",
    ],
    [{ code: "P0002", message: "Container not found or not usable" }, "not_found"],
  ])("maps %o to %s", async (error, code) => {
    const { client } = rpcClient({ error });
    expect(await PutawayScanService.putawayBatch(client, input)).toEqual({
      success: false,
      error: code,
    });
  });
});
