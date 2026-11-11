/**
 * @vitest-environment node
 *
 * Phase 10E — relocateContainerAction: permission gate, input validation,
 * and that org/branch/actor come from server context and the container row.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const CONTAINER_ID = "11111111-1111-4111-8111-111111111111";
const DEST_ID = "22222222-2222-4222-8222-222222222222";

const h = vi.hoisted(() => ({
  loadContext: vi.fn(),
  getDetail: vi.fn(),
  relocate: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: () => h.loadContext(),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => Promise.resolve({}) }));
vi.mock("@/server/services/inventory-containers.service", () => ({
  InventoryContainersService: {
    getDetail: (...args: unknown[]) => h.getDetail(...args),
    relocate: (...args: unknown[]) => h.relocate(...args),
  },
}));

import { relocateContainerAction } from "../relocate-container";

function context(allow: string[], activeBranchId = "branch-1") {
  return {
    app: { activeOrgId: "org-1", activeBranchId },
    user: { user: { id: "user-1" }, permissionSnapshot: { allow, deny: [] } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getDetail.mockResolvedValue({
    success: true,
    data: { id: CONTAINER_ID, branchId: "branch-1" },
  });
});

describe("relocateContainerAction", () => {
  it("rejects a caller without warehouse.inventory.operate", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"]));
    const result = await relocateContainerAction({
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(h.relocate).not.toHaveBeenCalled();
  });

  it("rejects invalid ids", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    const result = await relocateContainerAction({
      containerId: "x",
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({ success: false, error: "invalid_input" });
  });

  it("treats a container outside the active branch as not found", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"], "branch-2"));
    const result = await relocateContainerAction({
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({ success: false, error: "not_found" });
    expect(h.relocate).not.toHaveBeenCalled();
  });

  it("treats an unreadable container as not found", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.getDetail.mockResolvedValue({ success: true, data: null });
    const result = await relocateContainerAction({
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({ success: false, error: "not_found" });
  });

  it("relocates with org from context, branch from the container and the caller as actor", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.relocate.mockResolvedValue({
      success: true,
      data: { containerId: CONTAINER_ID, movementId: "mv-1" },
    });
    const result = await relocateContainerAction({
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(h.relocate).toHaveBeenCalledWith(expect.anything(), {
      actorUserId: "user-1",
      organizationId: "org-1",
      branchId: "branch-1",
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({
      success: true,
      data: { containerId: CONTAINER_ID, movementId: "mv-1" },
    });
  });

  it("passes the service's error code through", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.relocate.mockResolvedValue({ success: false, error: "same_location" });
    const result = await relocateContainerAction({
      containerId: CONTAINER_ID,
      destinationLocationId: DEST_ID,
    });
    expect(result).toEqual({ success: false, error: "same_location" });
  });
});
