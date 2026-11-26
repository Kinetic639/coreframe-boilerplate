import { describe, expect, it } from "vitest";
import {
  extractReleaseNotes,
  finalizeReleaseSection,
  parseChangelog,
} from "../../scripts/changelog-parser.mjs";

const CHANGESETS_OUTPUT = `# @repo/app-version

## 1.2.0

### Minor Changes

- Help Desk: new ticket opens in a dialog.

### Patch Changes

- Notification links open pages that exist.
  Second line of the same entry.
- Dates in Europe/Warsaw.

## 1.1.0 (2026-11-20)

### Nowe funkcje

- QR labels in any ZPL size.

## 1.0.0 (2026-11-01)

### Zmiany wymagające uwagi

- First version.
`;

describe("parseChangelog", () => {
  it("reads versions, dates and groups, newest first", () => {
    const releases = parseChangelog(CHANGESETS_OUTPUT);
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ["1.2.0", null],
      ["1.1.0", "2026-11-20"],
      ["1.0.0", "2026-11-01"],
    ]);
    expect(releases[0]?.groups).toEqual([
      { kind: "minor", items: ["Help Desk: new ticket opens in a dialog."] },
      {
        kind: "patch",
        items: [
          "Notification links open pages that exist.\nSecond line of the same entry.",
          "Dates in Europe/Warsaw.",
        ],
      },
    ]);
    expect(releases[1]?.groups[0]?.kind).toBe("minor");
    expect(releases[2]?.groups[0]?.kind).toBe("major");
  });

  it("drops empty groups and reads unknown headings as other", () => {
    const releases = parseChangelog("## 2.0.0\n\n### Patch Changes\n\n### Misc\n\n- x\n");
    expect(releases[0]?.groups).toEqual([{ kind: "other", items: ["x"] }]);
  });
});

describe("extractReleaseNotes", () => {
  it("returns one version's section without its heading", () => {
    expect(extractReleaseNotes(CHANGESETS_OUTPUT, "1.1.0")).toBe(
      "### Nowe funkcje\n\n- QR labels in any ZPL size."
    );
  });

  it("returns null for an unknown version", () => {
    expect(extractReleaseNotes(CHANGESETS_OUTPUT, "9.9.9")).toBeNull();
  });
});

describe("finalizeReleaseSection", () => {
  it("dates the new version and renames only its headings", () => {
    const out = finalizeReleaseSection(CHANGESETS_OUTPUT, "1.2.0", "2026-11-26");
    expect(out).toContain("## 1.2.0 (2026-11-26)\n\n### Nowe funkcje");
    expect(out).toContain("### Poprawki");
    expect(out).not.toContain("Minor Changes");
    // Running it again changes nothing.
    expect(finalizeReleaseSection(out, "1.2.0", "2030-01-01")).toBe(out);
  });
});
