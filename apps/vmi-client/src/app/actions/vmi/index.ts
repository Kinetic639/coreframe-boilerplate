"use server";

import { createHash } from "node:crypto";
import {
  VMI_CLIENTS_MANAGE,
  VMI_INVENTORY_MANAGE,
  VMI_INVITATIONS_MANAGE,
  VMI_LOCATIONS_MANAGE,
  VMI_MESSAGES_SEND,
  VMI_ORDERS_MANAGE,
  VMI_PROPOSALS_MANAGE,
} from "@repo/contracts/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  vmiCatalogExposureCreateSchema,
  vmiClientAccountCreateSchema,
  vmiClientAccountUpdateSchema,
  vmiClientInvitationCreateSchema,
  vmiClientLocationCreateSchema,
  vmiClientLocationUpdateSchema,
  vmiInventoryItemCreateSchema,
  vmiInventoryItemUpdateSchema,
  vmiMessageCreateSchema,
  vmiOrderCreateSchema,
  vmiProposalCreateSchema,
  vmiStockCountSubmitSchema,
} from "@/lib/validations/vmi";
import { VmiClientAccountsService } from "@/server/services/vmi-client-accounts.service";
import { VmiInventoryService } from "@/server/services/vmi-inventory.service";
import type { VmiSupabaseClient } from "@/server/services/supabase-service.types";
import { VmiWorkflowsService } from "@/server/services/vmi-workflows.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function validationError(error: { issues?: Array<{ message: string }>; message: string }) {
  return error.issues?.[0]?.message ?? error.message;
}

function unexpectedError(): ActionResult<never> {
  return { success: false, error: "Unexpected error" };
}

async function getAuthedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

async function requireVendorPermission(
  supabase: VmiSupabaseClient,
  vendorOrganizationId: string,
  permission: string,
) {
  const { data, error } = await supabase.rpc("vmi_can_manage", {
    p_vendor_organization_id: vendorOrganizationId,
    p_permission: permission,
  });
  if (error) throw error;
  return data === true;
}

async function requireClientAccess(supabase: VmiSupabaseClient, clientAccountId: string) {
  const { data, error } = await supabase.rpc("vmi_is_client_user", {
    p_client_account_id: clientAccountId,
  });
  if (error) throw error;
  return data === true;
}

function hashInviteToken(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

export async function createVmiClientAccountAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiClientAccountCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_CLIENTS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiClientAccountsService.createClientAccount(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function updateVmiClientAccountAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiClientAccountUpdateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };

    const { data: account, error: accountError } = await auth.supabase
      .from("vmi_client_accounts")
      .select("vendor_organization_id")
      .eq("id", input.id)
      .single();
    if (accountError || !account) return { success: false, error: "Client account not found" };
    if (!(await requireVendorPermission(auth.supabase, account.vendor_organization_id, VMI_CLIENTS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiClientAccountsService.updateClientAccount(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiClientInvitationAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiClientInvitationCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_INVITATIONS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const tokenHash = hashInviteToken(`${input.email}:${input.clientAccountId}:${crypto.randomUUID()}`);
    const result = await VmiClientAccountsService.createInvitation(auth.supabase, input, tokenHash, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiClientLocationAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiClientLocationCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_LOCATIONS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiClientAccountsService.createLocation(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function updateVmiClientLocationAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiClientLocationUpdateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };

    const { data: location, error: locationError } = await auth.supabase
      .from("vmi_client_locations")
      .select("vendor_organization_id")
      .eq("id", input.id)
      .single();
    if (locationError || !location) return { success: false, error: "Location not found" };
    if (!(await requireVendorPermission(auth.supabase, location.vendor_organization_id, VMI_LOCATIONS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiClientAccountsService.updateLocation(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiCatalogExposureAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiCatalogExposureCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_INVENTORY_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiInventoryService.createCatalogExposure(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiInventoryItemAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiInventoryItemCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_INVENTORY_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiInventoryService.createInventoryItem(auth.supabase, input);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function updateVmiInventoryItemAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiInventoryItemUpdateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };

    const { data: item, error: itemError } = await auth.supabase
      .from("vmi_inventory_items")
      .select("vendor_organization_id")
      .eq("id", input.id)
      .single();
    if (itemError || !item) return { success: false, error: "Inventory item not found" };
    if (!(await requireVendorPermission(auth.supabase, item.vendor_organization_id, VMI_INVENTORY_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiInventoryService.updateInventoryItem(auth.supabase, input);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function submitVmiStockCountAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiStockCountSubmitSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireClientAccess(auth.supabase, input.clientAccountId))) {
      return { success: false, error: "Insufficient client access" };
    }

    const result = await VmiWorkflowsService.submitStockCount(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiProposalAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiProposalCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    if (!(await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_PROPOSALS_MANAGE))) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await VmiWorkflowsService.createProposal(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiOrderAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiOrderCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    const isClient = await requireClientAccess(auth.supabase, input.clientAccountId);
    const isVendor = await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_ORDERS_MANAGE);
    if (!isClient && !isVendor) return { success: false, error: "Insufficient access" };

    const result = await VmiWorkflowsService.createOrder(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}

export async function createVmiMessageAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  try {
    const input = vmiMessageCreateSchema.parse(rawInput);
    const auth = await getAuthedSupabase();
    if (!auth) return { success: false, error: "Unauthenticated" };
    const isClient = await requireClientAccess(auth.supabase, input.clientAccountId);
    const isVendor = await requireVendorPermission(auth.supabase, input.vendorOrganizationId, VMI_MESSAGES_SEND);
    if (!isClient && !isVendor) return { success: false, error: "Insufficient access" };

    const result = await VmiWorkflowsService.createMessage(auth.supabase, input, auth.userId);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return { success: false, error: validationError(error as { issues?: Array<{ message: string }>; message: string }) };
    }
    return unexpectedError();
  }
}
