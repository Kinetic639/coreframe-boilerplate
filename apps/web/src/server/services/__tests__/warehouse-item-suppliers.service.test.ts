/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { WarehouseItemSuppliersService } from "../warehouse-item-suppliers.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const PARTY_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLIER_LINK_ID = "55555555-5555-4555-8555-555555555555";

type Operation = {
  table: string;
  action: string;
  payload?: unknown;
  args?: unknown[];
};

function supplierRow() {
  return {
    id: SUPPLIER_LINK_ID,
    organization_id: ORG_ID,
    item_id: ITEM_ID,
    party_id: PARTY_ID,
    is_primary: true,
    supplier_sku: "SUP-1",
    lead_time_days: 3,
    minimum_order_quantity: 2,
    purchase_price: 10,
    currency_code: "PLN",
    created_at: "2026-07-11T10:00:00.000Z",
    updated_at: "2026-07-11T10:00:00.000Z",
    crm_parties: { counterparty_number: 81, display_name: "Ambra Supplier" },
  };
}

function createChain(table: string, operations: Operation[]) {
  const chain = {
    data: null as unknown,
    error: null as { message: string } | null,
    select(...args: unknown[]) {
      operations.push({ table, action: "select", args });
      chain.data = [supplierRow()];
      return chain;
    },
    insert(payload: unknown) {
      operations.push({ table, action: "insert", payload });
      return chain;
    },
    update(payload: unknown) {
      operations.push({ table, action: "update", payload });
      return chain;
    },
    eq(...args: unknown[]) {
      operations.push({ table, action: "eq", args });
      return chain;
    },
    is(...args: unknown[]) {
      operations.push({ table, action: "is", args });
      return chain;
    },
    order(...args: unknown[]) {
      operations.push({ table, action: "order", args });
      return chain;
    },
  };
  return chain;
}

function createSupabaseMock() {
  const operations: Operation[] = [];
  return {
    operations,
    client: {
      from: (table: string) => createChain(table, operations),
    },
  };
}

describe("WarehouseItemSuppliersService", () => {
  it("lists item suppliers through CRM party references", async () => {
    const supabase = createSupabaseMock();

    const result = await WarehouseItemSuppliersService.listByItem(
      supabase.client as never,
      ORG_ID,
      ITEM_ID
    );

    expect(result).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          party_id: PARTY_ID,
          counterparty_number: 81,
          supplier_name: "Ambra Supplier",
          is_primary: true,
        }),
      ],
    });
    expect(supabase.operations).toContainEqual({
      table: "warehouse_item_suppliers",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "warehouse_item_suppliers",
      action: "eq",
      args: ["item_id", ITEM_ID],
    });
  });

  it("clears the existing primary supplier before inserting a new primary", async () => {
    const supabase = createSupabaseMock();

    const result = await WarehouseItemSuppliersService.create(
      supabase.client as never,
      ORG_ID,
      USER_ID,
      {
        item_id: ITEM_ID,
        party_id: PARTY_ID,
        is_primary: true,
        supplier_sku: "SUP-1",
      }
    );

    expect(result.success).toBe(true);
    const updates = supabase.operations.filter(
      (op) => op.table === "warehouse_item_suppliers" && op.action === "update"
    );
    expect(updates[0]?.payload).toEqual({ is_primary: false });
    const insert = supabase.operations.find(
      (op) => op.table === "warehouse_item_suppliers" && op.action === "insert"
    );
    expect(insert?.payload).toEqual(
      expect.objectContaining({
        organization_id: ORG_ID,
        item_id: ITEM_ID,
        party_id: PARTY_ID,
        is_primary: true,
        created_by: USER_ID,
      })
    );
  });

  it("promotes an existing supplier as the only primary supplier", async () => {
    const supabase = createSupabaseMock();

    const result = await WarehouseItemSuppliersService.update(supabase.client as never, ORG_ID, {
      id: SUPPLIER_LINK_ID,
      item_id: ITEM_ID,
      is_primary: true,
    });

    expect(result.success).toBe(true);
    const updates = supabase.operations.filter(
      (op) => op.table === "warehouse_item_suppliers" && op.action === "update"
    );
    expect(updates[0]?.payload).toEqual({ is_primary: false });
    expect(updates[1]?.payload).toEqual(
      expect.objectContaining({ is_primary: true, updated_at: expect.any(String) })
    );
    expect(supabase.operations).toContainEqual({
      table: "warehouse_item_suppliers",
      action: "eq",
      args: ["id", SUPPLIER_LINK_ID],
    });
  });

  it("soft-deletes item supplier links", async () => {
    const supabase = createSupabaseMock();

    const result = await WarehouseItemSuppliersService.softDelete(
      supabase.client as never,
      ORG_ID,
      SUPPLIER_LINK_ID
    );

    expect(result.success).toBe(true);
    const update = supabase.operations.find(
      (op) => op.table === "warehouse_item_suppliers" && op.action === "update"
    );
    expect(update?.payload).toEqual(expect.objectContaining({ deleted_at: expect.any(String) }));
  });
});
