import { describe, expect, it } from "vitest";
import type { OrgRole } from "@/server/services/organization.service";
import { loadRoleState, migrateRoleSearchParams, rolePage } from "../roles-state";

const role = (n: number, patch: Partial<OrgRole>) =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name: `Rola ${n}`,
    description: null,
    scope_type: "org",
    is_basic: false,
    deleted_at: null,
    permission_slugs: [],
    ...patch,
  }) as OrgRole;

const rows = [
  role(1, { name: "org_owner", is_basic: true, permission_slugs: ["a", "b", "c"] }),
  role(2, { name: "Kierownik", scope_type: "branch", permission_slugs: ["a"] }),
  role(3, { name: "Usunięta", deleted_at: "2026-11-01T00:00:00Z" }),
];

describe("role list address", () => {
  it("hides deleted roles and filters by scope and kind", () => {
    expect(rolePage(rows, loadRoleState({})).totalCount).toBe(2);
    expect(rolePage(rows, loadRoleState({ zakres: "branch" })).rows[0].name).toBe("Kierownik");
    expect(rolePage(rows, loadRoleState({ rodzaj: "systemowa" })).rows[0].name).toBe("org_owner");
  });

  it("sorts by the number of permissions", () => {
    expect(
      rolePage(rows, loadRoleState({ sort: "permissions", direction: "desc" })).rows.map(
        (r) => r.name
      )
    ).toEqual(["org_owner", "Kierownik"]);
  });

  it("translates old DataView links", () => {
    const { params } = migrateRoleSearchParams({
      filters: JSON.stringify({ scope: "branch", isBasic: false }),
    });
    expect(params).toMatchObject({ zakres: "branch", rodzaj: "wlasna" });
  });
});
