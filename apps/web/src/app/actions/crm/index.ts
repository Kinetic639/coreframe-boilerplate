"use server";

import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { checkPermission } from "@/lib/utils/permissions";
import { MODULE_CRM } from "@/lib/constants/modules";
import {
  CRM_CONTACTS_CREATE,
  CRM_CONTACTS_DELETE,
  CRM_CONTACTS_READ,
  CRM_CONTACTS_UPDATE,
  CRM_PARTIES_CREATE,
  CRM_PARTIES_DELETE,
  CRM_PARTIES_READ,
  CRM_PARTIES_UPDATE,
  CRM_READ,
} from "@/lib/constants/permissions";
import {
  CrmPartiesService,
  type CrmSupplierOption,
  type CrmPartyDetail,
  type CrmPartyListRow,
} from "@/server/services/crm-parties.service";
import {
  CrmContactsService,
  type CrmContactDetail,
  type CrmContactListRow,
} from "@/server/services/crm-contacts.service";
import {
  createCrmContactSchema,
  createCrmPartyAddressSchema,
  createCrmPartySchema,
  deleteCrmPartyAddressSchema,
  linkCrmPartyContactSchema,
  unlinkCrmPartyContactSchema,
  updateCrmContactSchema,
  updateCrmPartySchema,
  type CreateCrmContactInput,
  type CreateCrmPartyAddressInput,
  type CreateCrmPartyInput,
  type DeleteCrmPartyAddressInput,
  type LinkCrmPartyContactInput,
  type UnlinkCrmPartyContactInput,
  type UpdateCrmContactInput,
  type UpdateCrmPartyInput,
} from "@/lib/validations/crm";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export type CrmContractorLookupOption = CrmSupplierOption & {
  logo_signed_url: string | null;
};

const CRM_PARTY_LOGOS_BUCKET = "crm-party-logos";
const CRM_CONTACT_AVATARS_BUCKET = "crm-contact-avatars";
const CRM_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;
const CRM_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const CRM_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function getAuthedContext() {
  await entitlements.requireModuleAccess(MODULE_CRM);
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    supabase,
    context,
    userId: user.id,
    orgId: context.app.activeOrgId,
    activeBranchId: context.app.activeBranchId,
  };
}

function permissionDenied(): ActionResult<never> {
  return { success: false, error: "Insufficient permissions" };
}

function validationError(error: { issues?: Array<{ message: string }>; message: string }) {
  return error.issues?.[0]?.message ?? error.message;
}

function mapError(error: unknown): ActionResult<never> {
  const mapped = mapEntitlementError(error);
  if (mapped) return { success: false, error: mapped.message };
  return { success: false, error: "Unexpected error" };
}

const contractorLookupSchema = z.object({
  role: z
    .enum(["supplier", "client", "contractor", "vendor", "partner", "receiver", "payer", "other"])
    .optional(),
  query: z.string().trim().max(200).nullable().optional(),
  number: z.number().int().positive().nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
  taxId: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function validateCrmImageFile(file: unknown): ActionResult<{ file: File; extension: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Image file is required" };
  }
  if (file.size > CRM_ASSET_MAX_BYTES) {
    return { success: false, error: "File too large. Maximum size is 5 MB." };
  }
  const extension = CRM_IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    return { success: false, error: "Invalid file type. Only image files are allowed." };
  }
  return { success: true, data: { file, extension } };
}

function storagePath(orgId: string, folder: "parties" | "contacts", entityId: string, ext: string) {
  return `${orgId}/${folder}/${entityId}/${crypto.randomUUID()}.${ext}`;
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  path: string | null
): Promise<ActionResult<{ signedUrl: string | null }>> {
  if (!path) return { success: true, data: { signedUrl: null } };
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, CRM_ASSET_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return { success: true, data: { signedUrl: null } };
  return { success: true, data: { signedUrl: data.signedUrl } };
}

export async function listCrmPartiesForDataViewAction(
  params: DataViewListParams,
  orgId: string
): Promise<ActionResult<PaginatedResult<CrmPartyListRow>>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx || ctx.orgId !== orgId) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_READ))
      return permissionDenied();
    return CrmPartiesService.listForDataView(ctx.supabase, ctx.orgId, params);
  } catch (error) {
    return mapError(error);
  }
}

export async function searchCrmContractorsForLookupAction(
  input: z.infer<typeof contractorLookupSchema>
): Promise<ActionResult<CrmContractorLookupOption[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_READ))
      return permissionDenied();

    const parsed = contractorLookupSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };

    const result = await CrmPartiesService.searchContractors(ctx.supabase, ctx.orgId, parsed.data);
    if ("error" in result) return { success: false, error: result.error };

    const withLogos = await Promise.all(
      result.data.map(async (party) => {
        const logo = await signedUrl(
          ctx.supabase,
          CRM_PARTY_LOGOS_BUCKET,
          party.logo_storage_path ?? null
        );
        return {
          ...party,
          logo_signed_url: logo.success ? logo.data.signedUrl : null,
        };
      })
    );

    return { success: true, data: withLogos };
  } catch (error) {
    return mapError(error);
  }
}

