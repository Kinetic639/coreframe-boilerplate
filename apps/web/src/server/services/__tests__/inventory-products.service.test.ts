/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { InventoryProductsService } from "../inventory-products.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const VARIANT_ID = "33333333-3333-4333-8333-333333333333";
const UNIT_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

type Operation = {
  table: string;
  action: string;
  payload?: Record<string, unknown>;
};

function createChain(
  table: string,
  operations: Operation[],
  state: { failOptionGroupRead?: boolean }
) {
  const chain = {
    data: table === "inventory_option_groups" ? [] : null,
    error: null as { message: string } | null,
    update(payload: Record<string, unknown>) {
      operations.push({ table, action: "update", payload });
      return chain;
    },
    insert(payload: Record<string, unknown>) {
      operations.push({ table, action: "insert", payload });
      return chain;
    },
    select() {
      operations.push({ table, action: "select" });
      if (table === "inventory_option_groups" && state.failOptionGroupRead) {
        chain.error = { message: "option group read failed" };
      }
      return chain;
    },
    eq() {
      return chain;
    },
    is() {
      return chain;
    },
    in() {
      return chain;
    },
    order() {
      return chain;
    },
    single() {
      return chain;
    },
    maybeSingle() {
      return chain;
    },
    upsert(payload: Record<string, unknown>) {
      operations.push({ table, action: "upsert", payload });
      return chain;
    },
  };
  return chain;
}

function createSupabaseMock(state: { failOptionGroupRead?: boolean } = {}) {
  const operations: Operation[] = [];
  return {
    operations,
    client: {
      rpc: vi.fn().mockResolvedValue({
        data: { product_id: PRODUCT_ID, variant_id: VARIANT_ID, sku: "SKU-1" },
        error: null,
      }),
      from: vi.fn((table: string) => createChain(table, operations, state)),
    },
  };
}

describe("InventoryProductsService.createEnhancedProduct", () => {
  it("creates the catalog through the transactional enhanced product RPC", async () => {
    const supabase = createSupabaseMock();
    supabase.client.rpc = vi.fn().mockResolvedValue({
      data: { product_id: PRODUCT_ID, variant_ids: [VARIANT_ID], sku: "SKU-1" },
      error: null,
    });

    const result = await InventoryProductsService.createEnhancedProduct(
      supabase.client as never,
      ORG_ID,
      {
        name: "Brake pad",
        product_type: "stocked",
        base_unit_id: UNIT_ID,
        sku: "SKU-1",
        attributes: [{ name: "Color", values: ["Black"] }],
        variants: [{ name: "Brake pad - Black", sku: "SKU-1", options: { Color: "Black" } }],
      },
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(supabase.client.rpc).toHaveBeenCalledWith(
      "inventory_create_enhanced_product",
      expect.objectContaining({
        p_organization_id: ORG_ID,
        p_actor_user_id: USER_ID,
        p_attributes: [{ name: "Color", values: ["Black"] }],
      })
    );
  });
});

describe("InventoryProductsService image ownership helpers", () => {
  function createImageSupabaseMock(state: {
    productExists?: boolean;
    variantExists?: boolean;
    sourceImage?: Record<string, unknown> | null;
    insertedImage?: Record<string, unknown>;
  }) {
    const operations: Operation[] = [];
    const client = {
      from: vi.fn((table: string) => {
        const chain = {
          update(payload: Record<string, unknown>) {
            operations.push({ table, action: "update", payload });
            return chain;
          },
          insert(payload: Record<string, unknown>) {
            operations.push({ table, action: "insert", payload });
            return chain;
          },
          select() {
            operations.push({ table, action: "select" });
            return chain;
          },
          eq() {
            return chain;
          },
          is() {
            return chain;
          },
          maybeSingle() {
            if (table === "inventory_products") {
              return {
                data: state.productExists === false ? null : { id: PRODUCT_ID },
                error: null,
              };
            }
            if (table === "inventory_variants") {
              return {
                data: state.variantExists === false ? null : { id: VARIANT_ID },
                error: null,
              };
            }
            if (table === "inventory_item_images") {
              return { data: state.sourceImage ?? null, error: null };
            }
            return { data: null, error: null };
          },
          single() {
            return {
              data: state.insertedImage ?? {
                id: "66666666-6666-4666-8666-666666666666",
                storage_path: "org/product/image.png",
                public_url: "https://cdn.example/image.png",
                file_name: "image.png",
                content_type: "image/png",
                file_size: 9,
              },
              error: null,
            };
          },
        };
        return chain;
      }),
    };
    return { client, operations };
  }

  it("verifyImageTarget rejects a missing product before image records are written", async () => {
    const supabase = createImageSupabaseMock({ productExists: false });

    const result = await InventoryProductsService.verifyImageTarget(
      supabase.client as never,
      ORG_ID,
      PRODUCT_ID,
      null
    );

    expect(result).toEqual({ success: false, error: "Product not found" });
  });

  it("verifyImageTarget rejects a variant that does not belong to the product", async () => {
    const supabase = createImageSupabaseMock({ productExists: true, variantExists: false });

    const result = await InventoryProductsService.verifyImageTarget(
      supabase.client as never,
      ORG_ID,
      PRODUCT_ID,
      VARIANT_ID
    );

    expect(result).toEqual({
      success: false,
      error: "Variant does not belong to this product",
    });
  });

  it("addImageRecord clears the previous primary image for the same scope before insert", async () => {
    const supabase = createImageSupabaseMock({ productExists: true });

    const result = await InventoryProductsService.addImageRecord(supabase.client as never, ORG_ID, {
      product_id: PRODUCT_ID,
      storage_path: "org/product/image.png",
      content_type: "image/png",
      file_size: 9,
      is_primary: true,
      actor_user_id: USER_ID,
    });

    expect(result.success).toBe(true);
    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        {
          table: "inventory_item_images",
          action: "update",
          payload: { is_primary: false },
        },
        expect.objectContaining({
          table: "inventory_item_images",
          action: "insert",
          payload: expect.objectContaining({
            organization_id: ORG_ID,
            product_id: PRODUCT_ID,
            is_primary: true,
          }),
        }),
      ])
    );
  });

  it("assignExistingImageToVariant rejects a source image from another variant", async () => {
    const supabase = createImageSupabaseMock({
      productExists: true,
      variantExists: true,
      sourceImage: {
        id: "66666666-6666-4666-8666-666666666666",
        product_id: PRODUCT_ID,
        variant_id: "77777777-7777-4777-8777-777777777777",
      },
    });

    const result = await InventoryProductsService.assignExistingImageToVariant(
      supabase.client as never,
      ORG_ID,
      {
        product_id: PRODUCT_ID,
        variant_id: VARIANT_ID,
        image_id: "66666666-6666-4666-8666-666666666666",
      }
    );

    expect(result).toEqual({
      success: false,
      error: "Source image does not belong to this product gallery",
    });
  });
});
