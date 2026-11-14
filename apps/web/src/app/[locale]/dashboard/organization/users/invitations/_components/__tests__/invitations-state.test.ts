import { describe, expect, it } from "vitest";
import type { OrgInvitation } from "@/server/services/organization.service";
import { invitationPage, loadInvitationState } from "../invitations-state";

const invitation = (n: number, patch: Partial<OrgInvitation>) =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    email: `osoba${n}@example.com`,
    status: "pending",
    invited_first_name: null,
    invited_last_name: null,
    role_summary: null,
    deleted_at: null,
    created_at: `2026-11-0${n}T10:00:00Z`,
    expires_at: null,
    ...patch,
  }) as OrgInvitation;

const rows = [
  invitation(1, { status: "accepted" }),
  invitation(2, { invited_first_name: "Łucja" }),
  invitation(3, { deleted_at: "2026-11-05T00:00:00Z" }),
];

describe("invitation list address", () => {
  it("shows the newest first and never a deleted one", () => {
    expect(invitationPage(rows, loadInvitationState({})).rows.map((i) => i.email)).toEqual([
      "osoba2@example.com",
      "osoba1@example.com",
    ]);
  });

  it("filters by status and finds the invited name", () => {
    expect(invitationPage(rows, loadInvitationState({ status: "accepted" })).totalCount).toBe(1);
    expect(invitationPage(rows, loadInvitationState({ q: "lucja" })).totalCount).toBe(1);
  });
});
