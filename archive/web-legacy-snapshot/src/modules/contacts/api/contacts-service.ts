// =============================================
// Contacts Service - Complete CRUD Operations
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  Contact,
  ContactInsert,
  ContactUpdate,
  ContactWithRelations,
  ContactAddress,
  ContactAddressInsert,
  ContactFilters,
  ContactsListResponse,
  ContactType,
  LinkedBusinessAccount,
} from "../types";

export class ContactsService {
  private supabase = createClient();

  /**
   * Get all contacts with optional filters and visibility scope
   */
  async getContacts(
    organizationId: string,
    userId: string,
    filters?: ContactFilters,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    let query = this.supabase
      .from("contacts")
      .select(
        `
        *,
        addresses:contact_addresses(*)
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply visibility scope filtering
    // User can see: organization-wide or their private contacts
    const visibilityClauses: string[] = [
      "visibility_scope.eq.organization",
      `and(visibility_scope.eq.private,owner_user_id.eq.${userId})`,
    ];

    query = query.or(visibilityClauses.join(","));

    // Apply additional filters
    if (filters?.contact_type) {
      if (Array.isArray(filters.contact_type)) {
        query = query.in("contact_type", filters.contact_type);
      } else {
        query = query.eq("contact_type", filters.contact_type);
      }
    }

    if (filters?.visibility_scope) {
      query = query.eq("visibility_scope", filters.visibility_scope);
    }

    if (filters?.search) {
      query = query.or(
        `display_name.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,primary_email.ilike.%${filters.search}%`
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains("tags", filters.tags);
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    // Order by
    query = query.order("display_name", { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    return {
      contacts: (data as ContactWithRelations[]) || [],
      total: count || 0,
      page,
      page_size: pageSize,
    };
  }

  /**
   * Get single contact by ID with linked business accounts
   * Includes visibility scope filtering
   */
  async getContactById(
    contactId: string,
    userId: string,
    organizationId: string
  ): Promise<ContactWithRelations | null> {
    const { data, error } = await this.supabase
      .from("contacts")
      .select(
        `
        *,
        addresses:contact_addresses(*),
        custom_field_values:contact_custom_field_values(
          *,
          field_definition:contact_custom_field_definitions(*)
        )
      `
      )
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    // Check visibility scope (application-level since RLS is disabled for testing)
    if (data.visibility_scope === "private" && data.owner_user_id !== userId) {
      return null; // User cannot access this private contact
    }

    // Load linked business accounts
    const linkedBusinessAccounts = await this.getLinkedBusinessAccounts(contactId);

    return {
      ...data,
      linked_business_accounts: linkedBusinessAccounts,
    } as ContactWithRelations;
  }

  /**
   * Get business accounts linked to this contact
   */
  async getLinkedBusinessAccounts(contactId: string): Promise<LinkedBusinessAccount[]> {
    const { data, error } = await this.supabase
      .from("business_accounts")
      .select("id, name, partner_type, entity_type, email, phone, is_active")
      .eq("contact_id", contactId)
      .is("deleted_at", null);

    if (error) {
      console.error("Failed to fetch linked business accounts:", error);
      return [];
    }

    return (data || []) as LinkedBusinessAccount[];
  }

  /**
   * Create new contact
   */
  async createContact(
    organizationId: string,
    userId: string,
    contactData: Omit<ContactInsert, "organization_id">,
    addresses?: Omit<ContactAddressInsert, "contact_id">[]
  ): Promise<Contact> {
    // Set owner based on visibility scope (branch_id always null now)
    const dataToInsert = {
      ...contactData,
      organization_id: organizationId,
      owner_user_id: contactData.visibility_scope === "private" ? userId : null,
      branch_id: null,
    };

    // Create contact
    const { data: contact, error: contactError } = await this.supabase
      .from("contacts")
      .insert(dataToInsert)
      .select()
      .single();

    if (contactError) {
      throw new Error(`Failed to create contact: ${contactError.message}`);
    }

    // Create addresses if provided
    if (addresses && addresses.length > 0) {
      const addressesWithContactId = addresses.map((addr) => ({
        ...addr,
        contact_id: contact.id,
      }));

      const { error: addressError } = await this.supabase
        .from("contact_addresses")
        .insert(addressesWithContactId);

      if (addressError) {
        // Rollback contact creation
        await this.supabase.from("contacts").delete().eq("id", contact.id);
        throw new Error(`Failed to create addresses: ${addressError.message}`);
      }
    }

    return contact;
  }

  /**
   * Update contact
   */
  async updateContact(contactId: string, contactData: ContactUpdate): Promise<Contact> {
    const { data, error } = await this.supabase
      .from("contacts")
      .update(contactData)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete contact (soft delete)
   */
  async deleteContact(contactId: string): Promise<void> {
    const { error } = await this.supabase
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", contactId);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  /**
   * Add address to contact
   */
  async addAddress(contactId: string, addressData: ContactAddressInsert): Promise<ContactAddress> {
    const { data, error } = await this.supabase
      .from("contact_addresses")
      .insert({
        ...addressData,
        contact_id: contactId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add address: ${error.message}`);
    }

    return data;
  }

  /**
   * Update address
   */
  async updateAddress(
    addressId: string,
    addressData: Partial<ContactAddress>
  ): Promise<ContactAddress> {
    const { data, error } = await this.supabase
      .from("contact_addresses")
      .update(addressData)
      .eq("id", addressId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update address: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete address
   */
  async deleteAddress(addressId: string): Promise<void> {
    const { error } = await this.supabase
      .from("contact_addresses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", addressId);

    if (error) {
      throw new Error(`Failed to delete address: ${error.message}`);
    }
  }

  /**
   * Search contacts by display name or email
   */
  async searchContacts(
    organizationId: string,
    userId: string,
    searchTerm: string,
    contactTypes?: ContactType[],
    limit: number = 10
  ): Promise<Contact[]> {
    let query = this.supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .or(`display_name.ilike.%${searchTerm}%,primary_email.ilike.%${searchTerm}%`)
      .limit(limit);

    // Apply visibility scope filtering
    const visibilityClauses: string[] = [
      "visibility_scope.eq.organization",
      `and(visibility_scope.eq.private,owner_user_id.eq.${userId})`,
    ];
    query = query.or(visibilityClauses.join(","));

    if (contactTypes && contactTypes.length > 0) {
      query = query.in("contact_type", contactTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search contacts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get contacts by type
   */
  async getContactsByType(
    organizationId: string,
    userId: string,
    contactType: ContactType,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    return this.getContacts(organizationId, userId, { contact_type: contactType }, page, pageSize);
  }

  /**
   * Promote private contact to organization scope
   * Only the owner can perform this action
   */
  async promoteContactToOrganization(
    contactId: string,
    userId: string,
    organizationId: string
  ): Promise<void> {
    // First, get the contact to validate ownership
    const contact = await this.getContactById(contactId, userId, organizationId);

    if (!contact) {
      throw new Error("Contact not found");
    }

    if (contact.visibility_scope === "organization") {
      throw new Error("Contact is already organization-scoped");
    }

    if (contact.owner_user_id !== userId) {
      throw new Error("Only the contact owner can promote to organization scope");
    }

    // Promote to organization: remove owner
    const { error } = await this.supabase
      .from("contacts")
      .update({
        visibility_scope: "organization",
        owner_user_id: null,
      })
      .eq("id", contactId);

    if (error) {
      throw new Error(`Failed to promote contact: ${error.message}`);
    }
  }
}

// Export singleton instance
export const contactsService = new ContactsService();