export async function getCrmPartyDetailAction(
  partyId: string,
  orgId: string
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx || ctx.orgId !== orgId) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_READ))
      return permissionDenied();
    return CrmPartiesService.getDetail(ctx.supabase, ctx.orgId, partyId);
  } catch (error) {
    return mapError(error);
  }
}

export async function createCrmPartyAction(
  input: CreateCrmPartyInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_CREATE))
      return permissionDenied();
    const parsed = createCrmPartySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.create(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function updateCrmPartyAction(
  input: UpdateCrmPartyInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();
    const parsed = updateCrmPartySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.update(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteCrmPartyAction(partyId: string): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_DELETE))
      return permissionDenied();
    return CrmPartiesService.softDelete(ctx.supabase, ctx.orgId, ctx.userId, partyId);
  } catch (error) {
    return mapError(error);
  }
}

export async function uploadCrmPartyLogoAction(
  formData: FormData
): Promise<ActionResult<{ logoStoragePath: string; signedUrl: string | null }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();

    const partyId = String(formData.get("party_id") ?? "");
    const parsedId = updateCrmPartySchema.pick({ id: true }).safeParse({ id: partyId });
    if (!parsedId.success) return { success: false, error: validationError(parsedId.error) };

    const image = validateCrmImageFile(formData.get("file"));
    if (image.success === false) return { success: false, error: image.error };

    const detail = await CrmPartiesService.getDetail(ctx.supabase, ctx.orgId, parsedId.data.id);
    if (detail.success === false) return { success: false, error: detail.error };

    const path = storagePath(ctx.orgId, "parties", parsedId.data.id, image.data.extension);
    const fileBuffer = await image.data.file.arrayBuffer();
    const { error: uploadError } = await ctx.supabase.storage
      .from(CRM_PARTY_LOGOS_BUCKET)
      .upload(path, fileBuffer, {
        contentType: image.data.file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) return { success: false, error: uploadError.message };

    const updated = await CrmPartiesService.update(ctx.supabase, ctx.orgId, ctx.userId, {
      id: parsedId.data.id,
      logo_storage_path: path,
    });
    if (updated.success === false) {
      await ctx.supabase.storage.from(CRM_PARTY_LOGOS_BUCKET).remove([path]);
      return { success: false, error: updated.error };
    }

    if (detail.data.logo_storage_path && detail.data.logo_storage_path !== path) {
      await ctx.supabase.storage
        .from(CRM_PARTY_LOGOS_BUCKET)
        .remove([detail.data.logo_storage_path]);
    }

    const url = await signedUrl(ctx.supabase, CRM_PARTY_LOGOS_BUCKET, path);
    return {
      success: true,
      data: {
        logoStoragePath: path,
        signedUrl: url.success ? url.data.signedUrl : null,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function getCrmPartyLogoSignedUrlAction(
  partyId: string
): Promise<ActionResult<{ signedUrl: string | null }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_READ))
      return permissionDenied();

    const parsedId = updateCrmPartySchema.pick({ id: true }).safeParse({ id: partyId });
    if (!parsedId.success) return { success: false, error: validationError(parsedId.error) };

    const detail = await CrmPartiesService.getDetail(ctx.supabase, ctx.orgId, parsedId.data.id);
    if (detail.success === false) return { success: false, error: detail.error };
    return signedUrl(ctx.supabase, CRM_PARTY_LOGOS_BUCKET, detail.data.logo_storage_path);
  } catch (error) {
    return mapError(error);
  }
}

export async function linkCrmPartyContactAction(
  input: LinkCrmPartyContactInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();
    const parsed = linkCrmPartyContactSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.linkContact(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function unlinkCrmPartyContactAction(
  input: UnlinkCrmPartyContactInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();
    const parsed = unlinkCrmPartyContactSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.unlinkContact(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function addCrmPartyAddressAction(
  input: CreateCrmPartyAddressInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();
    const parsed = createCrmPartyAddressSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.addAddress(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteCrmPartyAddressAction(
  input: DeleteCrmPartyAddressInput
): Promise<ActionResult<CrmPartyDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_PARTIES_UPDATE))
      return permissionDenied();
    const parsed = deleteCrmPartyAddressSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmPartiesService.deleteAddress(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function listCrmContactsForDataViewAction(
  params: DataViewListParams,
  orgId: string
): Promise<ActionResult<PaginatedResult<CrmContactListRow>>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx || ctx.orgId !== orgId) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_READ))
      return permissionDenied();
    return CrmContactsService.listForDataView(ctx.supabase, ctx.orgId, params);
  } catch (error) {
    return mapError(error);
  }
}

