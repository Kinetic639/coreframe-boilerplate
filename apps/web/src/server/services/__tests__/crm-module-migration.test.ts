/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260707120000_crm_module.sql"
);

describe("CRM module migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("creates private CRM storage buckets for logos and avatars", () => {
    expect(sql).toContain("'crm-party-logos'");
    expect(sql).toContain("'crm-contact-avatars'");
    expect(sql).toContain("ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']");
  });

  it("requires CRM read permissions for storage object reads", () => {
    expect(sql).toContain("CREATE POLICY crm_party_logos_select");
    expect(sql).toContain(
      "public.has_permission((storage.foldername(name))[1]::uuid, 'crm.parties.read')"
    );
    expect(sql).toContain("CREATE POLICY crm_contact_avatars_select");
    expect(sql).toContain(
      "public.has_permission((storage.foldername(name))[1]::uuid, 'crm.contacts.read')"
    );
  });

  it("defines INSERT and UPDATE policies for storage upsert compatibility", () => {
    expect(sql).toContain("CREATE POLICY crm_party_logos_insert");
    expect(sql).toContain("CREATE POLICY crm_party_logos_update");
    expect(sql).toContain("CREATE POLICY crm_contact_avatars_insert");
    expect(sql).toContain("CREATE POLICY crm_contact_avatars_update");
    expect(sql).toContain("WITH CHECK");
  });

  it("enables and forces RLS on CRM PII tables", () => {
    for (const table of [
      "crm_parties",
      "crm_party_roles",
      "crm_contacts",
      "crm_party_contacts",
      "crm_party_addresses",
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
    expect(sql).toContain("ALTER TABLE public.warehouse_item_suppliers ENABLE ROW LEVEL SECURITY");
  });

  it("scopes party policies by organization membership and CRM party permissions", () => {
    expect(sql).toContain("CREATE POLICY crm_parties_select");
    expect(sql).toContain("public.is_org_member(organization_id)");
    expect(sql).toContain("public.has_permission(organization_id, 'crm.parties.read')");
    expect(sql).toContain("public.has_permission(organization_id, 'crm.parties.create')");
    expect(sql).toContain("public.has_permission(organization_id, 'crm.parties.update')");
    expect(sql).toContain("public.has_permission(organization_id, 'crm.parties.delete')");
  });

  it("keeps private contacts owner-scoped and branch contacts branch-permission-scoped", () => {
    expect(sql).toContain("visibility_scope = 'private' AND owner_user_id = (select auth.uid())");
    expect(sql).toContain("visibility_scope <> 'private'");
    expect(sql).toContain("OR owner_user_id = (select auth.uid())");
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, branch_id, 'crm.contacts.read')"
    );
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, branch_id, 'crm.contacts.create')"
    );
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, branch_id, 'crm.contacts.update')"
    );
  });

  it("denies hard deletes for CRM and warehouse supplier tables", () => {
    for (const policy of [
      "crm_parties_delete_deny",
      "crm_contacts_delete_deny",
      "crm_party_contacts_delete_deny",
      "crm_party_addresses_delete_deny",
      "warehouse_item_suppliers_delete_deny",
    ]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`);
    }
    expect(sql).toContain("FOR DELETE TO authenticated");
    expect(sql).toContain("USING (false)");
  });

  it("prevents cross-organization party/contact and party/address links", () => {
    expect(sql).toContain("WHERE p.id = party_id");
    expect(sql).toContain("p.organization_id = crm_party_contacts.organization_id");
    expect(sql).toContain("WHERE c.id = contact_id");
    expect(sql).toContain("c.organization_id = crm_party_contacts.organization_id");
    expect(sql).toContain("p.organization_id = crm_party_addresses.organization_id");
  });

  it("does not expose the SECURITY DEFINER number allocator to public callers", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.next_crm_counterparty_number");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.next_crm_counterparty_number(uuid) FROM PUBLIC"
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.next_crm_counterparty_number(uuid) TO authenticated"
    );
    expect(sql).toContain("public.is_org_member(org_id)");
  });
});
