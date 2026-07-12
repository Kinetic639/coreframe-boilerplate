/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { CrmPartiesService } from "../crm-parties.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PARTY_ID = "33333333-3333-4333-8333-333333333333";
const CONTACT_LINK_ID = "44444444-4444-4444-8444-444444444444";
const ADDRESS_ID = "55555555-5555-4555-8555-555555555555";

type Operation = {
  table: string;
  action: string;
  payload?: unknown;
  args?: unknown[];
};

function createPartyRow() {
  return {
    id: PARTY_ID,
    organization_id: ORG_ID,
    counterparty_number: 81,
    party_kind: "organization",
    display_name: "Ambra Supplier",
    legal_name: "Ambra Supplier sp. z o.o.",
    tax_id: "1234567890",
    vat_id: null,
    regon: null,
    krs: null,
    email: "supplier@example.com",
    phone: null,
    website: null,
    logo_storage_path: null,
    status: "active",
    notes: null,
    created_at: "2026-07-11T10:00:00.000Z",
    updated_at: "2026-07-11T10:00:00.000Z",
    crm_party_roles: [{ role: "supplier" }],
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
    delete() {
      chain.currentAction = "delete";
      operations.push({ table, action: "delete" });
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
      chain.data = [createPartyRow()];
      chain.count = 1;
      return chain;
    },
    limit(...args: unknown[]) {
      operations.push({ table, action: "limit", args });
      chain.data = [
        {
          id: PARTY_ID,
          counterparty_number: 81,
          display_name: "Ambra Supplier",
          email: "supplier@example.com",
          phone: null,
          crm_party_roles: [{ role: "supplier" }],
        },
      ];
      return chain;
    },
    single() {
      operations.push({ table, action: "single" });
      if (table === "crm_parties" && chain.currentAction === "insert") {
        chain.data = { id: PARTY_ID };
      } else if (table === "crm_parties") {
        chain.data = createPartyRow();
      }
      return chain;
    },
    maybeSingle() {
      operations.push({ table, action: "maybeSingle" });
      if (table === "crm_parties") {
        chain.data = { id: PARTY_ID };
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
      rpc: vi.fn().mockResolvedValue({ data: 81, error: null }),
      from: vi.fn((table: string) => {
        const chain = createChain(table, operations);
        if (table === "crm_party_contacts" || table === "crm_party_addresses") {
          chain.data = [];
        }
        return chain;
      }),
    },
  };
}

describe("CrmPartiesService", () => {
  it("scopes list queries by organization and supports kontrahent number search", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.listForDataView(supabase.client as never, ORG_ID, {
      page: 1,
      pageSize: 20,
      search: "81",
      filters: { role: "supplier" },
      sort: { field: "counterparty_number", direction: "asc" },
    });

    expect(result.success).toBe(true);
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "is",
      args: ["deleted_at", null],
    });
    expect(
      supabase.operations.some(
        (op) =>
          op.table === "crm_parties" &&
          op.action === "or" &&
          String(op.args?.[0]).includes("counterparty_number.eq.81")
      )
    ).toBe(true);
  });

  it("assigns counterparty numbers server-side through the database RPC", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.create(supabase.client as never, ORG_ID, USER_ID, {
      party_kind: "organization",
      display_name: "Ambra Supplier",
      status: "active",
      roles: ["supplier"],
    });

    expect(result.success).toBe(true);
    expect(supabase.client.rpc).toHaveBeenCalledWith(
      "reserve_organization_entity_number",
      expect.objectContaining({
        org_id: ORG_ID,
        entity_type: "crm_party",
        entity_id: expect.any(String),
      })
    );
    const insert = supabase.operations.find(
      (op) => op.table === "crm_parties" && op.action === "insert"
    );
    expect(insert?.payload).toEqual(
      expect.objectContaining({
        organization_id: ORG_ID,
        counterparty_number: 81,
        created_by: USER_ID,
        updated_by: USER_ID,
      })
    );
  });

  it("soft-deletes parties instead of issuing hard deletes", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.softDelete(
      supabase.client as never,
      ORG_ID,
      USER_ID,
      PARTY_ID
    );

    expect(result.success).toBe(true);
    expect(
      supabase.operations.some((op) => op.table === "crm_parties" && op.action === "delete")
    ).toBe(false);
    const update = supabase.operations.find(
      (op) => op.table === "crm_parties" && op.action === "update"
    );
    expect(update?.payload).toEqual(
      expect.objectContaining({ updated_by: USER_ID, status: "archived" })
    );
  });

  it("unlinks party contacts through a scoped soft delete", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.unlinkContact(supabase.client as never, ORG_ID, {
      party_id: PARTY_ID,
      link_id: CONTACT_LINK_ID,
    });

    expect(result.success).toBe(true);
    expect(
      supabase.operations.some((op) => op.table === "crm_party_contacts" && op.action === "delete")
    ).toBe(false);
    const update = supabase.operations.find(
      (op) => op.table === "crm_party_contacts" && op.action === "update"
    );
    expect(update?.payload).toEqual({ deleted_at: expect.any(String) });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_contacts",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_contacts",
      action: "eq",
      args: ["party_id", PARTY_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_contacts",
      action: "eq",
      args: ["id", CONTACT_LINK_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_contacts",
      action: "is",
      args: ["deleted_at", null],
    });
  });

  it("removes party addresses through a scoped soft delete", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.deleteAddress(supabase.client as never, ORG_ID, {
      party_id: PARTY_ID,
      address_id: ADDRESS_ID,
    });

    expect(result.success).toBe(true);
    expect(
      supabase.operations.some((op) => op.table === "crm_party_addresses" && op.action === "delete")
    ).toBe(false);
    const update = supabase.operations.find(
      (op) => op.table === "crm_party_addresses" && op.action === "update"
    );
    expect(update?.payload).toEqual({ deleted_at: expect.any(String) });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_addresses",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_addresses",
      action: "eq",
      args: ["party_id", PARTY_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_addresses",
      action: "eq",
      args: ["id", ADDRESS_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_party_addresses",
      action: "is",
      args: ["deleted_at", null],
    });
  });

  it("searches only active CRM parties with the supplier role for warehouse supplier pickers", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.searchSuppliers(
      supabase.client as never,
      ORG_ID,
      "81",
      10
    );

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: PARTY_ID,
          counterparty_number: 81,
          display_name: "Ambra Supplier",
          legal_name: null,
          tax_id: null,
          email: "supplier@example.com",
          phone: null,
          website: null,
          logo_storage_path: null,
          roles: ["supplier"],
        },
      ],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "eq",
      args: ["crm_party_roles.role", "supplier"],
    });
    expect(
      supabase.operations.some(
        (op) =>
          op.table === "crm_parties" &&
          op.action === "or" &&
          String(op.args?.[0]).includes("counterparty_number.eq.81")
      )
    ).toBe(true);
  });

  it("looks up a CRM party by plain integer counterparty number", async () => {
    const supabase = createSupabaseMock();

    const result = await CrmPartiesService.lookupByCounterpartyNumber(
      supabase.client as never,
      ORG_ID,
      81
    );

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: PARTY_ID,
        counterparty_number: 81,
        display_name: "Ambra Supplier",
        legal_name: "Ambra Supplier sp. z o.o.",
        tax_id: "1234567890",
      }),
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(supabase.operations).toContainEqual({
      table: "crm_parties",
      action: "eq",
      args: ["counterparty_number", 81],
    });
  });
});
