import { describe, expect, it } from "vitest";
import { contactListParams, loadContactState, migrateContactSearchParams } from "../contacts-state";

const ID = "33333333-3333-4333-8333-333333333333";

describe("contacts list address", () => {
  it("keeps an employee's or a contact's key open, and nothing else", () => {
    expect(loadContactState({ selected: `member:${ID}` }).selected).toBe(`member:${ID}`);
    expect(loadContactState({ selected: ID }).selected).toBe(ID);
    expect(loadContactState({ selected: "member:x" }).selected).toBeNull();
  });

  it("narrows to one kind, and both kinds are everyone", () => {
    expect(contactListParams(loadContactState({ rodzaj: "member" })).kind).toBe("member");
    expect(contactListParams(loadContactState({ rodzaj: "member,external" })).kind).toBe("all");
    expect(contactListParams(loadContactState({}))).toEqual({
      kind: "all",
      search: null,
      descending: false,
      page: 1,
      pageSize: 50,
    });
  });

  it("translates old DataView and global search links", () => {
    const { params, changed } = migrateContactSearchParams({
      search: "Jan",
      sort: "display_name.desc",
      filters: JSON.stringify({ kind: "external" }),
    });
    expect(changed).toBe(true);
    expect(loadContactState(params)).toMatchObject({
      q: "Jan",
      direction: "desc",
      rodzaj: ["external"],
    });
  });
});
