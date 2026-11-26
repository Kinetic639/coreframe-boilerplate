// Reads and edits CHANGELOG.md as written by Changesets (see .changeset/changelog.cjs).
// Plain JavaScript so the release script runs with `node` and needs no build step.

/** @typedef {"major" | "minor" | "patch" | "other"} ChangeKind */
/** @typedef {{ kind: ChangeKind, items: string[] }} ChangeGroup */
/** @typedef {{ version: string, date: string | null, groups: ChangeGroup[] }} Release */

/**
 * Changesets writes the English headings; the release script renames them to Polish.
 * Both spellings are read, so an entry is never lost.
 * @type {Record<string, ChangeKind>}
 */
const HEADING_KINDS = {
  "major changes": "major",
  "zmiany wymagające uwagi": "major",
  "minor changes": "minor",
  "nowe funkcje": "minor",
  "patch changes": "patch",
  poprawki: "patch",
};

/** @type {Record<string, string>} */
export const POLISH_HEADINGS = {
  "Major Changes": "Zmiany wymagające uwagi",
  "Minor Changes": "Nowe funkcje",
  "Patch Changes": "Poprawki",
};

const VERSION_HEADING = /^##\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?\s*$/;

/**
 * Every release in the changelog, newest first, as Changesets keeps them.
 * @param {string} markdown
 * @returns {Release[]}
 */
export function parseChangelog(markdown) {
  /** @type {Release[]} */
  const releases = [];
  /** @type {Release | null} */
  let release = null;
  /** @type {ChangeGroup | null} */
  let group = null;
  /** @type {string[] | null} */
  let item = null;

  const closeItem = () => {
    if (item && group) group.items.push(item.join("\n").trim());
    item = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const versionMatch = VERSION_HEADING.exec(line);
    if (versionMatch) {
      closeItem();
      release = { version: versionMatch[1] ?? "", date: versionMatch[2] ?? null, groups: [] };
      releases.push(release);
      group = null;
      continue;
    }
    if (!release) continue;

    const groupMatch = /^###\s+(.+?)\s*$/.exec(line);
    if (groupMatch) {
      closeItem();
      const kind = HEADING_KINDS[(groupMatch[1] ?? "").toLowerCase()] ?? "other";
      group = { kind, items: [] };
      release.groups.push(group);
      continue;
    }

    const itemMatch = /^[-*]\s+(.*)$/.exec(line);
    if (itemMatch) {
      closeItem();
      if (!group) {
        group = { kind: "other", items: [] };
        release.groups.push(group);
      }
      item = [itemMatch[1] ?? ""];
      continue;
    }

    if (item) {
      // A continuation line of the current entry (Changesets indents it by two spaces).
      item.push(line.replace(/^ {2}/, ""));
    }
  }
  closeItem();

  for (const r of releases) {
    r.groups = r.groups.filter((g) => g.items.length > 0);
  }
  return releases;
}

/**
 * The section of one version, without its `## x.y.z` heading: the release notes on GitHub.
 * @param {string} markdown
 * @param {string} version
 * @returns {string | null}
 */
export function extractReleaseNotes(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => VERSION_HEADING.exec(l)?.[1] === version);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (VERSION_HEADING.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

/**
 * Adds the release date to the heading of `version` and renames its group headings to Polish.
 * Other versions are left as they are, so running it twice changes nothing.
 * @param {string} markdown
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function finalizeReleaseSection(markdown, version, date) {
  const lines = markdown.split("\n");
  let inSection = false;
  return lines
    .map((line) => {
      const match = VERSION_HEADING.exec(line);
      if (match) {
        inSection = match[1] === version;
        if (inSection && !match[2]) return `## ${version} (${date})`;
        return line;
      }
      if (inSection) {
        const heading = /^###\s+(.+?)\s*$/.exec(line);
        const polish = heading ? POLISH_HEADINGS[heading[1] ?? ""] : undefined;
        if (polish) return `### ${polish}`;
      }
      return line;
    })
    .join("\n");
}
