/**
 * @vitest-environment node
 *
 * Tests for PermissionServiceV2 static helpers.
 * Focus: wildcard-safe canFromSnapshot and wildcard matrix documentation.
 */
import { describe, it, expect } from "vitest";
import { PermissionServiceV2 } from "../permission-v2.service";

describe("PermissionServiceV2.canFromSnapshot", () => {
  // -----------------------------------------------------------------------
  // Wildcard safety — previously returned false for wildcard slugs (bug fix)
  // -----------------------------------------------------------------------

  it("returns true when allow list contains a matching wildcard", () => {
    const snapshot = { allow: ["warehouse.*"], deny: [] };
    // Previously failed: Array.includes("warehouse.*") !== "warehouse.products.read"
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("returns true for multi-segment wildcard", () => {
    const snapshot = { allow: ["warehouse.products.*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.delete")).toBe(true);
  });

  it("returns true for universal wildcard *", () => {
    const snapshot = { allow: ["*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "any.permission.here")).toBe(true);
  });

  it("returns true for module.* wildcard (UEP wildcard slug from org_owner role)", () => {
    const snapshot = { allow: ["module.*"], deny: [] };
    expect(
      PermissionServiceV2.canFromSnapshot(snapshot, "module.organization-management.access")
    ).toBe(true);
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "module.warehouse.access")).toBe(true);
  });

  it("returns false for non-matching wildcard", () => {
    const snapshot = { allow: ["warehouse.*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "teams.members.read")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Deny-first semantics — inherited from checkPermission delegation
  // -----------------------------------------------------------------------

  it("deny-first: returns false when wildcard allow is overridden by exact deny", () => {
    const snapshot = { allow: ["warehouse.*"], deny: ["warehouse.products.delete"] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.delete")).toBe(false);
    // Other warehouse perms still allowed
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("deny-first: wildcard deny blocks all matching permissions", () => {
    const snapshot = { allow: ["warehouse.*"], deny: ["warehouse.*"] };
    // Deny wildcard takes precedence even though allow wildcard matches
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Exact match still works (regression)
  // -----------------------------------------------------------------------

  it("exact match: returns true for permission present in allow list", () => {
    const snapshot = { allow: ["org.read", "members.manage"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "org.read")).toBe(true);
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "members.manage")).toBe(true);
  });

  it("exact match: returns false for permission absent from allow list", () => {
    const snapshot = { allow: ["org.read"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "members.manage")).toBe(false);
  });

  it("returns false for empty allow list", () => {
    const snapshot = { allow: [], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "org.read")).toBe(false);
  });
});

describe("PermissionServiceV2.can (Set-based, exact match)", () => {
  it("returns true for exact match", () => {
    const perms = new Set(["org.read", "members.manage"]);
    expect(PermissionServiceV2.can(perms, "org.read")).toBe(true);
  });

  it("returns false when not present (wildcards NOT expanded)", () => {
    const perms = new Set(["warehouse.*"]);
    // can() is Set.has() — exact match only, not wildcard-aware
    expect(PermissionServiceV2.can(perms, "warehouse.products.read")).toBe(false);
    // Only matches the wildcard slug itself
    expect(PermissionServiceV2.can(perms, "warehouse.*")).toBe(true);
  });
});
