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

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: {
    requireModuleAccess: vi.fn().mockResolvedValue(undefined),
  },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/crm-parties.service", () => ({
  CrmPartiesService: {
    listForDataView: vi.fn(),
    getDetail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    linkContact: vi.fn(),
    unlinkContact: vi.fn(),
    addAddress: vi.fn(),
    deleteAddress: vi.fn(),
  },
}));

vi.mock("@/server/services/crm-contacts.service", () => ({
  CrmContactsService: {
    listForDataView: vi.fn(),
    getDetail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { CrmPartiesService } from "@/server/services/crm-parties.service";
import { CrmContactsService } from "@/server/services/crm-contacts.service";
import {
  addCrmPartyAddressAction,
  createCrmContactAction,
  createCrmPartyAction,
  deleteCrmContactAction,
  deleteCrmPartyAddressAction,
  deleteCrmPartyAction,
  getCrmOverviewAction,
  getCrmContactAvatarSignedUrlAction,
  getCrmPartyLogoSignedUrlAction,
  linkCrmPartyContactAction,
  listCrmPartiesForDataViewAction,
  unlinkCrmPartyContactAction,
  updateCrmContactAction,
  updateCrmPartyAction,
  uploadCrmContactAvatarAction,
  uploadCrmPartyLogoAction,
} from "../index";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PARTY_ID = "44444444-4444-4444-8444-444444444444";
const CONTACT_ID = "55555555-5555-4555-8555-555555555555";

const storageUpload = vi.fn();
const storageRemove = vi.fn();
const storageCreateSignedUrl = vi.fn();
const storageFrom = vi.fn();

function makeSupabase(user: { id: string } | null = { id: USER_ID }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    storage: {
      from: storageFrom,
    },
  };
}

function makeContext(allow: string[] = []) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: BRANCH_ID },
    user: {
      permissionSnapshot: { allow, deny: [] },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storageUpload.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  storageRemove.mockResolvedValue({ data: [], error: null });
  storageCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.example.com/crm-image.png" },
    error: null,
  });
  storageFrom.mockReturnValue({
    upload: storageUpload,
    remove: storageRemove,
    createSignedUrl: storageCreateSignedUrl,
  });
  vi.mocked(createClient).mockResolvedValue(makeSupabase() as never);
  vi.mocked(entitlements.requireModuleAccess).mockResolvedValue(undefined);
  vi.mocked(mapEntitlementError).mockReturnValue(null);
});

