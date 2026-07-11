/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));

vi.mock("@/server/services/warehouse-item-suppliers.service", () => ({
  WarehouseItemSuppliersService: {
    listByItem: vi.fn(),
    create: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/server/services/crm-parties.service", () => ({
  CrmPartiesService: {
    searchSuppliers: vi.fn(),
  },
}));

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseItemSuppliersService } from "@/server/services/warehouse-item-suppliers.service";
import { CrmPartiesService } from "@/server/services/crm-parties.service";
import {
  createWarehouseItemSupplierAction,
  listWarehouseItemSuppliersAction,
  searchCrmWarehouseSupplierPartiesAction,
} from "../item-suppliers";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const PARTY_ID = "44444444-4444-4444-8444-444444444444";

function makeContext(allow: string[] = []) {
  return {
    app: { activeOrgId: ORG_ID },
    user: {
      permissionSnapshot: { allow, deny: [] },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
  } as never);
});

describe("warehouse CRM item supplier actions", () => {
  it("requires both warehouse product read and CRM party read to list item suppliers", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["warehouse.products.read"]) as never
    );

    const result = await listWarehouseItemSuppliersAction(ITEM_ID);

    expect(result).toEqual({ success: false, error: "Insufficient permissions" });
    expect(WarehouseItemSuppliersService.listByItem).not.toHaveBeenCalled();
  });

  it("searches CRM supplier parties for warehouse supplier pickers", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["warehouse.products.read", "crm.parties.read"]) as never
    );
    vi.mocked(CrmPartiesService.searchSuppliers).mockResolvedValue({
      success: true,
      data: [
        {
          id: PARTY_ID,
          counterparty_number: 81,
          display_name: "Ambra Supplier",
          email: "supplier@example.com",
          phone: null,
        },
      ],
    });

    const result = await searchCrmWarehouseSupplierPartiesAction({
      query: "Ambra",
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.searchSuppliers).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      "Ambra",
      10
    );
  });

  it("creates item supplier links with server-owned organization and user context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["warehouse.products.manage", "crm.parties.read"]) as never
    );
    vi.mocked(WarehouseItemSuppliersService.create).mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await createWarehouseItemSupplierAction({
      item_id: ITEM_ID,
      party_id: PARTY_ID,
      is_primary: true,
      supplier_sku: "SUP-1",
    });

    expect(result.success).toBe(true);
    expect(WarehouseItemSuppliersService.create).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({
        item_id: ITEM_ID,
        party_id: PARTY_ID,
        is_primary: true,
      })
    );
  });
});
