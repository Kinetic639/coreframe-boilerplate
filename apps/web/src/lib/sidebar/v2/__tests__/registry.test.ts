import { describe, it, expect } from "vitest";
import { getSidebarRegistry } from "../registry";

describe("Sidebar Registry", () => {
  it("should return main and footer sections", () => {
    const registry = getSidebarRegistry();

    expect(registry.main).toBeDefined();
    expect(registry.footer).toBeDefined();
    expect(registry.main.length).toBeGreaterThan(0);
  });

  it("should have unique IDs for all items", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function collectIds(items: any[]): string[] {
      return items.flatMap((item) => [
        item.id,
        ...(item.children ? collectIds(item.children) : []),
      ]);
    }

    const ids = collectIds(allItems);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(uniqueIds.size); // No duplicates
  });

  it("should use iconKey strings (not React components)", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function checkIconKeys(items: any[]): void {
      items.forEach((item) => {
        expect(typeof item.iconKey).toBe("string");
        if (item.children) {
          checkIconKeys(item.children);
        }
      });
    }

    checkIconKeys(allItems);
  });

  it("should have valid permission slugs in visibility rules", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function checkPermissions(items: any[]): void {
      items.forEach((item) => {
        if (item.visibility?.requiresPermissions) {
          expect(Array.isArray(item.visibility.requiresPermissions)).toBe(true);
          item.visibility.requiresPermissions.forEach((perm: string) => {
            expect(typeof perm).toBe("string");
            expect(perm.length).toBeGreaterThan(0);
          });
        }
        if (item.children) {
          checkPermissions(item.children);
        }
      });
    }

    checkPermissions(allItems);
  });

  it("should use imported permission constants (no raw strings in registry file)", async () => {
    // CRITICAL: This test prevents silent breakage when permission slugs change in the database
    const path = await import("path");
    const fs = await import("fs/promises");
    const registryFilePath = path.resolve(process.cwd(), "src/lib/sidebar/v2/registry.ts");
    const registrySource = await fs.readFile(registryFilePath, "utf-8");

    // Check that constants are imported
    expect(registrySource).toContain("@/lib/constants/permissions");

    // Find all requires(Any)?Permissions arrays and check for string literals
    const requiresPattern = /requires(?:Any)?Permissions:\s*\[([^\]]+)\]/g;
    let match;
    const violations = [];

    while ((match = requiresPattern.exec(registrySource)) !== null) {
      const fieldName = match[0].split(":")[0].trim();
      const arrayContent = match[1];

      // Check if array contains any string literals (", ' followed by non-uppercase chars)
      // This catches: "org.update", 'teams.read', etc. but NOT constants like ORG_UPDATE
      if (/(["'])[a-z._-]+\1/.test(arrayContent)) {
        const stringMatches = arrayContent.match(/(["'])[a-z._-]+\1/g);
        violations.push({
          field: fieldName,
          found: stringMatches,
          snippet: match[0].substring(0, 80) + (match[0].length > 80 ? "..." : ""),
        });
      }
    }

    if (violations.length > 0) {
      const errorMsg = violations
        .map(
          (v) =>
            `  - Field: ${v.field}\n` +
            `    Found raw strings: ${v.found.join(", ")}\n` +
            `    Snippet: ${v.snippet}`
        )
        .join("\n");

      throw new Error(
        `Registry file contains raw permission strings. Use imported constants instead.\n\n` +
          `Violations found:\n${errorMsg}\n\n` +
          `Import permission constants from @/lib/constants/permissions`
      );
    }

    expect(violations.length).toBe(0);
  });

  it("should use imported module constants (no raw strings in registry file)", async () => {
    // CRITICAL: This test prevents silent breakage when module slugs change in entitlements
    const path = await import("path");
    const fs = await import("fs/promises");
    const registryFilePath = path.resolve(process.cwd(), "src/lib/sidebar/v2/registry.ts");
    const registrySource = await fs.readFile(registryFilePath, "utf-8");

    // Check that constants are imported
    expect(registrySource).toContain("@/lib/constants/modules");

    // Find all requires(Any)?Modules arrays and check for string literals
    const requiresPattern = /requires(?:Any)?Modules:\s*\[([^\]]+)\]/g;
    let match;
    const violations = [];

    while ((match = requiresPattern.exec(registrySource)) !== null) {
      const fieldName = match[0].split(":")[0].trim();
      const arrayContent = match[1];

      // Check if array contains any string literals (", ' followed by lowercase/hyphen)
      // This catches: "warehouse", 'analytics', "organization-management", etc. but NOT MODULE_WAREHOUSE
      if (/(["'])[a-z-]+\1/.test(arrayContent)) {
        const stringMatches = arrayContent.match(/(["'])[a-z-]+\1/g);
        violations.push({
          field: fieldName,
          found: stringMatches,
          snippet: match[0].substring(0, 80) + (match[0].length > 80 ? "..." : ""),
        });
      }
    }

    if (violations.length > 0) {
      const errorMsg = violations
        .map(
          (v) =>
            `  - Field: ${v.field}\n` +
            `    Found raw strings: ${v.found.join(", ")}\n` +
            `    Snippet: ${v.snippet}`
        )
        .join("\n");

      throw new Error(
        `Registry file contains raw module strings. Use imported constants instead.\n\n` +
          `Violations found:\n${errorMsg}\n\n` +
          `Import module constants from @/lib/constants/modules`
      );
    }

    expect(violations.length).toBe(0);
  });

  it("should be deterministic (same output every call)", () => {
    const registry1 = getSidebarRegistry();
    const registry2 = getSidebarRegistry();

    expect(JSON.stringify(registry1)).toBe(JSON.stringify(registry2));
  });

  it("should detect mixed constants and raw strings (negative test)", () => {
    // This test verifies that the enforcement logic catches even mixed cases
    const fakeRegistrySnippet = `
      visibility: {
        requiresPermissions: [ORG_UPDATE, "org.read"],
      }
    `;

    // Simulate the enforcement check
    const requiresPattern = /requires(?:Any)?Permissions:\s*\[([^\]]+)\]/g;
    const match = requiresPattern.exec(fakeRegistrySnippet);

    expect(match).not.toBeNull();
    if (match) {
      const arrayContent = match[1];
      const hasRawStrings = /(["'])[a-z._-]+\1/.test(arrayContent);
      expect(hasRawStrings).toBe(true); // Should detect "org.read"
    }
  });
});
