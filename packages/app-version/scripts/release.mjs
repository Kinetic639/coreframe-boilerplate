#!/usr/bin/env node
/* global process, console */
// The release script of the Ambra system version (docs/versioning.md).
//
//   node packages/app-version/scripts/release.mjs prepare
//     Uses up the pending .changeset/*.md files: raises the version in
//     packages/app-version/package.json, writes CHANGELOG.md with today's date and
//     Polish headings, and refreshes src/changelog.json (read by the "What's new" window).
//
//   node packages/app-version/scripts/release.mjs notes [version]
//     Prints the changelog section of a version (default: the current one), for GitHub Releases.
//
//   node packages/app-version/scripts/release.mjs sync
//     Only refreshes src/changelog.json from CHANGELOG.md.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractReleaseNotes,
  finalizeReleaseSection,
  parseChangelog,
} from "./changelog-parser.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageDir, "../..");
const packageJsonPath = path.join(packageDir, "package.json");
const changelogPath = path.join(packageDir, "CHANGELOG.md");
const changelogJsonPath = path.join(packageDir, "src/changelog.json");

const readVersion = () => JSON.parse(readFileSync(packageJsonPath, "utf8")).version;

/** Today in Poland, where the releases are made: YYYY-MM-DD. */
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function sync() {
  const releases = parseChangelog(readFileSync(changelogPath, "utf8"));
  writeFileSync(changelogJsonPath, `${JSON.stringify(releases, null, 2)}\n`);
}

/**
 * Writes a GitHub Actions step output when run in a workflow.
 * @param {string} name
 * @param {string} value
 */
function output(name, value) {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- set by GitHub Actions, not a build input
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

function prepare() {
  const before = readVersion();
  execFileSync("pnpm", ["exec", "changeset", "version"], { cwd: repoRoot, stdio: "inherit" });
  const after = readVersion();

  if (after === before) {
    console.log(`No pending changes to release; the version stays ${before}.`);
    output("released", "false");
    output("version", before);
    return;
  }

  const changelog = readFileSync(changelogPath, "utf8");
  writeFileSync(changelogPath, finalizeReleaseSection(changelog, after, today()));
  sync();
  console.log(`Prepared release ${before} -> ${after}.`);
  output("released", "true");
  output("version", after);
}

/** @param {string} [version] */
function notes(version = readVersion()) {
  const section = extractReleaseNotes(readFileSync(changelogPath, "utf8"), version);
  if (section === null) {
    console.error(`CHANGELOG.md has no section for ${version}.`);
    process.exit(1);
  }
  process.stdout.write(`${section}\n`);
}

const [command, arg] = process.argv.slice(2);
if (command === "prepare") prepare();
else if (command === "notes") notes(arg);
else if (command === "sync") sync();
else {
  console.error("Usage: release.mjs prepare | notes [version] | sync");
  process.exit(1);
}