export async function getCrmContactDetailAction(
  contactId: string,
  orgId: string
): Promise<ActionResult<CrmContactDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx || ctx.orgId !== orgId) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_READ))
      return permissionDenied();
    return CrmContactsService.getDetail(ctx.supabase, ctx.orgId, contactId);
  } catch (error) {
    return mapError(error);
  }
}

export async function createCrmContactAction(
  input: CreateCrmContactInput
): Promise<ActionResult<CrmContactDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_CREATE))
      return permissionDenied();
    const parsed = createCrmContactSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmContactsService.create(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      ctx.activeBranchId,
      parsed.data
    );
  } catch (error) {
    return mapError(error);
  }
}

export async function updateCrmContactAction(
  input: UpdateCrmContactInput
): Promise<ActionResult<CrmContactDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_UPDATE))
      return permissionDenied();
    const parsed = updateCrmContactSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };
    return CrmContactsService.update(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteCrmContactAction(contactId: string): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_DELETE))
      return permissionDenied();
    return CrmContactsService.softDelete(ctx.supabase, ctx.orgId, ctx.userId, contactId);
  } catch (error) {
    return mapError(error);
  }
}

export async function uploadCrmContactAvatarAction(
  formData: FormData
): Promise<ActionResult<{ avatarStoragePath: string; signedUrl: string | null }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_UPDATE))
      return permissionDenied();

    const contactId = String(formData.get("contact_id") ?? "");
    const parsedId = updateCrmContactSchema.pick({ id: true }).safeParse({ id: contactId });
    if (!parsedId.success) return { success: false, error: validationError(parsedId.error) };

    const image = validateCrmImageFile(formData.get("file"));
    if (image.success === false) return { success: false, error: image.error };

    const detail = await CrmContactsService.getDetail(ctx.supabase, ctx.orgId, parsedId.data.id);
    if (detail.success === false) return { success: false, error: detail.error };

    const path = storagePath(ctx.orgId, "contacts", parsedId.data.id, image.data.extension);
    const fileBuffer = await image.data.file.arrayBuffer();
    const { error: uploadError } = await ctx.supabase.storage
      .from(CRM_CONTACT_AVATARS_BUCKET)
      .upload(path, fileBuffer, {
        contentType: image.data.file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) return { success: false, error: uploadError.message };

    const updated = await CrmContactsService.update(ctx.supabase, ctx.orgId, ctx.userId, {
      id: parsedId.data.id,
      avatar_storage_path: path,
    });
    if (updated.success === false) {
      await ctx.supabase.storage.from(CRM_CONTACT_AVATARS_BUCKET).remove([path]);
      return { success: false, error: updated.error };
    }

    if (detail.data.avatar_storage_path && detail.data.avatar_storage_path !== path) {
      await ctx.supabase.storage
        .from(CRM_CONTACT_AVATARS_BUCKET)
        .remove([detail.data.avatar_storage_path]);
    }

    const url = await signedUrl(ctx.supabase, CRM_CONTACT_AVATARS_BUCKET, path);
    return {
      success: true,
      data: {
        avatarStoragePath: path,
        signedUrl: url.success ? url.data.signedUrl : null,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function getCrmContactAvatarSignedUrlAction(
  contactId: string
): Promise<ActionResult<{ signedUrl: string | null }>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_CONTACTS_READ))
      return permissionDenied();

    const parsedId = updateCrmContactSchema.pick({ id: true }).safeParse({ id: contactId });
    if (!parsedId.success) return { success: false, error: validationError(parsedId.error) };

    const detail = await CrmContactsService.getDetail(ctx.supabase, ctx.orgId, parsedId.data.id);
    if (detail.success === false) return { success: false, error: detail.error };
    return signedUrl(ctx.supabase, CRM_CONTACT_AVATARS_BUCKET, detail.data.avatar_storage_path);
  } catch (error) {
    return mapError(error);
  }
}

export async function getCrmOverviewAction(): Promise<
  ActionResult<{ parties: number; contacts: number }>
> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, CRM_READ)) return permissionDenied();
    const [parties, contacts] = await Promise.all([
      CrmPartiesService.listForDataView(ctx.supabase, ctx.orgId, {
        search: "",
        sort: null,
        page: 1,
        pageSize: 1,
        filters: {},
      }),
      CrmContactsService.listForDataView(ctx.supabase, ctx.orgId, {
        search: "",
        sort: null,
        page: 1,
        pageSize: 1,
        filters: {},
      }),
    ]);

    return {
      success: true,
      data: {
        parties: parties.success ? parties.data.totalCount : 0,
        contacts: contacts.success ? contacts.data.totalCount : 0,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}
