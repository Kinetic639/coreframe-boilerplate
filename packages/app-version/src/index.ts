import changelog from "./changelog.json";
import type { Release } from "../scripts/changelog-parser.mjs";
import packageJson from "../package.json";

export type { ChangeGroup, ChangeKind, Release } from "../scripts/changelog-parser.mjs";

/** The version of the Ambra system in the repository (the one this build was made from). */
export const APP_VERSION: string = packageJson.version;

/** Every release, newest first, from CHANGELOG.md (refreshed by the release script). */
export const RELEASES: readonly Release[] = changelog as Release[];

/** Short commit id for display: "a1b2c3d". */
export function shortCommit(commit: string | null | undefined): string | null {
  const trimmed = commit?.trim();
  return trimmed ? trimmed.slice(0, 7) : null;
}

/** "1.4.0 (a1b2c3d)", or just "1.4.0" when the build has no commit (local runs). */
export function formatVersion(version: string, commit?: string | null): string {
  const short = shortCommit(commit);
  return short ? `${version} (${short})` : version;
}

/**
 * Compares two SemVer versions (x.y.z, pre-release tags ignored).
 * Negative when `a` is older than `b`, 0 when equal, positive when newer.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split("-")[0]!
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Releases newer than `version` (the ones a user has not seen yet), newest first. */
export function releasesSince(version: string | null, releases: readonly Release[] = RELEASES) {
  if (!version) return [];
  return releases.filter((r) => compareVersions(r.version, version) > 0);
}
