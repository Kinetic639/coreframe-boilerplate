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
    verifyImageTarget: vi.fn(),
    addImageRecord: vi.fn(),
    assignExistingImageToVariant: vi.fn(),
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
    createDraft: vi.fn(),
    finalizePosting: vi.fn(),
    cancelMovement: vi.fn(),
    listMovements: vi.fn(),
    getMovementDetail: vi.fn(),
  },
}));

import {
  assignInventoryVariantGalleryImageAction,
  adjustStockAction,
  createEnhancedInventoryProductAction,
  createInventoryProductAction,
  createInventoryUnitAction,
  issueStockAction,
  receiveStockAction,
  reverseMovementAction,
  transferStockAction,
  uploadInventoryItemImageAction,
} from "../index";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { eventService } from "@/server/services/event.service";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_OPERATE,
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
const IMAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
  vi.mocked(InventoryMovementsService.createDraft).mockResolvedValue({
    success: true,
    data: { movement_id: MOVEMENT_ID, draft_number: "DRF-000001", status: "draft" },
  });
  vi.mocked(InventoryMovementsService.finalizePosting).mockResolvedValue({
    success: true,
    data: { movement_id: MOVEMENT_ID, document_number: "INV-000001", status: "posted" },
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
    expect(InventoryMovementsService.createDraft).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({
        movement_type_code: "101",
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
    const input = vi.mocked(InventoryMovementsService.createDraft).mock.calls[0][3];
    expect(input.lines[0]).not.toHaveProperty("product_id");
    expect(InventoryMovementsService.finalizePosting).toHaveBeenCalledWith(
      expect.anything(),
      MOVEMENT_ID,
      USER_ID
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
    expect(InventoryMovementsService.createDraft).not.toHaveBeenCalled();
    expect(InventoryMovementsService.finalizePosting).not.toHaveBeenCalled();
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

    expect(InventoryMovementsService.createDraft).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({
        movement_type_code: "801",
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

  it("adjustStockAction returns not-available stub", async () => {
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

    expect(result.success).toBe(false);
    expect(InventoryMovementsService.createDraft).not.toHaveBeenCalled();
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
    expect(InventoryMovementsService.createDraft).not.toHaveBeenCalled();
  });
});

describe("inventory product image actions", () => {
  function pngFile(name = "part.png", type = "image/png") {
    return new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
      name,
      { type }
    );
  }

  function formDataFor(file: File) {
    const formData = new FormData();
    formData.set("product_id", PRODUCT_ID);
    formData.set("file", file);
    return formData;
  }

  it("uploadInventoryItemImageAction rejects files whose MIME does not match image bytes", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    const upload = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload })) },
    } as never);

    const result = await uploadInventoryItemImageAction(
      formDataFor(pngFile("fake.jpg", "image/jpeg"))
    );

    expect(result.success).toBe(false);
    expect("error" in result ? result.error : "").toContain("does not match");
    expect(upload).not.toHaveBeenCalled();
    expect(InventoryProductsService.verifyImageTarget).not.toHaveBeenCalled();
  });

  it("uploadInventoryItemImageAction removes uploaded storage object when DB record fails", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(InventoryProductsService.verifyImageTarget).mockResolvedValue({
      success: true,
      data: { product_id: PRODUCT_ID, variant_id: null },
    });
    vi.mocked(InventoryProductsService.addImageRecord).mockResolvedValue({
      success: false,
      error: "db failed",
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example/image.png" } }));
    vi.mocked(createClient).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, remove, getPublicUrl })) },
    } as never);

    const result = await uploadInventoryItemImageAction(formDataFor(pngFile()));

    expect(result).toEqual({ success: false, error: "db failed" });
    expect(upload).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith([
      expect.stringContaining(`${ORG_ID}/${PRODUCT_ID}/product/`),
    ]);
  });

  it("uploadInventoryItemImageAction emits an image upload audit event after DB record success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(InventoryProductsService.verifyImageTarget).mockResolvedValue({
      success: true,
      data: { product_id: PRODUCT_ID, variant_id: null },
    });
    vi.mocked(InventoryProductsService.addImageRecord).mockResolvedValue({
      success: true,
      data: {
        id: IMAGE_ID,
        storage_path: "org/product/image.png",
        public_url: "https://cdn.example/image.png",
        file_name: "part.png",
        content_type: "image/png",
        file_size: 9,
      },
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example/image.png" } }));
    vi.mocked(createClient).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, remove, getPublicUrl })) },
    } as never);

    const result = await uploadInventoryItemImageAction(formDataFor(pngFile()));

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "warehouse.inventory.product.image.uploaded",
        entityType: "inventory_product_image",
        entityId: IMAGE_ID,
        metadata: expect.objectContaining({
          product_id: PRODUCT_ID,
          image_id: IMAGE_ID,
          file_name: "part.png",
          content_type: "image/png",
        }),
      })
    );
  });

  it("assignInventoryVariantGalleryImageAction assigns an existing org-owned image by id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(createClient).mockResolvedValue({ client: "supabase" } as never);
    vi.mocked(InventoryProductsService.assignExistingImageToVariant).mockResolvedValue({
      success: true,
      data: {
        id: IMAGE_ID,
        storage_path: "org/product/image.png",
        public_url: "https://cdn.example/image.png",
        file_name: "image.png",
        content_type: "image/png",
        file_size: 9,
      },
    });

    const result = await assignInventoryVariantGalleryImageAction({
      product_id: PRODUCT_ID,
      variant_id: VARIANT_ID,
      image_id: IMAGE_ID,
      is_primary: true,
      sort_order: 2,
    });

    expect(result.success).toBe(true);
    expect(InventoryProductsService.assignExistingImageToVariant).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        product_id: PRODUCT_ID,
        variant_id: VARIANT_ID,
        image_id: IMAGE_ID,
        is_primary: true,
        sort_order: 2,
        actor_user_id: USER_ID,
      })
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "warehouse.inventory.product.image.assigned",
        entityType: "inventory_product_image",
        entityId: IMAGE_ID,
        metadata: expect.objectContaining({
          product_id: PRODUCT_ID,
          variant_id: VARIANT_ID,
          image_id: IMAGE_ID,
        }),
      })
    );
  });
});

describe("inventory settings actions", () => {
  it("createInventoryUnitAction emits a settings audit event", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([WAREHOUSE_PRODUCTS_MANAGE]) as never
    );
    vi.mocked(InventoryProductsService.createUnit).mockResolvedValue({
      success: true,
      data: { id: UNIT_ID, code: "PCS", name: "pieces" },
    });

    const result = await createInventoryUnitAction({
      code: "PCS",
      name: "pieces",
      unit_kind: "count",
      precision: 0,
    });

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "warehouse.inventory.settings.unit.created",
        entityType: "inventory_unit",
        entityId: UNIT_ID,
        metadata: expect.objectContaining({
          unit_id: UNIT_ID,
          code: "PCS",
          unit_kind: "count",
        }),
      })
    );
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

  it("reverseMovementAction returns not-available stub", async () => {
    const result = await reverseMovementAction({ id: MOVEMENT_ID, note: "Correction" });

    expect(result.success).toBe(false);
  });
});
