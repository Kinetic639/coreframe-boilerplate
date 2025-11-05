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
  ContactPerson,
  ContactPersonInsert,
  ContactPersonUpdate,
  ContactFilters,
  ContactsListResponse,
  ContactType,
} from "../types";

export class ContactsService {
  private supabase = createClient();

  /**
   * Get all contacts with optional filters
   */
  async getContacts(
    organizationId: string,
    filters?: ContactFilters,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    let query = this.supabase
      .from("contacts")
      .select(
        `
        *,
        addresses:contact_addresses(*),
        persons:contact_persons(*),
        price_list:price_lists(*),
        documents:contact_documents(*)
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply filters
    if (filters?.contact_type) {
      if (Array.isArray(filters.contact_type)) {
        query = query.in("contact_type", filters.contact_type);
      } else {
        query = query.eq("contact_type", filters.contact_type);
      }
    }

    if (filters?.entity_type) {
      query = query.eq("entity_type", filters.entity_type);
    }

    if (filters?.search) {
      query = query.or(
        `display_name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,primary_email.ilike.%${filters.search}%`
      );
    }

    if (filters?.has_portal_access !== undefined) {
      query = query.eq("portal_enabled", filters.has_portal_access);
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
   * Get single contact by ID
   */
  async getContactById(contactId: string): Promise<ContactWithRelations | null> {
    const { data, error } = await this.supabase
      .from("contacts")
      .select(
        `
        *,
        addresses:contact_addresses(*),
        persons:contact_persons(*),
        custom_field_values:contact_custom_field_values(
          *,
          field_definition:contact_custom_field_definitions(*)
        ),
        price_list:price_lists(*),
        documents:contact_documents(*)
      `
      )
      .eq("id", contactId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return data as ContactWithRelations;
  }

  /**
   * Create new contact
   */
  async createContact(
    organizationId: string,
    contactData: Omit<ContactInsert, "organization_id">,
    addresses?: Omit<ContactAddressInsert, "contact_id">[],
    persons?: Omit<ContactPersonInsert, "contact_id">[]
  ): Promise<Contact> {
    // Create contact
    const { data: contact, error: contactError } = await this.supabase
      .from("contacts")
      .insert({
        ...contactData,
        organization_id: organizationId,
      })
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

    // Create contact persons if provided
    if (persons && persons.length > 0) {
      const personsWithContactId = persons.map((person) => ({
        ...person,
        contact_id: contact.id,
      }));

      const { error: personsError } = await this.supabase
        .from("contact_persons")
        .insert(personsWithContactId);

      if (personsError) {
        // Rollback
        await this.supabase.from("contacts").delete().eq("id", contact.id);
        throw new Error(`Failed to create contact persons: ${personsError.message}`);
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
   * Add contact person
   */
  async addContactPerson(
    contactId: string,
    personData: ContactPersonInsert
  ): Promise<ContactPerson> {
    // If setting as primary, unset other primary contacts first
    if (personData.is_primary) {
      await this.supabase
        .from("contact_persons")
        .update({ is_primary: false })
        .eq("contact_id", contactId)
        .eq("is_primary", true);
    }

    const { data, error } = await this.supabase
      .from("contact_persons")
      .insert({
        ...personData,
        contact_id: contactId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add contact person: ${error.message}`);
    }

    return data;
  }

  /**
   * Update contact person
   */
  async updateContactPerson(
    personId: string,
    personData: ContactPersonUpdate
  ): Promise<ContactPerson> {
    // If setting as primary, get contact_id first
    if (personData.is_primary) {
      const { data: person } = await this.supabase
        .from("contact_persons")
        .select("contact_id")
        .eq("id", personId)
        .single();

      if (person) {
        await this.supabase
          .from("contact_persons")
          .update({ is_primary: false })
          .eq("contact_id", person.contact_id)
          .eq("is_primary", true)
          .neq("id", personId);
      }
    }

    const { data, error } = await this.supabase
      .from("contact_persons")
      .update(personData)
      .eq("id", personId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact person: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete contact person
   */
  async deleteContactPerson(personId: string): Promise<void> {
    const { error } = await this.supabase
      .from("contact_persons")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", personId);

    if (error) {
      throw new Error(`Failed to delete contact person: ${error.message}`);
    }
  }

  /**
   * Set primary contact person
   */
  async setPrimaryContactPerson(contactId: string, personId: string): Promise<void> {
    // Unset all primary flags for this contact
    await this.supabase
      .from("contact_persons")
      .update({ is_primary: false })
      .eq("contact_id", contactId)
      .eq("is_primary", true);

    // Set new primary
    const { error } = await this.supabase
      .from("contact_persons")
      .update({ is_primary: true })
      .eq("id", personId);

    if (error) {
      throw new Error(`Failed to set primary contact person: ${error.message}`);
    }
  }

  /**
   * Search contacts by display name or email
   */
  async searchContacts(
    organizationId: string,
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
    contactType: ContactType,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    return this.getContacts(organizationId, { contact_type: contactType }, page, pageSize);
  }

  /**
   * Get all vendors (suppliers)
   */
  async getVendors(
    organizationId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    return this.getContactsByType(organizationId, "vendor", page, pageSize);
  }

  /**
   * Get all customers (clients)
   */
  async getCustomers(
    organizationId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ContactsListResponse> {
    return this.getContactsByType(organizationId, "customer", page, pageSize);
  }
}

// Export singleton instance
export const contactsService = new ContactsService();