describe("CRM server actions", () => {
  it("maps missing CRM entitlement errors before touching context or services", async () => {
    const entitlementError = new Error("missing crm module");
    vi.mocked(entitlements.requireModuleAccess).mockRejectedValue(entitlementError);
    vi.mocked(mapEntitlementError).mockReturnValue({
      message: "CRM module is not enabled",
    } as never);

    const result = await createCrmPartyAction({
      party_kind: "organization",
      display_name: "Supplier",
      status: "active",
      roles: ["supplier"],
    });

    expect(result).toEqual({ success: false, error: "CRM module is not enabled" });
    expect(loadDashboardContextV2).not.toHaveBeenCalled();
    expect(CrmPartiesService.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated users before creating a party", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase(null) as never);
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.create"]) as never
    );

    const result = await createCrmPartyAction({
      party_kind: "organization",
      display_name: "Supplier",
      status: "active",
      roles: ["supplier"],
    });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(CrmPartiesService.create).not.toHaveBeenCalled();
  });

  it("rejects party creation when crm.parties.create is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(["crm.read"]) as never);

    const result = await createCrmPartyAction({
      party_kind: "organization",
      display_name: "Supplier",
      status: "active",
      roles: ["supplier"],
    });

    expect(result).toEqual({ success: false, error: "Insufficient permissions" });
    expect(CrmPartiesService.create).not.toHaveBeenCalled();
  });

  it("validates party payloads before calling the service", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.create"]) as never
    );

    const result = await createCrmPartyAction({
      party_kind: "organization",
      display_name: "",
      status: "active",
      roles: ["supplier"],
    });

    expect(result.success).toBe(false);
    expect(CrmPartiesService.create).not.toHaveBeenCalled();
  });

  it("creates parties through the service with server-owned org and user context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.create"]) as never
    );
    vi.mocked(CrmPartiesService.create).mockResolvedValue({
      success: true,
      data: { id: "party-1" },
    } as never);

    const result = await createCrmPartyAction({
      party_kind: "organization",
      display_name: "Supplier",
      status: "active",
      roles: ["supplier"],
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.create).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({ display_name: "Supplier", roles: ["supplier"] })
    );
  });

  it("rejects list requests for a different organization", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(["crm.parties.read"]) as never);

    const result = await listCrmPartiesForDataViewAction(
      { page: 1, pageSize: 20, search: "", sort: null, filters: {} },
      "99999999-9999-4999-8999-999999999999"
    );

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(CrmPartiesService.listForDataView).not.toHaveBeenCalled();
  });

  it("updates parties through the service with server-owned org and user context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.update).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);

    const result = await updateCrmPartyAction({
      id: PARTY_ID,
      display_name: "Updated Supplier",
      roles: ["supplier", "client"],
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.update).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({
        id: PARTY_ID,
        display_name: "Updated Supplier",
        roles: ["supplier", "client"],
      })
    );
  });

  it("soft-deletes parties through the service", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.delete"]) as never
    );
    vi.mocked(CrmPartiesService.softDelete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await deleteCrmPartyAction(PARTY_ID);

    expect(result).toEqual({ success: true, data: undefined });
    expect(CrmPartiesService.softDelete).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      PARTY_ID
    );
  });

  it("links contacts to parties through the service after validation", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.linkContact).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);

    const result = await linkCrmPartyContactAction({
      party_id: PARTY_ID,
      contact_id: CONTACT_ID,
      relationship_type: "billing",
      is_primary: true,
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.linkContact).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        party_id: PARTY_ID,
        contact_id: CONTACT_ID,
        relationship_type: "billing",
        is_primary: true,
      })
    );
  });

  it("unlinks party contacts through the service after validation", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.unlinkContact).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);

    const result = await unlinkCrmPartyContactAction({
      party_id: PARTY_ID,
      link_id: "66666666-6666-4666-8666-666666666666",
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.unlinkContact).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        party_id: PARTY_ID,
        link_id: "66666666-6666-4666-8666-666666666666",
      })
    );
  });

  it("adds party addresses through the service after validation", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.addAddress).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);

    const result = await addCrmPartyAddressAction({
      party_id: PARTY_ID,
      address_type: "billing",
      is_default: true,
      city: "Warsaw",
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.addAddress).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        party_id: PARTY_ID,
        address_type: "billing",
        is_default: true,
        city: "Warsaw",
      })
    );
  });

  it("soft-deletes party addresses through the service after validation", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.deleteAddress).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);

    const result = await deleteCrmPartyAddressAction({
      party_id: PARTY_ID,
      address_id: "77777777-7777-4777-8777-777777777777",
    });

    expect(result.success).toBe(true);
    expect(CrmPartiesService.deleteAddress).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        party_id: PARTY_ID,
        address_id: "77777777-7777-4777-8777-777777777777",
      })
    );
  });

  it("creates branch contacts with the active branch context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.contacts.create"]) as never
    );
    vi.mocked(CrmContactsService.create).mockResolvedValue({
      success: true,
      data: { id: "contact-1" },
    } as never);

    const result = await createCrmContactAction({
      visibility_scope: "branch",
      display_name: "Branch Contact",
    });

    expect(result.success).toBe(true);
    expect(CrmContactsService.create).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      BRANCH_ID,
      expect.objectContaining({ visibility_scope: "branch" })
    );
  });

  it("returns overview counts from party and contact services", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(["crm.read"]) as never);
    vi.mocked(CrmPartiesService.listForDataView).mockResolvedValue({
      success: true,
      data: { rows: [], totalCount: 12, page: 1, pageSize: 1 },
    } as never);
    vi.mocked(CrmContactsService.listForDataView).mockResolvedValue({
      success: true,
      data: { rows: [], totalCount: 6, page: 1, pageSize: 1 },
    } as never);

    const result = await getCrmOverviewAction();

    expect(result).toEqual({ success: true, data: { parties: 12, contacts: 6 } });
  });

  it("updates contacts through the service with server-owned org and user context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.contacts.update"]) as never
    );
    vi.mocked(CrmContactsService.update).mockResolvedValue({
      success: true,
      data: { id: CONTACT_ID },
    } as never);

    const result = await updateCrmContactAction({
      id: CONTACT_ID,
      display_name: "Updated Contact",
      visibility_scope: "organization",
    });

    expect(result.success).toBe(true);
    expect(CrmContactsService.update).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({
        id: CONTACT_ID,
        display_name: "Updated Contact",
      })
    );
  });

  it("soft-deletes contacts through the service", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.contacts.delete"]) as never
    );
    vi.mocked(CrmContactsService.softDelete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await deleteCrmContactAction(CONTACT_ID);

    expect(result).toEqual({ success: true, data: undefined });
    expect(CrmContactsService.softDelete).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      CONTACT_ID
    );
  });

  it("rejects invalid party logo uploads before storage calls", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    const formData = new FormData();
    formData.set("party_id", PARTY_ID);
    formData.set("file", new File(["not an image"], "doc.txt", { type: "text/plain" }));

    const result = await uploadCrmPartyLogoAction(formData);

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(CrmPartiesService.update).not.toHaveBeenCalled();
  });

  it("uploads party logos, stores only the path, removes the old logo, and returns a signed URL", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.update"]) as never
    );
    vi.mocked(CrmPartiesService.getDetail).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID, logo_storage_path: `${ORG_ID}/parties/${PARTY_ID}/old.png` },
    } as never);
    vi.mocked(CrmPartiesService.update).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID },
    } as never);
    const formData = new FormData();
    formData.set("party_id", PARTY_ID);
    formData.set("file", new File(["image"], "logo.png", { type: "image/png" }));

    const result = await uploadCrmPartyLogoAction(formData);

    expect(result.success).toBe(true);
    expect(storageFrom).toHaveBeenCalledWith("crm-party-logos");
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${ORG_ID}/parties/${PARTY_ID}/.*\\.png$`)),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "image/png", upsert: false })
    );
    expect(CrmPartiesService.update).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      USER_ID,
      expect.objectContaining({
        id: PARTY_ID,
        logo_storage_path: expect.stringMatching(new RegExp(`^${ORG_ID}/parties/${PARTY_ID}/`)),
      })
    );
    expect(storageRemove).toHaveBeenCalledWith([`${ORG_ID}/parties/${PARTY_ID}/old.png`]);
    expect(result).toEqual({
      success: true,
      data: {
        logoStoragePath: expect.stringMatching(new RegExp(`^${ORG_ID}/parties/${PARTY_ID}/`)),
        signedUrl: "https://signed.example.com/crm-image.png",
      },
    });
  });

  it("rolls back uploaded contact avatars when the DB update fails", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.contacts.update"]) as never
    );
    vi.mocked(CrmContactsService.getDetail).mockResolvedValue({
      success: true,
      data: { id: CONTACT_ID, avatar_storage_path: null },
    } as never);
    vi.mocked(CrmContactsService.update).mockResolvedValue({
      success: false,
      error: "db failed",
    });
    const formData = new FormData();
    formData.set("contact_id", CONTACT_ID);
    formData.set("file", new File(["image"], "avatar.webp", { type: "image/webp" }));

    const result = await uploadCrmContactAvatarAction(formData);

    expect(result).toEqual({ success: false, error: "db failed" });
    expect(storageFrom).toHaveBeenCalledWith("crm-contact-avatars");
    expect(storageRemove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^${ORG_ID}/contacts/${CONTACT_ID}/.*\\.webp$`)),
    ]);
  });

  it("creates signed URLs for existing CRM assets without exposing public URLs", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["crm.parties.read", "crm.contacts.read"]) as never
    );
    vi.mocked(CrmPartiesService.getDetail).mockResolvedValue({
      success: true,
      data: { id: PARTY_ID, logo_storage_path: `${ORG_ID}/parties/${PARTY_ID}/logo.png` },
    } as never);
    vi.mocked(CrmContactsService.getDetail).mockResolvedValue({
      success: true,
      data: { id: CONTACT_ID, avatar_storage_path: `${ORG_ID}/contacts/${CONTACT_ID}/avatar.png` },
    } as never);

    const logo = await getCrmPartyLogoSignedUrlAction(PARTY_ID);
    const avatar = await getCrmContactAvatarSignedUrlAction(CONTACT_ID);

    expect(logo).toEqual({
      success: true,
      data: { signedUrl: "https://signed.example.com/crm-image.png" },
    });
    expect(avatar).toEqual({
      success: true,
      data: { signedUrl: "https://signed.example.com/crm-image.png" },
    });
    expect(storageCreateSignedUrl).toHaveBeenCalledWith(
      `${ORG_ID}/parties/${PARTY_ID}/logo.png`,
      3600
    );
    expect(storageCreateSignedUrl).toHaveBeenCalledWith(
      `${ORG_ID}/contacts/${CONTACT_ID}/avatar.png`,
      3600
    );
  });
});
