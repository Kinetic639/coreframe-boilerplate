/**
 * @repo/domain — Permission Tests
 *
 * Tests checkPermission and matchesAnyPattern with deny-first semantics,
 * wildcard matching, and regex cache behavior.
 *
 * Suites:
 *   T-PERM-EXACT:    Exact match (allow/deny)
 *   T-PERM-WILDCARD: Wildcard pattern matching
 *   T-PERM-DENY:     Deny-first semantics
 *   T-PERM-CACHE:    Regex cache utility
 */

import { describe, it, expect, afterEach } from "vitest";
import { checkPermission, matchesAnyPattern, clearPermissionRegexCache } from "../permissions.js";
import { makePermissionSnapshot } from "@repo/testing/factories/permissions";

afterEach(() => {
  clearPermissionRegexCache();
});

// ---------------------------------------------------------------------------
// T-PERM-EXACT: Exact match
// ---------------------------------------------------------------------------

describe("T-PERM-EXACT: exact match", () => {
  it("returns true for an exact slug in allow list", () => {
    const snapshot = makePermissionSnapshot(["warehouse.products.read"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("returns false for a slug not in allow list", () => {
    const snapshot = makePermissionSnapshot(["warehouse.products.read"]);
    expect(checkPermission(snapshot, "warehouse.products.create")).toBe(false);
  });

  it("returns false for empty allow list", () => {
    const snapshot = makePermissionSnapshot([]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
  });

  it("returns false when slug is in deny list (exact)", () => {
    const snapshot = makePermissionSnapshot(
      ["warehouse.products.read"],
      ["warehouse.products.read"]
    );
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-PERM-WILDCARD: Wildcard matching
// ---------------------------------------------------------------------------

describe("T-PERM-WILDCARD: wildcard pattern matching", () => {
  it("* matches any permission", () => {
    const snapshot = makePermissionSnapshot(["*"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
    expect(checkPermission(snapshot, "org.read")).toBe(true);
    expect(checkPermission(snapshot, "anything.at.all")).toBe(true);
  });

  it("module.* matches all slugs under that module", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
    expect(checkPermission(snapshot, "warehouse.locations.view")).toBe(true);
    expect(checkPermission(snapshot, "warehouse.inventory.manage")).toBe(true);
  });

  it("module.* does not match slugs in a different module", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"]);
    expect(checkPermission(snapshot, "org.read")).toBe(false);
    expect(checkPermission(snapshot, "members.manage")).toBe(false);
  });

  it("nested wildcard module.submodule.* matches correct slugs", () => {
    const snapshot = makePermissionSnapshot(["warehouse.products.*"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
    expect(checkPermission(snapshot, "warehouse.products.create")).toBe(true);
    expect(checkPermission(snapshot, "warehouse.locations.read")).toBe(false);
  });

  it("matchesAnyPattern returns true for * against any string", () => {
    expect(matchesAnyPattern(["*"], "org.read")).toBe(true);
    expect(matchesAnyPattern(["*"], "anything")).toBe(true);
  });

  it("matchesAnyPattern returns false for empty patterns", () => {
    expect(matchesAnyPattern([], "org.read")).toBe(false);
  });

  it("matchesAnyPattern returns true for exact match (no wildcard)", () => {
    expect(matchesAnyPattern(["org.read", "org.update"], "org.update")).toBe(true);
  });

  it("matchesAnyPattern returns false when no pattern matches", () => {
    expect(matchesAnyPattern(["warehouse.*", "org.read"], "members.manage")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-PERM-DENY: Deny-first semantics
// ---------------------------------------------------------------------------

describe("T-PERM-DENY: deny-first semantics", () => {
  it("deny overrides allow for exact slug", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"], ["warehouse.products.delete"]);
    expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false);
    // Other warehouse slugs still allowed
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("deny wildcard blocks all matching slugs even if individually allowed", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"], ["warehouse.products.*"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
    expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false);
    // Locations not blocked
    expect(checkPermission(snapshot, "warehouse.locations.read")).toBe(true);
  });

  it("deny * blocks everything", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"], ["*"]);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
    expect(checkPermission(snapshot, "org.read")).toBe(false);
  });

  it("no deny — allow wildcard grants access", () => {
    const snapshot = makePermissionSnapshot(["org.*"]);
    expect(checkPermission(snapshot, "org.read")).toBe(true);
    expect(checkPermission(snapshot, "org.update")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-PERM-CACHE: Regex cache
// ---------------------------------------------------------------------------

describe("T-PERM-CACHE: regex cache", () => {
  it("repeated calls with same wildcard pattern use cache (same result)", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"]);
    // Call twice — result must be identical (cache hit)
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("clearPermissionRegexCache does not break subsequent checks", () => {
    const snapshot = makePermissionSnapshot(["warehouse.*"]);
    checkPermission(snapshot, "warehouse.products.read");
    clearPermissionRegexCache();
    // After clearing, patterns should still work
    expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
  });
});
