import { describe, expect, it } from "vitest";
import {
  getHomeActions,
  activityForBranch,
  readWidget,
  formatActivityDate,
  formatRefreshTime,
  attentionFilters,
  ticketListQuery,
} from "../_lib/model";
import type { ProjectedEvent } from "@/server/audit/types";
import { MODULE_WAREHOUSE, MODULE_HELPDESK, MODULE_PLANNING } from "@/lib/constants/modules";
import {
  HELPDESK_TICKETS_READ,
  MODULE_HELPDESK_ACCESS,
  PERMISSION_TOOLS_READ,
} from "@/lib/constants/permissions";

const modules = [MODULE_WAREHOUSE, MODULE_HELPDESK, MODULE_PLANNING];
describe("home access and composition", () => {
  it("shows only the four implemented entry points for an entitled owner", () => {
    expect(getHomeActions({ allow: ["*"], deny: [] }, modules, true)).toEqual([
      "tools",
      "locations",
      "tickets",
      "tasks",
    ]);
  });
  it("does not interpret permissions as module entitlement", () => {
    expect(getHomeActions({ allow: ["*"], deny: [] }, [], true)).toEqual(["tools"]);
  });
  it("does not show branch-dependent entries without a branch", () => {
    expect(getHomeActions({ allow: ["*"], deny: [] }, modules, false)).toEqual(["tools"]);
  });
  it("hides ticket access for an explicit deny despite wildcard allow", () => {
    expect(
      getHomeActions({ allow: ["*"], deny: [HELPDESK_TICKETS_READ] }, modules, true)
    ).not.toContain("tickets");
  });
  it("requires both leaf and module permissions", () => {
    expect(getHomeActions({ allow: [HELPDESK_TICKETS_READ], deny: [] }, modules, true)).toEqual([]);
    expect(getHomeActions({ allow: [MODULE_HELPDESK_ACCESS], deny: [] }, modules, true)).toEqual(
      []
    );
    expect(
      getHomeActions(
        { allow: [MODULE_HELPDESK_ACCESS, HELPDESK_TICKETS_READ], deny: [] },
        modules,
        true
      )
    ).toEqual(["tickets"]);
  });
  it("keeps tools available without a paid module", () => {
    expect(getHomeActions({ allow: [PERMISSION_TOOLS_READ], deny: [] }, [], true)).toEqual([
      "tools",
    ]);
  });
  it("has an intentional no-access state", () =>
    expect(getHomeActions({ allow: [], deny: [] }, modules, true)).toEqual([]));
});
describe("home data semantics", () => {
  it("uses the same precise branch/priority/status scope for the count and destination", () => {
    const filters = attentionFilters("branch-a");
    expect(filters.branchId).toBe("branch-a");
    expect(filters.status).toEqual(["open", "in_progress", "waiting", "waiting_response"]);
    expect(filters.priority).toEqual(["high", "urgent"]);
    expect(JSON.parse(ticketListQuery("branch-a").filters)).toEqual(filters);
  });
  it("removes other branches before limiting the personal preview", () => {
    const events = ["other", null, "a", "a", "a", "a", "a"].map(
      (branch_id, i) => ({ id: String(i), branch_id }) as ProjectedEvent
    );
    expect(activityForBranch(events, "a").map((e) => e.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(activityForBranch(events, null).map((e) => e.id)).toEqual(["1"]);
  });
  it("returns a real empty result without manufacturing metrics", async () => {
    expect(await readWidget(async () => ({ success: true, data: [] }))).toEqual({
      state: "ready",
      data: [],
    });
  });
  it("sanitizes a service failure and a thrown error independently", async () => {
    const results = await Promise.all([
      readWidget(async () => ({ success: false, error: "SECRET SQL" })),
      readWidget(async () => {
        throw new Error("SECRET token");
      }),
      readWidget(async () => ({ success: true, data: 4 })),
    ]);
    expect(results).toEqual([
      { state: "unavailable" },
      { state: "unavailable" },
      { state: "ready", data: 4 },
    ]);
  });
  it("formats stable Warsaw timestamps and rejects malformed dates", () => {
    expect(formatActivityDate("2026-09-10T12:30:00Z", "pl")).toContain("14:30");
    expect(formatActivityDate("not-a-date", "pl")).toBeNull();
    expect(formatRefreshTime("2026-09-10T12:30:15Z", "pl")).toContain("14:30:15");
    expect(formatRefreshTime("not-a-date", "pl")).toBeNull();
  });
});
