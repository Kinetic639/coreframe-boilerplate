import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getContactsAction,
  getContactAction,
  createContactAction,
  updateContactAction,
  deleteContactAction,
  linkContactToBusinessAccountAction,
  unlinkContactFromBusinessAccountAction,
  getBusinessAccountContactAction,
} from "@/app/[locale]/dashboard/teams/contacts/_actions";
import type {
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  LinkContactToBusinessAccountInput,
} from "@/server/schemas/contacts.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const contactsKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactsKeys.all, "list"] as const,
  list: (filters?: ContactFilters) => [...contactsKeys.lists(), filters] as const,
  details: () => [...contactsKeys.all, "detail"] as const,
  detail: (id: string) => [...contactsKeys.details(), id] as const,
  businessAccount: (businessAccountId: string) =>
    [...contactsKeys.all, "business-account", businessAccountId] as const,
};

// ==========================================
// CONTACTS QUERIES
// ==========================================

/**
 * Hook to fetch all contacts
 */
export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: contactsKeys.list(filters),
    queryFn: async () => {
      const result = await getContactsAction(filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single contact by ID
 */
export function useContact(contactId: string | null) {
  return useQuery({
    queryKey: contactsKeys.detail(contactId || ""),
    queryFn: async () => {
      if (!contactId) {
        throw new Error("Contact ID is required");
      }

      const result = await getContactAction(contactId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch contact linked to a business account
 */
export function useBusinessAccountContact(businessAccountId: string | null) {
  return useQuery({
    queryKey: contactsKeys.businessAccount(businessAccountId || ""),
    queryFn: async () => {
      if (!businessAccountId) {
        throw new Error("Business account ID is required");
      }

      const result = await getBusinessAccountContactAction(businessAccountId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!businessAccountId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// CONTACTS MUTATIONS
// ==========================================

/**
 * Hook to create a new contact
 */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateContactInput, "organization_id" | "created_by">) => {
      const result = await createContactAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      toast.success("Contact created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create contact");
    },
  });
}

/**
 * Hook to update a contact
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, input }: { contactId: string; input: UpdateContactInput }) => {
      const result = await updateContactAction(contactId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.detail(data.id) });
      toast.success("Contact updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update contact");
    },
  });
}

/**
 * Hook to delete a contact
 */
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const result = await deleteContactAction(contactId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.lists() });
      queryClient.removeQueries({ queryKey: contactsKeys.detail(contactId) });
      toast.success("Contact deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete contact");
    },
  });
}

// ==========================================
// BUSINESS ACCOUNT LINKING MUTATIONS
// ==========================================

/**
 * Hook to link a contact to a business account
 */
export function useLinkContactToBusinessAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<LinkContactToBusinessAccountInput, "organization_id">) => {
      const result = await linkContactToBusinessAccountAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: contactsKeys.businessAccount(variables.business_account_id),
      });
      queryClient.invalidateQueries({ queryKey: ["business-accounts"] });
      toast.success("Contact linked to business account successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to link contact to business account");
    },
  });
}

/**
 * Hook to unlink a contact from a business account
 */
export function useUnlinkContactFromBusinessAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessAccountId: string) => {
      const result = await unlinkContactFromBusinessAccountAction(businessAccountId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, businessAccountId) => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.businessAccount(businessAccountId) });
      queryClient.invalidateQueries({ queryKey: ["business-accounts"] });
      toast.success("Contact unlinked from business account successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unlink contact from business account");
    },
  });
}
