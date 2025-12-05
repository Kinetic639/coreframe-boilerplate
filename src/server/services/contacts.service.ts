import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  LinkContactToBusinessAccountInput,
} from "@/server/schemas/contacts.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Apply visibility filter to show organization contacts + user's private contacts
 *
 * Rules:
 * - Show all contacts with visibility_scope = 'organization'
 * - Show contacts with visibility_scope = 'private' AND owner_user_id = userId
 *
 * @param query - Supabase query builder
 * @param userId - Current user ID
 * @param visibilityScopeFilter - Optional filter to show only private or organization contacts
 * @returns Modified query with visibility filter applied
 */
function applyVisibilityFilter(
  query: any,
  userId: string,
  visibilityScopeFilter?: "private" | "organization"
) {
  if (visibilityScopeFilter === "private") {
    // Only private contacts owned by user
    return query.eq("visibility_scope", "private").eq("owner_user_id", userId);
  } else if (visibilityScopeFilter === "organization") {
    // Only organization contacts
    return query.eq("visibility_scope", "organization");
  } else {
    // Both: organization contacts + user's private contacts
    // PostgREST syntax: OR(condition1, AND(condition2, condition3))
    return query.or(
      `visibility_scope.eq.organization,and(visibility_scope.eq.private,owner_user_id.eq.${userId})`
    );
  }
}

// ==========================================
// CONTACTS SERVICE
// ==========================================

export class ContactsService {
  /**
   * Get all contacts for an organization with filters
   */
  static async getContacts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userId: string,
    filters: ContactFilters = {}
  ): Promise<Contact[]> {
    const {
      search,
      contact_type,
      entity_type,
      visibility_scope,
      tags,
      limit = 50,
      offset = 0,
    } = filters;

    let query = supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply visibility filter
    query = applyVisibilityFilter(query, userId, visibility_scope);

    // Apply other filters
    if (contact_type) {
      query = query.eq("contact_type", contact_type);
    }

    if (entity_type) {
      query = query.eq("entity_type", entity_type);
    }

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,primary_email.ilike.%${search}%,company_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    if (tags && tags.length > 0) {
      query = query.contains("tags", tags);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1).order("display_name");

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single contact by ID
   */
  static async getContact(
    supabase: SupabaseClient<Database>,
    contactId: string,
    organizationId: string,
    userId: string
  ): Promise<Contact | null> {
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply visibility filter
    query = applyVisibilityFilter(query, userId);

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new contact
   */
  static async createContact(
    supabase: SupabaseClient<Database>,
    input: CreateContactInput
  ): Promise<Contact> {
    // If visibility is private, ensure owner_user_id is set
    if (input.visibility_scope === "private" && !input.owner_user_id) {
      throw new Error("Private contacts must have an owner_user_id");
    }

    // If visibility is organization, owner_user_id should be null
    if (input.visibility_scope === "organization") {
      input.owner_user_id = null;
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(input as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a contact
   */
  static async updateContact(
    supabase: SupabaseClient<Database>,
    contactId: string,
    organizationId: string,
    userId: string,
    input: UpdateContactInput
  ): Promise<Contact> {
    // First check if user has permission to update
    const contact = await this.getContact(supabase, contactId, organizationId, userId);

    if (!contact) {
      throw new Error("Contact not found or access denied");
    }

    // If it's a private contact, only owner can update
    if (contact.visibility_scope === "private" && contact.owner_user_id !== userId) {
      throw new Error("Only the contact owner can update private contacts");
    }

    // Don't allow changing visibility_scope in update
    const updateData: any = { ...input };
    delete updateData.visibility_scope;
    delete updateData.owner_user_id;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a contact (soft delete)
   */
  static async deleteContact(
    supabase: SupabaseClient<Database>,
    contactId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // First check if user has permission to delete
    const contact = await this.getContact(supabase, contactId, organizationId, userId);

    if (!contact) {
      throw new Error("Contact not found or access denied");
    }

    // If it's a private contact, only owner can delete
    if (contact.visibility_scope === "private" && contact.owner_user_id !== userId) {
      throw new Error("Only the contact owner can delete private contacts");
    }

    const { error } = await supabase
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", contactId);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  /**
   * Link a contact to a business account
   * Only organization-scope contacts can be linked (enforced by DB trigger)
   */
  static async linkContactToBusinessAccount(
    supabase: SupabaseClient<Database>,
    input: LinkContactToBusinessAccountInput
  ): Promise<void> {
    // The database trigger will validate:
    // 1. Contact is not private
    // 2. Contact and business account belong to same organization
    const { error } = await supabase
      .from("business_accounts")
      .update({ contact_id: input.contact_id })
      .eq("id", input.business_account_id)
      .eq("organization_id", input.organization_id);

    if (error) {
      throw new Error(`Failed to link contact to business account: ${error.message}`);
    }
  }

  /**
   * Unlink a contact from a business account
   */
  static async unlinkContactFromBusinessAccount(
    supabase: SupabaseClient<Database>,
    businessAccountId: string,
    organizationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("business_accounts")
      .update({ contact_id: null })
      .eq("id", businessAccountId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`Failed to unlink contact from business account: ${error.message}`);
    }
  }

  /**
   * Get contacts linked to a specific business account
   */
  static async getBusinessAccountContacts(
    supabase: SupabaseClient<Database>,
    businessAccountId: string,
    organizationId: string
  ): Promise<Contact | null> {
    const { data, error } = await supabase
      .from("business_accounts")
      .select(
        `
        contact_id,
        contacts (*)
      `
      )
      .eq("id", businessAccountId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch business account contacts: ${error.message}`);
    }

    return data?.contacts as Contact | null;
  }
}
