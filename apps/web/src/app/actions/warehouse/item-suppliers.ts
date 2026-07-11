"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  CRM_PARTIES_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
} from "@/lib/constants/permissions";
import {
  createWarehouseItemSupplierSchema,
  type CreateWarehouseItemSupplierInput,
} from "@/lib/validations/crm";
import {
  WarehouseItemSuppliersService,
  type WarehouseItemSupplierRow,
} from "@/server/services/warehouse-item-suppliers.service";
import { CrmPartiesService, type CrmSupplierOption } from "@/server/services/crm-parties.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function getAuthedContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, context, userId: user.id, orgId: context.app.activeOrgId };
}

export async function listWarehouseItemSuppliersAction(
  itemId: string
): Promise<ActionResult<WarehouseItemSupplierRow[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const snapshot = ctx.context.user.permissionSnapshot;
    if (
      !checkPermission(snapshot, WAREHOUSE_PRODUCTS_READ) ||
      !checkPermission(snapshot, CRM_PARTIES_READ)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }
    return WarehouseItemSuppliersService.listByItem(ctx.supabase, ctx.orgId, itemId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function searchCrmWarehouseSupplierPartiesAction(input: {
  query?: string;
  limit?: number;
}): Promise<ActionResult<CrmSupplierOption[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const snapshot = ctx.context.user.permissionSnapshot;
    if (
      !checkPermission(snapshot, WAREHOUSE_PRODUCTS_READ) ||
      !checkPermission(snapshot, CRM_PARTIES_READ)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }
    return CrmPartiesService.searchSuppliers(ctx.supabase, ctx.orgId, input.query, input.limit);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function createWarehouseItemSupplierAction(
  input: CreateWarehouseItemSupplierInput
): Promise<ActionResult<WarehouseItemSupplierRow[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const snapshot = ctx.context.user.permissionSnapshot;
    if (
      !checkPermission(snapshot, WAREHOUSE_PRODUCTS_MANAGE) ||
      !checkPermission(snapshot, CRM_PARTIES_READ)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = createWarehouseItemSupplierSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? parsed.error.message,
      };
    }

    return WarehouseItemSuppliersService.create(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteWarehouseItemSupplierAction(id: string): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return WarehouseItemSuppliersService.softDelete(ctx.supabase, ctx.orgId, id);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
