/**
 * @repo/contracts — Invariant Tests
 *
 * Verifies that exported constants meet the format contract.
 * These tests catch accidental regressions (typos, duplicates, empty values)
 * before they reach the database or permission checks.
 */

import { describe, it, expect } from "vitest";
import { ALL_PERMISSION_SLUGS } from "../permissions.js";

// ---------------------------------------------------------------------------
// Permission slug invariants
// ---------------------------------------------------------------------------

describe("ALL_PERMISSION_SLUGS", () => {
  it("has no duplicate slugs", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const slug of ALL_PERMISSION_SLUGS) {
      if (seen.has(slug)) duplicates.push(slug);
      seen.add(slug);
    }
    expect(duplicates, `Duplicate slugs found: ${duplicates.join(", ")}`).toHaveLength(0);
  });

  it("contains only non-empty strings", () => {
    const empties = ALL_PERMISSION_SLUGS.filter((s) => !s || s.trim().length === 0);
    expect(empties).toHaveLength(0);
  });

  it("each slug is lowercase with no spaces", () => {
    const invalid = ALL_PERMISSION_SLUGS.filter((s) => {
      // Allow: lowercase letters, digits, dots, hyphens, underscores, asterisk
      return !/^[a-z0-9._*-]+$/.test(s);
    });
    expect(invalid, `Slugs with invalid format: ${invalid.join(", ")}`).toHaveLength(0);
  });

  it("each slug either has a dot separator or is a wildcard segment", () => {
    // Every slug must either contain a dot (namespaced) or end with .*
    const nonNamespaced = ALL_PERMISSION_SLUGS.filter(
      (s) => !s.includes(".") && (s as string) !== "*"
    );
    expect(nonNamespaced, `Slugs without namespace: ${nonNamespaced.join(", ")}`).toHaveLength(0);
  });

  it("has at least 30 slugs (regression guard against accidental truncation)", () => {
    expect(ALL_PERMISSION_SLUGS.length).toBeGreaterThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// Individual slug format spot-checks
// ---------------------------------------------------------------------------

describe("permission slug format spot-checks", () => {
  it("wildcard slugs end with .*", () => {
    const wildcards = ALL_PERMISSION_SLUGS.filter((s) => s.includes("*"));
    for (const slug of wildcards) {
      expect(slug, `Wildcard slug has unexpected format: ${slug}`).toMatch(/\.\*$/);
    }
  });

  it("non-wildcard slugs do not contain *", () => {
    const nonWildcards = ALL_PERMISSION_SLUGS.filter((s) => !s.endsWith(".*"));
    for (const slug of nonWildcards) {
      expect(slug).not.toContain("*");
    }
  });
});
