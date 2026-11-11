import { describe, expect, it } from "vitest";
import { extractMentions, mentionText } from "@repo/rich-text/mention-utils";
import { extractPlainText } from "@repo/rich-text/rich-text-utils";
import {
  filterMentionPeople,
  hitMention,
  isPlainDocument,
  mentionRoute,
  personMention,
  type MentionPerson,
} from "..";

const person = (userId: string, firstName: string, lastName: string): MentionPerson => ({
  userId,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}@example.test`,
  avatarUrl: null,
  jobTitle: null,
});

const doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hej " },
        { type: "mention", attrs: { type: "person", id: "u1", label: "Paweł Wiśniewski" } },
        { type: "text", text: " zobacz " },
        {
          type: "mention",
          attrs: { type: "repairOrder", id: "r1", label: "Golf VII", code: "174232", href: "/x" },
        },
        { type: "hardBreak" },
        { type: "mention", attrs: { type: "person", id: "u1", label: "Paweł Wiśniewski" } },
        { type: "mention", attrs: { type: "person" } },
      ],
    },
  ],
};

describe("mentions in a document", () => {
  it("plain text shows the name of a person and the number of an object", () => {
    expect(extractPlainText(doc)).toBe("Hej @Paweł Wiśniewski zobacz @174232\n@Paweł Wiśniewski");
    expect(mentionText({ label: "Golf", code: "174232" })).toBe("@174232");
  });

  it("extracts each mention once, in order, skipping nodes without an id", () => {
    expect(extractMentions(doc).map((m) => `${m.type}:${m.id}`)).toEqual([
      "person:u1",
      "repairOrder:r1",
    ]);
  });

  it("tells text-only documents from ones with mentions or formatting", () => {
    expect(isPlainDocument(doc)).toBe(false);
    expect(
      isPlainDocument({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }] },
        ],
      })
    ).toBe(true);
    expect(
      isPlainDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }],
          },
        ],
      })
    ).toBe(false);
  });
});

describe("mentionRoute", () => {
  it("accepts internal dashboard paths and splits the query", () => {
    expect(mentionRoute("/dashboard/workshop/abc")).toEqual({
      pathname: "/dashboard/workshop/abc",
    });
    expect(mentionRoute("/dashboard/warehouse/locations?selected=l1&view=tree")).toEqual({
      pathname: "/dashboard/warehouse/locations",
      query: { selected: "l1", view: "tree" },
    });
  });

  it("drops anything that is not an internal dashboard path", () => {
    for (const href of [
      null,
      "",
      "https://evil.example/dashboard/x",
      "//evil.example/dashboard",
      "javascript:alert(1)",
      "/dashboard//evil.example",
      "/admin/users",
      "/dashboard/x y",
    ]) {
      expect(mentionRoute(href)).toBeNull();
    }
  });
});

describe("mention items", () => {
  it("a search hit keeps its number, title and link (with query)", () => {
    expect(
      hitMention({
        type: "location",
        id: "l1",
        code: "A-01",
        title: "Regał A",
        subtitle: null,
        status: null,
        href: "/dashboard/warehouse/locations",
        query: { selected: "l1", view: "tree" },
      })
    ).toEqual({
      type: "location",
      id: "l1",
      label: "Regał A",
      code: "A-01",
      href: "/dashboard/warehouse/locations?selected=l1&view=tree",
    });
  });

  it("a person is mentioned by name", () => {
    expect(personMention(person("u1", "Anna", "Nowak"))).toEqual({
      type: "person",
      id: "u1",
      label: "Anna Nowak",
    });
  });
});

describe("filterMentionPeople", () => {
  const people = [
    person("u1", "Anna", "Nowak"),
    person("u2", "Andrzej", "Zieliński"),
    person("u3", "Paweł", "Wiśniewski"),
  ];

  it("matches from the first letter, without diacritics", () => {
    expect(filterMentionPeople(people, "an", new Set(), 8).map((p) => p.userId)).toEqual([
      "u2",
      "u1",
    ]);
    expect(filterMentionPeople(people, "wisn", new Set(), 8).map((p) => p.userId)).toEqual(["u3"]);
  });

  it("lists people of the conversation first and respects the limit", () => {
    expect(filterMentionPeople(people, "", new Set(["u3"]), 2).map((p) => p.userId)).toEqual([
      "u3",
      "u2",
    ]);
  });
});
