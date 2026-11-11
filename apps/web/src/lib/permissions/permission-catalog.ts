/**
 * Permission catalog for the role editor.
 *
 * The role editor offers every permission an organization may hand out,
 * read from the `permissions` table and grouped by module. Platform
 * permissions (`superadmin.*`) are never offered and are refused on save.
 * Pure: no Supabase, no React.
 */
import { isOrgOnlyPermission } from "@repo/domain/organization";

export interface CatalogPermission {
  slug: string;
  category: string | null;
  /** English name from the database, the fallback label */
  name: string | null;
}

export interface CatalogGroup {
  category: string;
  permissions: CatalogPermission[];
}

/** Categories the platform keeps for itself; an organization cannot grant them. */
export const PLATFORM_ONLY_CATEGORIES = new Set(["superadmin"]);

export function isAssignablePermission(p: Pick<CatalogPermission, "slug" | "category">): boolean {
  if (p.slug.startsWith("superadmin.")) return false;
  return !PLATFORM_ONLY_CATEGORIES.has(p.category ?? "");
}

/** Order of the groups in the editor: modules first, then the work areas, then administration. */
const GROUP_ORDER = [
  "module",
  "warehouse",
  "wdd_matcher",
  "workshop",
  "planning",
  "helpdesk",
  "crm",
  "qr",
  "analytics",
  "tools",
  "messages",
  "org",
  "branches",
  "branch",
  "members",
  "invites",
  "events",
  "audit",
  "account",
  "self",
];

/** Message key of a permission label: dots and the wildcard are not allowed in keys. */
export function permissionLabelKey(slug: string): string {
  return slug.replace(/\*/g, "all").replace(/\./g, "__");
}

export function isWildcard(slug: string): boolean {
  return slug.endsWith(".*");
}

/** May a role of this scope carry the permission? Branch roles cannot carry org-only ones. */
export function allowedInScope(slug: string, scope: "org" | "branch" | null): boolean {
  return scope !== "branch" || !isOrgOnlyPermission(slug);
}

export function groupCatalog(
  catalog: CatalogPermission[],
  scope: "org" | "branch" | null
): CatalogGroup[] {
  const byCategory = new Map<string, CatalogPermission[]>();
  for (const p of catalog) {
    if (!isAssignablePermission(p) || !allowedInScope(p.slug, scope)) continue;
    const category = p.category ?? "other";
    const list = byCategory.get(category) ?? [];
    list.push(p);
    byCategory.set(category, list);
  }
  const rank = (c: string) => {
    const i = GROUP_ORDER.indexOf(c);
    return i === -1 ? GROUP_ORDER.length : i;
  };
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, permissions]) => ({
      category,
      permissions: [...permissions].sort(
        (a, b) =>
          Number(isWildcard(b.slug)) - Number(isWildcard(a.slug)) || a.slug.localeCompare(b.slug)
      ),
    }));
}
