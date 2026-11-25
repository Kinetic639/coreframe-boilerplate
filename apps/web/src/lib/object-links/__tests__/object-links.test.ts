import { describe, expect, it } from "vitest";
import { objectHref, objectRoute } from "@/lib/object-links";

const ID = "1d557143-d529-4046-bb07-5adce1b68100";

describe("objectRoute", () => {
  it("opens a ticket by its number in the list's side panel", () => {
    expect(objectRoute("ticket", { id: ID, code: "HD-000001" })).toEqual({
      pathname: "/dashboard/help-desk/tickets",
      query: { selected: "HD-000001" },
    });
  });

  it("falls back to the ticket page by id when the number is unknown", () => {
    expect(objectRoute("ticket", { id: ID })).toEqual({
      pathname: `/dashboard/help-desk/tickets/${ID}`,
    });
  });

  it("opens a task by its number in the task list", () => {
    expect(objectHref(objectRoute("task", { id: ID, code: "PT-000042" })!)).toBe(
      "/dashboard/planning/tasks?selected=PT-000042"
    );
  });

  it.each([
    ["repairOrder", `/dashboard/workshop/${ID}`],
    ["item", `/dashboard/warehouse/items/${ID}`],
    ["document", `/dashboard/warehouse/inventory/movements/${ID}`],
    ["container", `/dashboard/warehouse/containers/${ID}`],
    ["location", `/dashboard/warehouse/locations?selected=${ID}&view=tree`],
    ["party", `/dashboard/crm/parties?selected=${ID}`],
    ["contact", `/dashboard/crm/contacts?selected=${ID}`],
    ["person", `/dashboard/organization/users/members/${ID}`],
    ["board", `/dashboard/planning/boards?board=${ID}`],
    ["map", `/dashboard/warehouse/map/${ID}`],
    ["ticketType", `/dashboard/help-desk/ticket-types/${ID}`],
    ["audit", `/dashboard/warehouse/audits/${ID}/count`],
  ])("%s → %s", (type, href) => {
    expect(objectHref(objectRoute(type, { id: ID, code: "X-1" })!)).toBe(href);
  });

  it("opens a comment's target object", () => {
    expect(
      objectRoute("comment", { id: "c", meta: { targetType: "helpdesk.ticket", targetId: ID } })
    ).toEqual({ pathname: `/dashboard/help-desk/tickets/${ID}` });
    expect(
      objectRoute("attachment", {
        id: "a",
        meta: { targetType: "workshop.repair_order", targetId: ID },
      })
    ).toEqual({ pathname: `/dashboard/workshop/${ID}` });
  });

  it("has no route for unknown types", () => {
    expect(objectRoute("nope", { id: ID })).toBeNull();
  });
});
