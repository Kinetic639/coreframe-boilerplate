export type ChangeKind = "major" | "minor" | "patch" | "other";
export interface ChangeGroup {
  kind: ChangeKind;
  items: string[];
}
export interface Release {
  version: string;
  date: string | null;
  groups: ChangeGroup[];
}
export const POLISH_HEADINGS: Record<string, string>;
export function parseChangelog(markdown: string): Release[];
export function extractReleaseNotes(markdown: string, version: string): string | null;
export function finalizeReleaseSection(markdown: string, version: string, date: string): string;
