/**
 * Contacts directory: employees (read live from their profiles, read-only)
 * and external contacts (crm_contacts) in one list. Rows come from the
 * `contacts_directory` RPC (migration 20261011051553_contacts_directory.sql).
 */

export type ContactDirectoryKind = "member" | "external";
export type ContactDirectoryFilter = "all" | ContactDirectoryKind;

export interface ContactDirectoryRow {
  /** `member:<user id>` for an employee, the contact id for an external contact */
  key: string;
  kind: ContactDirectoryKind;
  user_id: string | null;
  /** External contact id; for an employee, the contact linked to them (advisor), if any */
  contact_id: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  branch_id: string | null;
  branch_name: string | null;
  /** Signed for employees; null for external contacts (signed on demand) */
  avatar_url: string | null;
  visibility_scope: "private" | "branch" | "organization" | null;
}

export interface ContactDirectoryPage {
  rows: ContactDirectoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  memberCount: number;
  externalCount: number;
}

export const MEMBER_KEY_PREFIX = "member:";

export function isMemberKey(key: string): boolean {
  return key.startsWith(MEMBER_KEY_PREFIX);
}
