/**
 * @vitest-environment node
 */

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

vi.mock("@/server/services/inventory-products.service", () => ({
  InventoryProductsService: {
    createProduct: vi.fn(),
    createEnhancedProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    createUnit: vi.fn(),
    listProducts: vi.fn(),
    getProductDetail: vi.fn(),
    listUnits: vi.fn(),
  },
}));

vi.mock("@/server/services/inventory-balances.service", () => ({
  InventoryBalancesService: {
    listBalances: vi.fn(),
    getBalanceDetail: vi.fn(),
  },
}));

vi.mock("@/server/services/inventory-movements.service", () => ({
  InventoryMovementsService: {
    createDraftMovement: vi.fn(),
    postMovement: vi.fn(),
    reverseMovement: vi.fn(),
    listMovements: vi.fn(),
    getMovementDetail: vi.fn(),
  },
}));

import {
  adjustStockAction,
  createEnhancedInventoryProductAction,
  createInventoryProductAction,
  issueStockAction,
  receiveStockAction,
  reverseMovementAction,
  transferStockAction,
} from "../index";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { eventService } from "@/server/services/event.service";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_REVERSE,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";
const UNIT_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_LOCATION_ID = "66666666-6666-4666-8666-666666666666";
const DESTINATION_LOCATION_ID = "77777777-7777-4777-8777-777777777777";
const MOVEMENT_ID = "88888888-8888-4888-8888-888888888888";
const PRODUCT_ID = "99999999-9999-4999-8999-999999999999";

const BASE_PERMS = [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_READ];

function makeContext(allow: string[] = [], branchId: string | null = BRANCH_ID) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: branchId },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: [...BASE_PERMS, ...allow], deny: [] },
    },
  };
}

function mockDraftAndPost() {
  vi.mocked(InventoryMovementsService.createDraftMovement).mockResolvedValue({
    success: true,
    data: { movement_id: MOVEMENT_ID, movement_number: "INV-000001", status: "draft" },
  });
  vi.mocked(InventoryMovementsService.postMovement).mockResolvedValue({
    success: true,
    data: { movement_id: MOVEMENT_ID, movement_number: "INV-000001", status: "posted" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
  mockDraftAndPost();
});

describe("inventory operation actions", () => {
  it("receiveStockAction creates and posts a receipt movement without product_id on lines", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_OPERATE]) as never
    );

    const result = await receiveStockAction({
      variant_id: VARIANT_ID,
      destination_location_id: DESTINATION_LOCATION_ID,
      unit_id: UNIT_ID,
      quantity: 5,
    });

    expect(result.success).toBe(true);
    expect(InventoryMovementsService.createDraftMovement).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({
        movement_kind: "receipt",
        lines: [
          {
            variant_id: VARIANT_ID,
            destination_location_id: DESTINATION_LOCATION_ID,
            unit_id: UNIT_ID,
            quantity: 5,
          },
        ],
      }),
      USER_ID
    );
    const input = vi.mocked(InventoryMovementsService.createDraftMovement).mock.calls[0][3];
    expect(input.lines[0]).not.toHaveProperty("product_id");
    expect(InventoryMovementsService.postMovement).toHaveBeenCalledWith(
      expect.anything(),
      MOVEMENT_ID,
      USER_ID
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.movement.posted" })
    );
  });

  it("issueStockAction requires inventory operate permission and does not call services when denied", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext([]) as never);

    const result = await issueStockAction({
      variant_id: VARIANT_ID,
      source_location_id: SOURCE_LOCATION_ID,
      unit_id: UNIT_ID,
      quantity: 1,
    });

    expect(result.success).toBe(false);
    expect(InventoryMovementsService.createDraftMovement).not.toHaveBeenCalled();
    expect(InventoryMovementsService.postMovement).not.toHaveBeenCalled();
  });

  it("transferStockAction scopes movements to the active branch from context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_OPERATE]) as never
    );

    await transferStockAction({
      variant_id: VARIANT_ID,
      source_location_id: SOURCE_LOCATION_ID,
      destination_location_id: DESTINATION_LOCATION_ID,
      unit_id: UNIT_ID,
      quantity: 2,
    });

    expect(InventoryMovementsService.createDraftMovement).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({
        movement_kind: "transfer",
        lines: [
          {
            variant_id: VARIANT_ID,
            source_location_id: SOURCE_LOCATION_ID,
            destination_location_id: DESTINATION_LOCATION_ID,
            unit_id: UNIT_ID,
            quantity: 2,
          },
        ],
      }),
      USER_ID
    );
  });

  it("adjustStockAction uses explicit adjustment_direction and positive quantity magnitude", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_ADJUST]) as never
    );

    const result = await adjustStockAction({
      variant_id: VARIANT_ID,
      location_id: SOURCE_LOCATION_ID,
      unit_id: UNIT_ID,
      adjustment_direction: "decrease",
      quantity: 3,
    });

    expect(result.success).toBe(true);
    expect(InventoryMovementsService.createDraftMovement).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({
        movement_kind: "adjustment",
        adjustment_direction: "decrease",
        lines: [
          {
            variant_id: VARIANT_ID,
            source_location_id: SOURCE_LOCATION_ID,
            destination_location_id: null,
            unit_id: UNIT_ID,
            quantity: 3,
          },
        ],
      }),
      USER_ID
    );
  });

  it("adjustStockAction rejects negative quantities before the movement service is called", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_ADJUST]) as never
    );

    const result = await adjustStockAction({
      variant_id: VARIANT_ID,
      location_id: SOURCE_LOCATION_ID,
      unit_id: UNIT_ID,
      adjustment_direction: "decrease",
      quantity: -1,
    });

    expect(result.success).toBe(false);
    expect(InventoryMovementsService.createDraftMovement).not.toHaveBeenCalled();
  });

  it("operation actions require an active branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_OPERATE], null) as never
    );

    const result = await receiveStockAction({
      variant_id: VARIANT_ID,
      destination_location_id: DESTINATION_LOCATION_ID,
      unit_id: UNIT_ID,
      quantity: 1,
    });

    expect(result.success).toBe(false);
    expect(InventoryMovementsService.createDraftMovement).not.toHaveBeenCalled();
  });
});

