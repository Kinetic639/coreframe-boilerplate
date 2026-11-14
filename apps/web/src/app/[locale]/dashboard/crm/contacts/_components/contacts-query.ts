import { getContactDirectoryRowAction, listContactsDirectoryAction } from "@/app/actions/contacts";
import { getCrmContactDetailAction } from "@/app/actions/crm";
import { isMemberKey, type ContactDirectoryPage } from "@/lib/contacts/types";
import type { ContactDetail, MemberContactDetail } from "./contact-detail-panel";
import { contactListParams, type ContactState } from "./contacts-state";

// The contacts list's cache: one entry per page the address asks for and one
// per contact card, per organization. Everything that changes a contact
// drops the "crm-contacts" entries.

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

export const contactKeys = {
  all: (orgId: string) => ["crm-contacts", orgId] as const,
  list: (orgId: string, state: ContactState) =>
    ["crm-contacts", orgId, "list", contactListParams(state)] as const,
  detail: (orgId: string, key: string) => ["crm-contacts", orgId, "detail", key] as const,
};

export const contactListQuery = (orgId: string, state: ContactState) => ({
  queryKey: contactKeys.list(orgId, state),
  queryFn: async (): Promise<ContactDirectoryPage> => {
    const result = await listContactsDirectoryAction(contactListParams(state));
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});

/** A contact's card: an employee (from their profile) or an external contact. */
export const contactDetailQuery = (orgId: string, key: string) => ({
  queryKey: contactKeys.detail(orgId, key),
  queryFn: async (): Promise<ContactDetail> => {
    if (isMemberKey(key)) {
      const member = await getContactDirectoryRowAction(key);
      if (!member.success) throw new Error((member as { error: string }).error);
      if (member.data?.kind !== "member") throw new Error("Not found");
      return member.data as MemberContactDetail;
    }
    const result = await getCrmContactDetailAction(key, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: DETAIL_STALE_TIME,
});
