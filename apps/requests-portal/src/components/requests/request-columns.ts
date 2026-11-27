import type { ColumnSet } from "@/components/data-table/columns";

/** The list's columns, as the ERP tickets list has them (plus the repair order). */
export const REQUEST_COLUMN_IDS = [
  "ticket_type",
  "status",
  "order",
  "branch",
  "acceptance",
  "requester",
  "responders",
  "created_at",
  "updated_at",
] as const;

/** Cookie of the columns' order and widths, per user and organization. */
export const requestColumnsCookie = (userId: string, orgId: string) =>
  `ambra_requests_portal_${userId}_${orgId}`;

export function requestColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const label = (key: string) => labels[key] ?? key;
  return {
    ids: [...REQUEST_COLUMN_IDS],
    labels: {
      ticket_type: label("type"),
      status: label("status"),
      order: label("order"),
      branch: label("branch"),
      acceptance: label("acceptance"),
      requester: label("requester"),
      responders: label("responders"),
      created_at: label("createdAt"),
      updated_at: label("updatedAt"),
    },
    widths: {
      ticket_type: 180,
      status: 170,
      order: 190,
      branch: 150,
      acceptance: 170,
      requester: 90,
      responders: 120,
      created_at: 140,
      updated_at: 140,
    },
    shownByDefault: [
      "ticket_type",
      "status",
      "order",
      "branch",
      "acceptance",
      "requester",
      "responders",
      "updated_at",
    ],
    pinned: { id: "ticket", label: label("ticket"), width: 300 },
  };
}
