/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { CrmContactsService } from "../crm-contacts.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const BRANCH_ID = "33333333-3333-4333-8333-333333333333";
const CONTACT_ID = "44444444-4444-4444-8444-444444444444";

type Operation = {
  table: string;
  action: string;
  payload?: unknown;
  args?: unknown[];
};

function contactRow() {
  return {
    id: CONTACT_ID,
    organization_id: ORG_ID,
    linked_user_id: null,
    visibility_scope: "private",
    owner_user_id: USER_ID,
    branch_id: null,
    display_name: "Jan Kowalski",
    first_name: "Jan",
    last_name: "Kowalski",
    email: "jan@example.com",
    phone: null,
    mobile: null,
    avatar_storage_path: null,
    job_title: null,
    notes: null,
    created_at: "2026-07-11T10:00:00.000Z",
    updated_at: "2026-07-11T10:00:00.000Z",
  };
}

function createChain(table: string, operations: Operation[]) {
  const chain = {
    data: null as unknown,
    error: null as { message: string } | null,
    count: 0 as number | null,
    currentAction: "",
    select(...args: unknown[]) {
      operations.push({ table, action: "select", args });
      return chain;
    },
    insert(payload: unknown) {
      chain.currentAction = "insert";
      operations.push({ table, action: "insert", payload });
      return chain;
    },
    update(payload: unknown) {
      chain.currentAction = "update";
      operations.push({ table, action: "update", payload });
      return chain;
    },
    eq(...args: unknown[]) {
      operations.push({ table, action: "eq", args });
      return chain;
    },
    is(...args: unknown[]) {
      operations.push({ table, action: "is", args });
      return chain;
    },
    or(...args: unknown[]) {
      operations.push({ table, action: "or", args });
      return chain;
    },
    order(...args: unknown[]) {
      operations.push({ table, action: "order", args });
      return chain;
    },
    range(...args: unknown[]) {
      operations.push({ table, action: "range", args });
      chain.data = [contactRow()];
      chain.count = 1;
      return chain;
    },
    single() {
      operations.push({ table, action: "single" });
      if (table === "crm_contacts" && chain.currentAction === "insert") {
        chain.data = { id: CONTACT_ID };
      } else if (table === "crm_contacts") {
        chain.data = contactRow();
      }
      return chain;
    },
  };
  return chain;
}

function createSupabaseMock() {
  const operations: Operation[] = [];
  return {
    operations,
    client: {
      from: (table: string) => {
        const chain = createChain(table, operations);
        if (table === "crm_party_contacts") chain.data = [];
        return chain;
      },
    },
  };
}

describe("CrmContactsService", () => {
  it("scopes contact lists by organization and deleted_at", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmContactsService.listForDataView(supabase.client as never, ORG_ID, {
      page: 1,
      pageSize: 20,
      search: "Jan",
      filters: { visibility_scope: "private" },
      sort: { field: "display_name", direction: "asc" },
    });

    expect(result.success).toBe(true);
    expect(supabase.operations).toContainEqual({
      table: "crm_contacts",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_contacts",
      action: "is",
      args: ["deleted_at", null],
    });
  });

  it("forces private contacts to be owned by the creating user", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmContactsService.create(
      supabase.client as never,
      ORG_ID,
      USER_ID,
      BRANCH_ID,
      {
        visibility_scope: "private",
        owner_user_id: "99999999-9999-4999-8999-999999999999",
        display_name: "Jan Kowalski",
      }
    );

    expect(result.success).toBe(true);
    const insert = supabase.operations.find(
      (op) => op.table === "crm_contacts" && op.action === "insert"
    );
    expect(insert?.payload).toEqual(
      expect.objectContaining({
        organization_id: ORG_ID,
        visibility_scope: "private",
        owner_user_id: USER_ID,
        branch_id: null,
        created_by: USER_ID,
        updated_by: USER_ID,
      })
    );
  });

  it("defaults branch contacts to the active branch when no branch is supplied", async () => {
    const supabase = createSupabaseMock();

    await CrmContactsService.create(supabase.client as never, ORG_ID, USER_ID, BRANCH_ID, {
      visibility_scope: "branch",
      display_name: "Branch Contact",
    });

    const insert = supabase.operations.find(
      (op) => op.table === "crm_contacts" && op.action === "insert"
    );
    expect(insert?.payload).toEqual(
      expect.objectContaining({
        visibility_scope: "branch",
        owner_user_id: null,
        branch_id: BRANCH_ID,
      })
    );
  });
});
