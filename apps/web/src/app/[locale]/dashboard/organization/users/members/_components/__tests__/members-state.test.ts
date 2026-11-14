import { describe, expect, it } from "vitest";
import type { OrgMember, OrgPositionAssignment } from "@/server/services/organization.service";
import {
  loadMemberState,
  memberPage,
  migrateMemberSearchParams,
  positionsByUser,
} from "../members-state";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const member = (n: number, patch: Partial<OrgMember> = {}) =>
  ({
    id: id(n),
    user_id: id(n),
    status: "active",
    joined_at: `2026-11-0${n}T10:00:00Z`,
    user_email: `osoba${n}@example.com`,
    user_first_name: null,
    user_last_name: null,
    user_avatar_url: null,
    roles: [],
    ...patch,
  }) as OrgMember;

const rows = [
  member(1, { user_first_name: "Żaneta", user_last_name: "Łęcka" }),
  member(2, {
    status: "inactive",
    roles: [{ id: id(7), name: "Magazyn", scope: "org", scope_id: id(9) }],
  }),
  member(3, { user_first_name: "Adam" }),
];
const positions = positionsByUser([
  { id: id(5), user_id: id(3), position_id: id(8), deleted_at: null } as OrgPositionAssignment,
  {
    id: id(6),
    user_id: id(1),
    position_id: id(8),
    deleted_at: "2026-11-02T00:00:00Z",
  } as OrgPositionAssignment,
]);

describe("member list address", () => {
  it("sorts by name (email when none) and searches without accents", () => {
    expect(memberPage(rows, loadMemberState({})).rows.map((m) => m.user_id)).toEqual([
      id(3),
      id(2),
      id(1),
    ]);
    expect(memberPage(rows, loadMemberState({ q: "lecka" })).rows.map((m) => m.user_id)).toEqual([
      id(1),
    ]);
  });

  it("filters by status, role and current position", () => {
    expect(memberPage(rows, loadMemberState({ status: "inactive" })).totalCount).toBe(1);
    expect(memberPage(rows, loadMemberState({ rola: id(7) })).rows[0].user_id).toBe(id(2));
    expect(
      memberPage(rows, loadMemberState({ stanowisko: id(8) }), positions).rows.map((m) => m.user_id)
    ).toEqual([id(3)]);
  });

  it("translates old DataView links", () => {
    const { params, changed } = migrateMemberSearchParams({
      sort: "joined.desc",
      filters: JSON.stringify({ status: "active" }),
    });
    expect(changed).toBe(true);
    expect(params).toMatchObject({ sort: "joined_at", direction: "desc", status: "active" });
  });
});
