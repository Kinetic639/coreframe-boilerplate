"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_UPDATE, WAREHOUSE_STRUCTURE_MANAGE } from "@/lib/constants/permissions";
import {
  BranchWarehousesService,
  type BranchStructureSuggestions,
  type BranchWarehouse,
  type BranchWarehouseInput,
  type UnitWarehouse,
  type UnitWarehouseInput,
} from "@/server/services/branch-warehouses.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const inputSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{3,5}$/, "invalid_code"),
  name: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable(),
  orderPrefix: z.enum(["ZL", "ZLEC"]),
});

/** Warehouses of a branch (any org member can read them). */
export async function listBranchWarehousesAction(
  branchId: string | null
): Promise<ActionResult<BranchWarehouse[]>> {
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
  return BranchWarehousesService.list(await createClient(), context.app.activeOrgId, branchId);
}

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{2,5}$/, "invalid_warehouse_code"),
  name: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable(),
  isActive: z.boolean().default(true),
});

const uuid = z.string().uuid();

/** Jednostki and magazyny: branches.update or warehouse.structure.manage (the database checks per branch). */
async function managerContext() {
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  const snapshot = context.user.permissionSnapshot;
  if (
    !checkPermission(snapshot, BRANCHES_UPDATE) &&
    !checkPermission(snapshot, WAREHOUSE_STRUCTURE_MANAGE)
  )
    return null;
  return context.app.activeOrgId;
}

export async function createBranchWarehouseAction(
  branchId: string,
  raw: unknown
): Promise<ActionResult<BranchWarehouse>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(branchId).success) return { success: false, error: "invalid" };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  return BranchWarehousesService.create(
    await createClient(),
    orgId,
    branchId,
    parsed.data as BranchWarehouseInput
  );
}

export async function updateBranchWarehouseAction(
  id: string,
  raw: unknown
): Promise<ActionResult<BranchWarehouse>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "invalid" };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  return BranchWarehousesService.update(
    await createClient(),
    orgId,
    id,
    parsed.data as BranchWarehouseInput
  );
}

export async function removeBranchWarehouseAction(id: string): Promise<ActionResult<null>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "invalid" };
  return BranchWarehousesService.remove(await createClient(), id);
}

export async function setUnitDefaultWarehouseAction(
  unitId: string,
  warehouseId: string | null
): Promise<ActionResult<null>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!uuid.safeParse(unitId).success || (warehouseId && !uuid.safeParse(warehouseId).success))
    return { success: false, error: "invalid" };
  return BranchWarehousesService.setDefaultWarehouse(
    await createClient(),
    orgId,
    unitId,
    warehouseId
  );
}

export async function createUnitWarehouseAction(
  branchId: string,
  unitId: string,
  raw: unknown
): Promise<ActionResult<UnitWarehouse>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!uuid.safeParse(branchId).success || !uuid.safeParse(unitId).success)
    return { success: false, error: "invalid" };
  const parsed = warehouseSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  return BranchWarehousesService.createWarehouse(
    await createClient(),
    orgId,
    branchId,
    unitId,
    parsed.data as UnitWarehouseInput
  );
}

export async function updateUnitWarehouseAction(
  id: string,
  raw: unknown
): Promise<ActionResult<UnitWarehouse>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!uuid.safeParse(id).success) return { success: false, error: "invalid" };
  const parsed = warehouseSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  return BranchWarehousesService.updateWarehouse(
    await createClient(),
    orgId,
    id,
    parsed.data as UnitWarehouseInput
  );
}

export async function removeUnitWarehouseAction(id: string): Promise<ActionResult<null>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!uuid.safeParse(id).success) return { success: false, error: "invalid" };
  return BranchWarehousesService.removeWarehouse(await createClient(), id);
}

/** Jednostki and magazyny the Matcher saw in this branch and the configuration lacks. */
export async function branchStructureSuggestionsAction(
  branchId: string
): Promise<ActionResult<BranchStructureSuggestions>> {
  const orgId = await managerContext();
  if (!orgId) return { success: false, error: "forbidden" };
  if (!uuid.safeParse(branchId).success) return { success: false, error: "invalid" };
  return BranchWarehousesService.suggestions(await createClient(), orgId, branchId);
}