describe("inventory product and reversal actions", () => {
  it("createInventoryProductAction delegates default variant creation and emits an audit event", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(InventoryProductsService.createProduct).mockResolvedValue({
      success: true,
      data: { product_id: PRODUCT_ID, variant_id: VARIANT_ID, sku: "SKU-000001" },
    });

    const result = await createInventoryProductAction({
      name: "Widget",
      product_type: "stocked",
      base_unit_id: UNIT_ID,
    });

    expect(result.success).toBe(true);
    expect(InventoryProductsService.createProduct).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        name: "Widget",
        product_type: "stocked",
        base_unit_id: UNIT_ID,
        sku: null,
      }),
      USER_ID
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "warehouse.inventory.product.created",
        entityId: PRODUCT_ID,
      })
    );
  });

  it("createEnhancedInventoryProductAction delegates enhanced creation and scopes branch-aware data", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(InventoryProductsService.createEnhancedProduct).mockResolvedValue({
      success: true,
      data: { product_id: PRODUCT_ID, variant_ids: [VARIANT_ID], sku: "SKU-1" },
    });

    const result = await createEnhancedInventoryProductAction({
      name: "Brake pad",
      product_type: "stocked",
      base_unit_id: UNIT_ID,
      variants: [{ name: "Brake pad", sku: "SKU-1" }],
      track_inventory: true,
    });

    expect(result.success).toBe(true);
    expect(InventoryProductsService.createEnhancedProduct).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        name: "Brake pad",
        branch_id: BRANCH_ID,
        variants: [expect.objectContaining({ sku: "SKU-1" })],
      }),
      USER_ID
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "warehouse.inventory.product.created",
        eventTier: "enhanced",
        entityId: PRODUCT_ID,
      })
    );
  });

  it("createEnhancedInventoryProductAction requires inventory operate permission for opening stock", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );

    const result = await createEnhancedInventoryProductAction({
      name: "Brake pad",
      product_type: "stocked",
      base_unit_id: UNIT_ID,
      opening_location_id: DESTINATION_LOCATION_ID,
      variants: [{ name: "Brake pad", sku: "SKU-1", opening_quantity: 1 }],
      track_inventory: true,
    });

    expect(result.success).toBe(false);
    expect(InventoryProductsService.createEnhancedProduct).not.toHaveBeenCalled();
  });

  it("reverseMovementAction requires reverse permission and emits an audit event", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_INVENTORY_REVERSE]) as never
    );
    vi.mocked(InventoryMovementsService.reverseMovement).mockResolvedValue({
      success: true,
      data: { movement_id: MOVEMENT_ID, movement_number: "INV-000002", status: "posted" },
    });

    const result = await reverseMovementAction({ id: MOVEMENT_ID, note: "Correction" });

    expect(result.success).toBe(true);
    expect(InventoryMovementsService.reverseMovement).toHaveBeenCalledWith(
      expect.anything(),
      MOVEMENT_ID,
      USER_ID,
      "Correction"
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.movement.reversed" })
    );
  });
});
