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
});
