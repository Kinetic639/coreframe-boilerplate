import { describe, expect, it } from "vitest";
import {
  flattenNotifications,
  formatNotificationTime,
  notificationDayGroup,
  prependNotification,
  setReadInList,
  type NotificationsInfiniteData,
} from "../cache";
import { notificationHref, type AppNotification } from "../types";

const notification = (overrides: Partial<AppNotification>): AppNotification => ({
  id: "n1",
  organization_id: "o1",
  type: "ticket.assigned",
  target_type: "helpdesk.ticket",
  target_id: "t1",
  target_code: "HD-000014",
  title: "Drukarka",
  snippet: null,
  data: {},
  created_at: "2026-10-11T10:00:00.000Z",
  read_at: null,
  actor: null,
  ...overrides,
});

const list = (...items: AppNotification[]): NotificationsInfiniteData => ({
  pages: [{ notifications: items, nextCursor: null }],
  pageParams: [null],
});

describe("notifications cache", () => {
  it("puts a new notification on top, once", () => {
    const data = list(notification({ id: "a" }));
    const next = prependNotification(data, notification({ id: "b" }));
    expect(flattenNotifications(next).map((n) => n.id)).toEqual(["b", "a"]);
    expect(flattenNotifications(prependNotification(next, notification({ id: "b" })))).toHaveLength(
      2
    );
    expect(prependNotification(undefined, notification({}))).toBeUndefined();
  });

  it("toggles read and unread for the chosen rows only", () => {
    const data = list(notification({ id: "a" }), notification({ id: "b" }));
    const read = setReadInList(data, ["a"], true, "2026-10-11T11:00:00.000Z");
    expect(flattenNotifications(read).map((n) => n.read_at)).toEqual([
      "2026-10-11T11:00:00.000Z",
      null,
    ]);
    const unread = setReadInList(read, ["a"], false, "x");
    expect(flattenNotifications(unread).map((n) => n.read_at)).toEqual([null, null]);
  });

  it("marks everything read; an unread list drops the rows", () => {
    const data = list(notification({ id: "a" }), notification({ id: "b" }));
    expect(
      flattenNotifications(setReadInList(data, null, true, "now")).every((n) => n.read_at === "now")
    ).toBe(true);
    expect(
      flattenNotifications(setReadInList(data, ["a"], true, "now", true)).map((n) => n.id)
    ).toEqual(["b"]);
  });

  it("groups by day and formats compact times", () => {
    const now = new Date(2026, 9, 11, 12, 0, 0);
    const at = (h: number, daysAgo = 0) => new Date(2026, 9, 11 - daysAgo, h, 0, 0).toISOString();
    expect(notificationDayGroup(at(8), now)).toBe("today");
    expect(notificationDayGroup(at(23, 1), now)).toBe("yesterday");
    expect(notificationDayGroup(at(10, 3), now)).toBe("earlier");
    expect(formatNotificationTime(new Date(2026, 9, 11, 11, 48).toISOString(), "pl", now)).toMatch(
      /12 min/
    );
    expect(formatNotificationTime(at(10), "pl", now)).toMatch(/2 godz/);
    expect(formatNotificationTime(at(16, 1), "pl", now)).toMatch(/wczoraj, 16:00/);
  });

  it("links to the object the notification is about", () => {
    expect(notificationHref({ target_type: "helpdesk.ticket", target_id: "t1" })).toBe(
      "/dashboard/help-desk/tickets/t1"
    );
    expect(notificationHref({ target_type: "planning.task", target_id: "p1" })).toBe(
      "/dashboard/planning/tasks/p1"
    );
    expect(notificationHref({ target_type: "workshop.repair_order", target_id: "r1" })).toBe(
      "/dashboard/workshop/r1"
    );
    expect(notificationHref({ target_type: "something.else", target_id: "x" })).toBeNull();
  });
});
