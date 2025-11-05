// =============================================
// Contacts Store - Zustand State Management
// =============================================

import { create } from "zustand";
import type {
  ContactWithRelations,
  ContactFilters,
  ContactsListResponse,
} from "@/modules/contacts/types";
import { contactsService } from "@/modules/contacts/api/contacts-service";

interface ContactsState {
  // Current state
  contacts: ContactWithRelations[];
  selectedContact: ContactWithRelations | null;
  total: number;
  currentPage: number;
  pageSize: number;

  // Filters
  filters: ContactFilters;

  // Loading states
  isLoading: boolean;
  isLoadingContact: boolean;
  isSaving: boolean;

  // Error state
  error: string | null;

  // Actions
  loadContacts: (organizationId: string, page?: number) => Promise<void>;
  loadContactById: (contactId: string) => Promise<void>;
  setFilters: (filters: ContactFilters) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  selectContact: (contact: ContactWithRelations | null) => void;
  refreshContacts: (organizationId: string) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  reset: () => void;
}

const initialFilters: ContactFilters = {
  contact_type: undefined,
  entity_type: undefined,
  search: undefined,
  tags: undefined,
  has_portal_access: undefined,
  is_active: undefined,
};

export const useContactsStore = create<ContactsState>((set, get) => ({
  // Initial state
  contacts: [],
  selectedContact: null,
  total: 0,
  currentPage: 1,
  pageSize: 50,
  filters: initialFilters,
  isLoading: false,
  isLoadingContact: false,
  isSaving: false,
  error: null,

  // Load contacts with filters and pagination
  loadContacts: async (organizationId: string, page?: number) => {
    const currentPage = page !== undefined ? page : get().currentPage;

    set({ isLoading: true, error: null });

    try {
      const response: ContactsListResponse = await contactsService.getContacts(
        organizationId,
        get().filters,
        currentPage,
        get().pageSize
      );

      set({
        contacts: response.contacts,
        total: response.total,
        currentPage: response.page,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load contacts",
        isLoading: false,
      });
    }
  },

  // Load single contact by ID
  loadContactById: async (contactId: string) => {
    set({ isLoadingContact: true, error: null });

    try {
      const contact = await contactsService.getContactById(contactId);

      set({
        selectedContact: contact,
        isLoadingContact: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load contact",
        isLoadingContact: false,
      });
    }
  },

  // Set filters and reload
  setFilters: (filters: ContactFilters) => {
    set({ filters, currentPage: 1 });
  },

  // Clear all filters
  clearFilters: () => {
    set({ filters: initialFilters, currentPage: 1 });
  },

  // Set current page
  setPage: (page: number) => {
    set({ currentPage: page });
  },

  // Set page size
  setPageSize: (pageSize: number) => {
    set({ pageSize, currentPage: 1 });
  },

  // Select a contact
  selectContact: (contact: ContactWithRelations | null) => {
    set({ selectedContact: contact });
  },

  // Refresh contacts (reload current page)
  refreshContacts: async (organizationId: string) => {
    await get().loadContacts(organizationId, get().currentPage);
  },

  // Delete contact (soft delete)
  deleteContact: async (contactId: string) => {
    set({ isSaving: true, error: null });

    try {
      await contactsService.deleteContact(contactId);

      // Remove from local state
      set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== contactId),
        total: state.total - 1,
        isSaving: false,
      }));

      // Clear selection if deleted contact was selected
      if (get().selectedContact?.id === contactId) {
        set({ selectedContact: null });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete contact",
        isSaving: false,
      });
    }
  },

  // Reset store to initial state
  reset: () => {
    set({
      contacts: [],
      selectedContact: null,
      total: 0,
      currentPage: 1,
      pageSize: 50,
      filters: initialFilters,
      isLoading: false,
      isLoadingContact: false,
      isSaving: false,
      error: null,
    });
  },
}));

// Convenience selectors
export const useContacts = () => useContactsStore((state) => state.contacts);
export const useSelectedContact = () => useContactsStore((state) => state.selectedContact);
export const useContactsLoading = () => useContactsStore((state) => state.isLoading);
export const useContactsError = () => useContactsStore((state) => state.error);
export const useContactsFilters = () => useContactsStore((state) => state.filters);
export const useContactsPagination = () =>
  useContactsStore((state) => ({
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    total: state.total,
  }));
