/**
 * @vitest-environment node
 *
 * Phase 10D — container QR server actions: permission gates and that the
 * org/target come from server context + validated input only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const CONTAINER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "org-1";
const USER_ID = "user-1";

const { mockLoadContext, mockCreateAndAssign, mockCreateClient } = vi.hoisted(() => ({
  mockLoadContext: vi.fn(),
  mockCreateAndAssign: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: () => mockLoadContext(),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/server/services/qr.service", () => ({
  QrAssignmentsService: { createAndAssign: (...args: unknown[]) => mockCreateAndAssign(...args) },
}));

import {
  createAndAssignQrToContainerAction,
  getQrAssignmentForContainerAction,
} from "../assign-container";

function context(allow: string[]) {
  return {
    app: { activeOrgId: ORG_ID },
    user: { user: { id: USER_ID }, permissionSnapshot: { allow, deny: [] } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue({});
});

describe("createAndAssignQrToContainerAction", () => {
  it("rejects a caller without qr.assign", async () => {
    mockLoadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    const result = await createAndAssignQrToContainerAction({ containerId: CONTAINER_ID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateAndAssign).not.toHaveBeenCalled();
  });

  it("rejects a caller without warehouse.inventory.operate", async () => {
    mockLoadContext.mockResolvedValue(context(["qr.assign"]));
    const result = await createAndAssignQrToContainerAction({ containerId: CONTAINER_ID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateAndAssign).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    mockLoadContext.mockResolvedValue(context(["qr.assign", "warehouse.inventory.operate"]));
    const result = await createAndAssignQrToContainerAction({ containerId: "not-a-uuid" });
    expect(result).toEqual({ success: false, error: "Invalid input" });
  });

  it("creates and assigns an inventory.container QR in the active org", async () => {
    mockLoadContext.mockResolvedValue(context(["qr.assign", "warehouse.inventory.operate"]));
    mockCreateAndAssign.mockResolvedValue({
      success: true,
      data: {
        qr: { id: "qr-1", token: "tok", label: "K-184213-01", status: "active" },
        assignment: { id: "as-1" },
      },
    });

    const result = await createAndAssignQrToContainerAction({
      containerId: CONTAINER_ID,
      label: "K-184213-01",
    });

    expect(mockCreateAndAssign).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        targetType: "inventory.container",
        targetId: CONTAINER_ID,
        assignedBy: USER_ID,
        label: "K-184213-01",
      })
    );
    expect(result).toEqual({
      success: true,
      data: {
        assignmentId: "as-1",
        qrCodeId: "qr-1",
        token: "tok",
        label: "K-184213-01",
        status: "active",
      },
    });
  });

  it("passes a service failure through unchanged", async () => {
    mockLoadContext.mockResolvedValue(context(["qr.assign", "warehouse.inventory.operate"]));
    mockCreateAndAssign.mockResolvedValue({ success: false, error: "Unauthorized" });
    const result = await createAndAssignQrToContainerAction({ containerId: CONTAINER_ID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});

describe("getQrAssignmentForContainerAction", () => {
  it("rejects an invalid container id without querying", async () => {
    const result = await getQrAssignmentForContainerAction("bad");
    expect(result).toEqual({ success: false, error: "Invalid container id" });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns null when the container has no active QR", async () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) chain[m] = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } } }) },
      from: () => chain,
    });

    const result = await getQrAssignmentForContainerAction(CONTAINER_ID);
    expect(result).toEqual({ success: true, data: null });
  });
});
