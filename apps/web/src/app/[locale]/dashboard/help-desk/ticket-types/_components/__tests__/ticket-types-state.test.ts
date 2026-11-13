import { describe, expect, it } from "vitest";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import {
  loadTicketTypeState,
  migrateTicketTypeSearchParams,
  ticketTypeHref,
  ticketTypePage,
} from "../ticket-types-state";

const BRANCH = "11111111-1111-4111-8111-111111111111";

function type(
  name: string,
  patch: Partial<HelpdeskTicketTypeWithDetails> = {}
): HelpdeskTicketTypeWithDetails {
  return {
    id: `00000000-0000-4000-8000-${String(name.length).padStart(12, "0")}`,
    org_id: "org",
    key: null,
    name,
    description: null,
    color: "#000",
    icon: "tag",
    is_active: true,
    is_system: false,
    allows_manual_assignees: true,
    default_priority: "medium",
    sort_order: 0,
    scope: "org",
    branch_id: null,
    requires_acceptance: false,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: null,
    default_responders: [],
    default_acceptors: [],
    ...patch,
  };
}

const TYPES = [
  type("Awaria", { sort_order: 2, default_priority: "urgent" }),
  type("Dostęp", { sort_order: 1, description: "Konta i hasła" }),
  type("Zamówienie", {
    sort_order: 3,
    scope: "branch",
    branch_id: BRANCH,
    requires_acceptance: true,
    is_active: false,
  }),
];

describe("ticket types list address", () => {
  it("keeps the configured order by default", () => {
    const page = ticketTypePage(TYPES, loadTicketTypeState({}));
    expect(page.rows.map((t) => t.name)).toEqual(["Dostęp", "Awaria", "Zamówienie"]);
    expect(page.totalCount).toBe(3);
  });

  it("searches name and description, ignoring accents and case", () => {
    expect(ticketTypePage(TYPES, loadTicketTypeState({ q: "HASLA" })).rows[0].name).toBe("Dostęp");
  });

  it("filters by scope, branch, acceptance and state", () => {
    const names = (raw: Record<string, string>) =>
      ticketTypePage(TYPES, loadTicketTypeState(raw)).rows.map((t) => t.name);
    expect(names({ zakres: "branch" })).toEqual(["Zamówienie"]);
    expect(names({ oddzial: BRANCH })).toEqual(["Zamówienie"]);
    expect(names({ akceptacja: "nie" })).toEqual(["Dostęp", "Awaria"]);
    expect(names({ stan: "aktywne" })).toEqual(["Dostęp", "Awaria"]);
    expect(names({ priorytet: "urgent" })).toEqual(["Awaria"]);
  });

  it("sorts by priority and clamps a page past the end", () => {
    const state = loadTicketTypeState({
      sort: "default_priority",
      direction: "desc",
      strona: "9",
      wierszy: "20",
    });
    const page = ticketTypePage(TYPES, state);
    expect(page.rows[0].name).toBe("Awaria");
    expect(page.page).toBe(1);
  });

  it("translates an old DataView link once", () => {
    const { params, changed } = migrateTicketTypeSearchParams({ page: "2", filters: "{}" });
    expect(changed).toBe(true);
    expect(ticketTypeHref("/typy", loadTicketTypeState(params))).toBe("/typy?strona=2");
    expect(migrateTicketTypeSearchParams(params).changed).toBe(false);
  });
});
