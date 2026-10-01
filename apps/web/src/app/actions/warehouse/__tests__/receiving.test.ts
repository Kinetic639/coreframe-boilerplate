/**
 * @vitest-environment node
 *
 * Zone 5 — receiving/putaway actions: permission gates, input validation and
 * that org/branch/actor come from server context only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const VARIANT = "11111111-1111-4111-8111-111111111111";
const DEST = "22222222-2222-4222-8222-222222222222";
const ROL = "33333333-3333-4333-8333-333333333333";
const PRODUCT = "44444444-4444-4444-8444-444444444444";

const h = vi.hoisted(() => ({
  loadContext: vi.fn(),
  listPending: vi.fn(),
  putaway: vi.fn(),
  saveSettings: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: () => h.loadContext(),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => Promise.resolve({}) }));
vi.mock("@/server/services/inventory-receiving.service", () => ({
  InventoryReceivingService: {
    listPending: (...a: unknown[]) => h.listPending(...a),
    putaway: (...a: unknown[]) => h.putaway(...a),
    saveProductSettings: (...a: unknown[]) => h.saveSettings(...a),
    getProductSettings: (...a: unknown[]) => h.getSettings(...a),
  },
}));

import {
  listReceivingPendingAction,
  putawayFromReceivingAction,
  saveProductHandlingAction,
} from "../receiving";

function context(allow: string[], activeBranchId: string | null = "branch-1") {
  return {
    app: { activeOrgId: "org-1", activeBranchId },
    user: { user: { id: "user-1" }, permissionSnapshot: { allow, deny: [] } },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("listReceivingPendingAction", () => {
  it("requires warehouse.inventory.read", async () => {
    h.loadContext.mockResolvedValue(context([]));
    expect(await listReceivingPendingAction()).toEqual({ success: false, error: "Unauthorized" });
    expect(h.listPending).not.toHaveBeenCalled();
  });

  it("requires an active branch", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"], null));
    expect(await listReceivingPendingAction()).toEqual({ success: false, error: "Unauthorized" });
  });

  it("lists the active branch's receiving zone", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"]));
    h.listPending.mockResolvedValue({
      success: true,
      data: { receivingLocationId: "prz", items: [] },
    });
    await listReceivingPendingAction();
    expect(h.listPending).toHaveBeenCalledWith(expect.anything(), "org-1", "branch-1");
  });
});

describe("putawayFromReceivingAction", () => {
  const input = {
    variantId: VARIANT,
    quantity: 2,
    destinationLocationId: DEST,
    repairOrderLineId: ROL,
  };

  it("requires warehouse.inventory.operate", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"]));
    expect(await putawayFromReceivingAction(input)).toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(h.putaway).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    expect(await putawayFromReceivingAction({ ...input, quantity: 0 })).toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("puts away with identity from server context", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.putaway.mockResolvedValue({ success: true, data: { mode: "container" } });
    const result = await putawayFromReceivingAction(input);
    expect(h.putaway).toHaveBeenCalledWith(expect.anything(), {
      actorUserId: "user-1",
      organizationId: "org-1",
      branchId: "branch-1",
      variantId: VARIANT,
      quantity: 2,
      destinationLocationId: DEST,
      repairOrderLineId: ROL,
    });
    expect(result).toEqual({ success: true, data: { mode: "container" } });
  });

  it("passes the service error code through", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.putaway.mockResolvedValue({ success: false, error: "not_enough" });
    expect(await putawayFromReceivingAction({ ...input, repairOrderLineId: null })).toEqual({
      success: false,
      error: "not_enough",
    });
  });
});

describe("saveProductHandlingAction", () => {
  it("requires warehouse.products.manage", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    expect(
      await saveProductHandlingAction({
        productId: PRODUCT,
        handlingMode: "bulk",
        defaultLocationId: null,
      })
    ).toEqual({ success: false, error: "Unauthorized" });
    expect(h.saveSettings).not.toHaveBeenCalled();
  });

  it("saves for the active branch", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.products.manage"]));
    h.saveSettings.mockResolvedValue({ success: true, data: {} });
    await saveProductHandlingAction({
      productId: PRODUCT,
      handlingMode: "bulk",
      defaultLocationId: DEST,
    });
    expect(h.saveSettings).toHaveBeenCalledWith(expect.anything(), {
      organizationId: "org-1",
      branchId: "branch-1",
      actorUserId: "user-1",
      productId: PRODUCT,
      handlingMode: "bulk",
      defaultLocationId: DEST,
    });
  });

  it("rejects an unknown handling mode", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.products.manage"]));
    expect(
      await saveProductHandlingAction({
        productId: PRODUCT,
        handlingMode: "loose",
        defaultLocationId: null,
      })
    ).toEqual({ success: false, error: "Invalid input" });
  });
});
