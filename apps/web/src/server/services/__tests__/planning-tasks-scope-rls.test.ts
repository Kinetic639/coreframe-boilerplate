/** @vitest-environment node */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260912065316_planning_tasks_branch_scope_rls.sql"
  ),
  "utf8"
);

describe("planning task scope RLS migration", () => {
  it("uses organization grants for global rows and exact branch grants for branch rows", () => {
    expect(migration).toContain("WHEN branch_id IS NULL THEN public.has_permission");
    expect(migration).toContain(
      "ELSE public.has_branch_permission(organization_id, branch_id, 'planning.tasks.read')"
    );
    expect(migration).toContain(
      "ELSE public.has_branch_permission(organization_id, branch_id, 'planning.tasks.create')"
    );
  });

  it("checks both the old and resulting row scope on updates", () => {
    const updatePolicy = migration.slice(
      migration.indexOf('CREATE POLICY "planning_tasks_update"')
    );
    expect(updatePolicy).toContain("USING (");
    expect(updatePolicy).toContain("WITH CHECK (");
    expect(updatePolicy.match(/has_branch_permission/g)).toHaveLength(4);
  });
});
