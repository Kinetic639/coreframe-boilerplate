/**
 * @repo/contracts — Invariant Tests
 *
 * Verifies that exported constants meet the format contract.
 * These tests catch accidental regressions (typos, duplicates, empty values)
 * before they reach the database or permission checks.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSION_SLUGS,
  CRM_CONTACTS_CREATE,
  CRM_CONTACTS_DELETE,
  CRM_CONTACTS_READ,
  CRM_CONTACTS_UPDATE,
  CRM_PARTIES_CREATE,
  CRM_PARTIES_DELETE,
  CRM_PARTIES_READ,
  CRM_PARTIES_UPDATE,
  CRM_READ,
  CRM_WILDCARD,
  MODULE_CRM_ACCESS,
  MODULE_VMI_ACCESS,
  VMI_CLIENTS_MANAGE,
  VMI_CLIENTS_READ,
  VMI_INVITATIONS_MANAGE,
  VMI_INVENTORY_MANAGE,
  VMI_INVENTORY_READ,
  VMI_LOCATIONS_MANAGE,
  VMI_LOCATIONS_READ,
  VMI_MESSAGES_READ,
  VMI_MESSAGES_SEND,
  VMI_ORDERS_MANAGE,
  VMI_ORDERS_READ,
  VMI_PROPOSALS_MANAGE,
  VMI_PROPOSALS_READ,
  VMI_READ,
  VMI_SETTINGS_MANAGE,
  VMI_STOCK_COUNTS_MANAGE,
  VMI_STOCK_COUNTS_READ,
  VMI_WILDCARD,
} from "../permissions.js";
import { MODULE_CRM, MODULE_VMI, PREMIUM_MODULES } from "../modules.js";

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

// ---------------------------------------------------------------------------
// CRM module invariants
// ---------------------------------------------------------------------------

describe("CRM module contract", () => {
  it("is registered as a premium module", () => {
    expect(MODULE_CRM).toBe("crm");
    expect(PREMIUM_MODULES).toContain(MODULE_CRM);
  });

  it("exports every CRM permission through ALL_PERMISSION_SLUGS", () => {
    const crmSlugs = [
      MODULE_CRM_ACCESS,
      CRM_WILDCARD,
      CRM_READ,
      CRM_PARTIES_READ,
      CRM_PARTIES_CREATE,
      CRM_PARTIES_UPDATE,
      CRM_PARTIES_DELETE,
      CRM_CONTACTS_READ,
      CRM_CONTACTS_CREATE,
      CRM_CONTACTS_UPDATE,
      CRM_CONTACTS_DELETE,
    ];

    for (const slug of crmSlugs) {
      expect(ALL_PERMISSION_SLUGS).toContain(slug);
    }
  });
});

// ---------------------------------------------------------------------------
// VMI module invariants
// ---------------------------------------------------------------------------

describe("VMI module contract", () => {
  it("is registered as a premium module", () => {
    expect(MODULE_VMI).toBe("vmi");
    expect(PREMIUM_MODULES).toContain(MODULE_VMI);
  });

  it("exports every VMI permission through ALL_PERMISSION_SLUGS", () => {
    const vmiSlugs = [
      MODULE_VMI_ACCESS,
      VMI_WILDCARD,
      VMI_READ,
      VMI_CLIENTS_READ,
      VMI_CLIENTS_MANAGE,
      VMI_INVITATIONS_MANAGE,
      VMI_LOCATIONS_READ,
      VMI_LOCATIONS_MANAGE,
      VMI_INVENTORY_READ,
      VMI_INVENTORY_MANAGE,
      VMI_STOCK_COUNTS_READ,
      VMI_STOCK_COUNTS_MANAGE,
      VMI_PROPOSALS_READ,
      VMI_PROPOSALS_MANAGE,
      VMI_ORDERS_READ,
      VMI_ORDERS_MANAGE,
      VMI_MESSAGES_READ,
      VMI_MESSAGES_SEND,
      VMI_SETTINGS_MANAGE,
    ];

    for (const slug of vmiSlugs) {
      expect(ALL_PERMISSION_SLUGS).toContain(slug);
    }
  });
});
