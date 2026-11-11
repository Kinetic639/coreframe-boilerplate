/**
 * @vitest-environment node
 */
// IC-4 correction pass (section C): the "partial" audit-event flag must
// reflect the canonical RPC's own result status, never the shape of the
// caller's own input payload. An explicit line_acceptances payload can
// still fully accept every line; a NULL payload always means full accept.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ client: "supabase" }),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("@/server/services/inventory-enterprise.service", () => ({
  InventoryEnterpriseService: {
    acceptBranchTransfer: vi.fn(),
  },
}));

import { acceptInventoryBranchTransferAction } from "../index";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { eventService } from "@/server/services/event.service";
import { InventoryEnterpriseService } from "@/server/services/inventory-enterprise.service";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const TRANSFER_ID = "44444444-4444-4444-8444-444444444444";
const DEST_LOCATION_ID = "55555555-5555-4555-8555-555555555555";
const LINE_ID = "66666666-6666-4666-8666-666666666666";

function makeContext() {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: BRANCH_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: {
        allow: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_READ, WAREHOUSE_INVENTORY_OPERATE],
        deny: [],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
});

describe("acceptInventoryBranchTransferAction — partial event metadata reflects RPC result", () => {
  it("explicit full-quantity payload -> RPC status=accepted -> event partial=false", async () => {
    vi.mocked(InventoryEnterpriseService.acceptBranchTransfer).mockResolvedValue({
      success: true,
      data: { transfer_id: TRANSFER_ID, status: "accepted", destination_movement_id: "mv-1" },
    });

    const result = await acceptInventoryBranchTransferAction({
      id: TRANSFER_ID,
      destination_location_id: DEST_LOCATION_ID,
      line_acceptances: [{ transfer_line_id: LINE_ID, accepted_quantity: 5 }],
    });

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ partial: false }),
      })
    );
  });

  it("explicit shortage payload -> RPC status=partially_accepted -> event partial=true", async () => {
    vi.mocked(InventoryEnterpriseService.acceptBranchTransfer).mockResolvedValue({
      success: true,
      data: {
        transfer_id: TRANSFER_ID,
        status: "partially_accepted",
        destination_movement_id: "mv-2",
      },
    });

    const result = await acceptInventoryBranchTransferAction({
      id: TRANSFER_ID,
      destination_location_id: DEST_LOCATION_ID,
      line_acceptances: [{ transfer_line_id: LINE_ID, accepted_quantity: 2 }],
    });

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ partial: true }),
      })
    );
  });

  it("NULL line_acceptances (ordinary full accept) -> RPC status=accepted -> event partial=false", async () => {
    vi.mocked(InventoryEnterpriseService.acceptBranchTransfer).mockResolvedValue({
      success: true,
      data: { transfer_id: TRANSFER_ID, status: "accepted", destination_movement_id: "mv-3" },
    });

    const result = await acceptInventoryBranchTransferAction({
      id: TRANSFER_ID,
      destination_location_id: DEST_LOCATION_ID,
    });

    expect(result.success).toBe(true);
    expect(InventoryEnterpriseService.acceptBranchTransfer).toHaveBeenCalledWith(
      expect.anything(),
      TRANSFER_ID,
      DEST_LOCATION_ID,
      USER_ID,
      null
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ partial: false }),
      })
    );
  });

  it("a 100%%-missing accept (status=partially_accepted, destination_movement_id=null) still reports partial=true", async () => {
    vi.mocked(InventoryEnterpriseService.acceptBranchTransfer).mockResolvedValue({
      success: true,
      data: {
        transfer_id: TRANSFER_ID,
        status: "partially_accepted",
        destination_movement_id: null,
      },
    });

    const result = await acceptInventoryBranchTransferAction({
      id: TRANSFER_ID,
      destination_location_id: DEST_LOCATION_ID,
      line_acceptances: [{ transfer_line_id: LINE_ID, accepted_quantity: 0 }],
    });

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ partial: true }),
      })
    );
  });
});
