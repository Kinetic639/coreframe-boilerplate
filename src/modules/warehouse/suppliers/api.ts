import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";
import { Database } from "../../../../supabase/types/types";

// Type aliases for cleaner usage
export type BusinessAccount = Database["public"]["Tables"]["business_accounts"]["Row"];
export type BusinessAccountInsert = Database["public"]["Tables"]["business_accounts"]["Insert"];
export type BusinessAccountUpdate = Database["public"]["Tables"]["business_accounts"]["Update"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type BusinessAccountContact =
  Database["public"]["Tables"]["business_account_contacts"]["Row"];
export type BusinessAccountContactInsert =
  Database["public"]["Tables"]["business_account_contacts"]["Insert"];
export type BusinessAccountContactUpdate =
  Database["public"]["Tables"]["business_account_contacts"]["Update"];

// Combined type for contact with link metadata
export type ContactWithMetadata = Partial<Contact> & {
  id: string; // ID is required
  link_id?: string; // business_account_contacts.id
  is_primary?: boolean | null;
  position?: string | null;
  department?: string | null;
  link_notes?: string | null;
  // Legacy field mappings
  phone?: string | null; // Maps to work_phone
  mobile?: string | null; // Maps to mobile_phone
  email?: string | null; // Maps to primary_email
  is_active?: boolean | null; // Derived from !deleted_at
  supplier_id?: string; // Legacy field for backward compatibility
};

// Backward compatibility aliases
export type Supplier = BusinessAccount;
export type SupplierInsert = BusinessAccountInsert;
export type SupplierUpdate = BusinessAccountUpdate;
export type SupplierContact = ContactWithMetadata;
export type SupplierContactInsert = Partial<BusinessAccountContactInsert> & {
  // Support legacy field names
  supplier_id?: string; // Maps to business_account_id
  business_account_id?: string;
  contact_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  is_active?: boolean | null;
};
export type SupplierContactUpdate = BusinessAccountContactUpdate & {
  // Support legacy field names for updates
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  is_active?: boolean | null;
};

// Custom type for supplier with contacts
export type SupplierWithContacts = Supplier & {
  business_account_contacts?: ContactWithMetadata[];
  // Backward compatibility
  supplier_contacts?: ContactWithMetadata[];
  primary_contact?: ContactWithMetadata | null;
};

// Use Supabase generated types as source of truth

export interface SupplierFilters {
  search?: string;
  active?: boolean;
  tags?: string[];
  partner_type?: "vendor" | "customer"; // Filter by vendor (supplier) or customer (client)
  limit?: number;
  offset?: number;
}

export interface SuppliersResponse {
  suppliers: SupplierWithContacts[];
  total: number;
}

export interface SupplierContactsResponse {
  contacts: SupplierContact[];
  total: number;
}

class SupplierService {
  private supabase = createClient();

  private getOrganizationId(): string {
    const { activeOrgId } = useAppStore.getState();
    if (!activeOrgId) {
      throw new Error("No active organization found");
    }
    return activeOrgId;
  }

  async getSuppliers(
    filters: SupplierFilters = {},
    organizationId?: string
  ): Promise<SuppliersResponse> {
    const orgId = organizationId || this.getOrganizationId();

    let query = this.supabase
      .from("business_accounts")
      .select(
        `
        *,
        business_account_contacts!business_account_contacts_business_account_id_fkey(
          id,
          is_primary,
          position,
          department,
          notes,
          contact:contacts!business_account_contacts_contact_id_fkey(
            id,
            display_name,
            first_name,
            last_name,
            primary_email,
            work_phone,
            mobile_phone,
            salutation,
            notes,
            created_at,
            updated_at,
            deleted_at
          )
        )
      `,
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    // Filter by partner_type - default to 'vendor' for suppliers
    if (filters.partner_type) {
      query = query.eq("partner_type", filters.partner_type);
    } else {
      // Default to vendors (suppliers) if no filter specified
      query = query.eq("partner_type", "vendor");
    }

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,company_registration_number.ilike.%${filters.search}%,website.ilike.%${filters.search}%`
      );
    }

    if (typeof filters.active === "boolean") {
      query = query.eq("is_active", filters.active);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    query = query.order("name", { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching suppliers:", error);
      throw new Error(`Failed to fetch suppliers: ${error.message}`);
    }

    // Transform data to flatten the nested structure and add backward compatibility
    const suppliersWithContacts: SupplierWithContacts[] = (data || []).map((supplier: any) => {
      const links = supplier.business_account_contacts || [];

      // Flatten the nested structure: merge contact data with link metadata
      const contacts: ContactWithMetadata[] = links
        .filter((link: any) => link.contact && !link.contact.deleted_at)
        .map((link: any) => ({
          ...link.contact,
          link_id: link.id,
          is_primary: link.is_primary,
          position: link.position,
          department: link.department,
          link_notes: link.notes,
          // Legacy field mappings
          phone: link.contact.work_phone,
          mobile: link.contact.mobile_phone,
          email: link.contact.primary_email,
          is_active: !link.contact.deleted_at,
        }));

      const primaryContact = contacts.find((c) => c.is_primary) || contacts[0] || null;

      return {
        ...supplier,
        business_account_contacts: contacts,
        // Backward compatibility
        supplier_contacts: contacts,
        primary_contact: primaryContact,
      };
    });

    return {
      suppliers: suppliersWithContacts,
      total: count || 0,
    };
  }

  async getSupplierById(id: string): Promise<SupplierWithContacts | null> {
    const organizationId = this.getOrganizationId();

    const { data, error } = await this.supabase
      .from("business_accounts")
      .select(
        `
        *,
        business_account_contacts!business_account_contacts_business_account_id_fkey(
          id,
          is_primary,
          position,
          department,
          notes,
          contact:contacts!business_account_contacts_contact_id_fkey(
            id,
            display_name,
            first_name,
            last_name,
            primary_email,
            work_phone,
            mobile_phone,
            salutation,
            notes,
            created_at,
            updated_at,
            deleted_at
          )
        )
      `
      )
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // No data found
      }
      console.error("Error fetching supplier:", error);
      throw new Error(`Failed to fetch supplier: ${error.message}`);
    }

    if (!data) return null;

    // Transform to match the same structure as getSuppliers
    const links = (data as any).business_account_contacts || [];
    const contacts: ContactWithMetadata[] = links
      .filter((link: any) => link.contact && !link.contact.deleted_at)
      .map((link: any) => ({
        ...link.contact,
        link_id: link.id,
        is_primary: link.is_primary,
        position: link.position,
        department: link.department,
        link_notes: link.notes,
        phone: link.contact.work_phone,
        mobile: link.contact.mobile_phone,
        email: link.contact.primary_email,
        is_active: !link.contact.deleted_at,
      }));

    const primaryContact = contacts.find((c) => c.is_primary) || contacts[0] || null;

    return {
      ...data,
      business_account_contacts: contacts,
      supplier_contacts: contacts,
      primary_contact: primaryContact,
    };
  }

  async createSupplier(supplier: SupplierInsert): Promise<Supplier> {
    const organizationId = this.getOrganizationId();

    const supplierData = {
      ...supplier,
      organization_id: organizationId,
      partner_type: (supplier as any).partner_type || "vendor", // Default to vendor
    };

    const { data, error } = await this.supabase
      .from("business_accounts")
      .insert(supplierData)
      .select()
      .single();

    if (error) {
      console.error("Error creating supplier:", error);
      throw new Error(`Failed to create supplier: ${error.message}`);
    }

    return data;
  }

  async updateSupplier(id: string, supplier: SupplierUpdate): Promise<Supplier> {
    const organizationId = this.getOrganizationId();

    // Sanitize data: convert empty strings to null to avoid database type errors
    // Also remove fields that shouldn't be manually updated (timestamps, system fields)
    const sanitizedData: any = {};
    Object.entries(supplier).forEach(([key, value]) => {
      // Skip system-managed timestamp fields
      if (key === "created_at" || key === "deleted_at" || key === "updated_at") {
        return;
      }
      // Convert empty strings to null
      sanitizedData[key] = value === "" ? null : value;
    });

    const { data, error } = await this.supabase
      .from("business_accounts")
      .update({
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating supplier:", error);
      throw new Error(`Failed to update supplier: ${error.message}`);
    }

    return data;
  }

  async deleteSupplier(id: string): Promise<void> {
    const organizationId = this.getOrganizationId();

    const { error } = await this.supabase
      .from("business_accounts")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("Error deleting supplier:", error);
      throw new Error(`Failed to delete supplier: ${error.message}`);
    }
  }

  async restoreSupplier(id: string): Promise<Supplier> {
    const organizationId = this.getOrganizationId();

    const { data, error } = await this.supabase
      .from("business_accounts")
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error restoring supplier:", error);
      throw new Error(`Failed to restore supplier: ${error.message}`);
    }

    return data;
  }

  // Supplier Contacts Methods (using business_account_contacts junction table)
  async getSupplierContacts(supplierId: string): Promise<SupplierContactsResponse> {
    const { data, error, count } = await this.supabase
      .from("business_account_contacts")
      .select(
        `
        id,
        is_primary,
        position,
        department,
        notes,
        contact:contacts!business_account_contacts_contact_id_fkey(*)
      `,
        { count: "exact" }
      )
      .eq("business_account_id", supplierId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false });

    if (error) {
      console.error("Error fetching supplier contacts:", error);
      throw new Error(`Failed to fetch supplier contacts: ${error.message}`);
    }

    // Flatten the structure
    const contacts: ContactWithMetadata[] = (data || [])
      .filter((link: any) => link.contact)
      .map((link: any) => ({
        ...link.contact,
        link_id: link.id,
        is_primary: link.is_primary,
        position: link.position,
        department: link.department,
        link_notes: link.notes,
        phone: link.contact.work_phone,
        mobile: link.contact.mobile_phone,
        email: link.contact.primary_email,
        is_active: !link.contact.deleted_at,
      }));

    return {
      contacts,
      total: count || 0,
    };
  }

  async createSupplierContact(contact: SupplierContactInsert): Promise<SupplierContact> {
    const businessAccountId = (contact as any).supplier_id || contact.business_account_id;
    if (!businessAccountId) {
      throw new Error("business_account_id or supplier_id is required");
    }

    let contactId: string;

    // Check if we're linking an existing contact or creating a new one
    if (contact.contact_id) {
      // Link existing contact
      contactId = contact.contact_id;
    } else {
      // Create new contact in contacts table
      const orgId = this.getOrganizationId();
      const contactData = {
        organization_id: orgId,
        contact_type: "contact", // Use "contact" instead of "vendor"
        display_name:
          contact.first_name && contact.last_name
            ? `${contact.first_name} ${contact.last_name}`
            : contact.first_name || contact.last_name || "Unknown",
        first_name: contact.first_name || null,
        last_name: contact.last_name || null,
        primary_email: contact.email || null,
        work_phone: contact.phone || null,
        mobile_phone: contact.mobile || null,
        notes: null, // Link notes go in business_account_contacts
        visibility_scope: "organization",
      };

      const { data: newContact, error: contactError } = await this.supabase
        .from("contacts")
        .insert(contactData)
        .select()
        .single();

      if (contactError) {
        console.error("Error creating contact:", contactError);
        throw new Error(`Failed to create contact: ${contactError.message}`);
      }

      contactId = newContact.id;
    }

    // If this contact is set as primary, remove primary from other contacts
    if (contact.is_primary) {
      await this.supabase
        .from("business_account_contacts")
        .update({ is_primary: false })
        .eq("business_account_id", businessAccountId)
        .is("deleted_at", null);
    }

    // Create the link in business_account_contacts
    const linkData = {
      business_account_id: businessAccountId,
      contact_id: contactId,
      is_primary: contact.is_primary || false,
      position: contact.position || null,
      department: contact.department || null,
      notes: contact.notes || null,
    };

    const { data: link, error: linkError } = await this.supabase
      .from("business_account_contacts")
      .insert(linkData)
      .select()
      .single();

    if (linkError) {
      console.error("Error creating business account contact link:", linkError);
      throw new Error(`Failed to link contact: ${linkError.message}`);
    }

    // Return the combined result
    return {
      ...newContact,
      link_id: link.id,
      is_primary: link.is_primary,
      position: link.position,
      department: link.department,
      link_notes: link.notes,
      phone: newContact.work_phone,
      mobile: newContact.mobile_phone,
      email: newContact.primary_email,
      is_active: !newContact.deleted_at,
    };
  }

  async updateSupplierContact(
    id: string, // This is the link_id (business_account_contacts.id)
    contact: SupplierContactUpdate
  ): Promise<SupplierContact> {
    // Get the link to find the business_account_id and contact_id
    const { data: link } = await this.supabase
      .from("business_account_contacts")
      .select("business_account_id, contact_id")
      .eq("id", id)
      .single();

    if (!link) {
      throw new Error("Contact link not found");
    }

    // If this contact is set as primary, remove primary from other contacts
    if (contact.is_primary) {
      await this.supabase
        .from("business_account_contacts")
        .update({ is_primary: false })
        .eq("business_account_id", link.business_account_id)
        .neq("id", id)
        .is("deleted_at", null);
    }

    // Update the link metadata (position, department, notes, is_primary)
    const linkUpdate: any = {};
    if (contact.is_primary !== undefined) linkUpdate.is_primary = contact.is_primary;
    if (contact.position !== undefined) linkUpdate.position = contact.position;
    if (contact.department !== undefined) linkUpdate.department = contact.department;
    if (contact.notes !== undefined) linkUpdate.notes = contact.notes;

    if (Object.keys(linkUpdate).length > 0) {
      await this.supabase.from("business_account_contacts").update(linkUpdate).eq("id", id);
    }

    // Update the contact itself (first_name, last_name, email, phone, etc.)
    const contactUpdate: any = {};
    if (contact.first_name !== undefined) contactUpdate.first_name = contact.first_name;
    if (contact.last_name !== undefined) contactUpdate.last_name = contact.last_name;
    if (contact.email !== undefined) contactUpdate.primary_email = contact.email;
    if (contact.phone !== undefined) contactUpdate.work_phone = contact.phone;
    if (contact.mobile !== undefined) contactUpdate.mobile_phone = contact.mobile;

    // Update display_name if first or last name changed
    if (contact.first_name !== undefined || contact.last_name !== undefined) {
      const { data: currentContact } = await this.supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", link.contact_id)
        .single();

      const firstName =
        contact.first_name !== undefined ? contact.first_name : currentContact?.first_name;
      const lastName =
        contact.last_name !== undefined ? contact.last_name : currentContact?.last_name;
      contactUpdate.display_name = `${firstName || ""} ${lastName || ""}`.trim() || "Unknown";
    }

    if (Object.keys(contactUpdate).length > 0) {
      await this.supabase.from("contacts").update(contactUpdate).eq("id", link.contact_id);
    }

    // Fetch and return the updated contact with link data
    const result = await this.getSupplierContacts(link.business_account_id);
    const updatedContact = result.contacts.find((c: any) => c.link_id === id);

    if (!updatedContact) {
      throw new Error("Failed to fetch updated contact");
    }

    return updatedContact;
  }

  async deleteSupplierContact(id: string): Promise<void> {
    // Soft delete the link (this doesn't delete the actual contact, just the link)
    const { error } = await this.supabase
      .from("business_account_contacts")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error deleting supplier contact link:", error);
      throw new Error(`Failed to delete supplier contact: ${error.message}`);
    }
  }

  async setPrimaryContact(linkId: string): Promise<SupplierContact> {
    // Get the link to find the business_account_id
    const { data: link, error: linkError } = await this.supabase
      .from("business_account_contacts")
      .select("business_account_id")
      .eq("id", linkId)
      .single();

    if (linkError || !link) {
      throw new Error("Contact link not found");
    }

    // Remove primary from all other contacts for this business account
    await this.supabase
      .from("business_account_contacts")
      .update({ is_primary: false })
      .eq("business_account_id", link.business_account_id)
      .is("deleted_at", null);

    // Set this contact as primary
    const { error } = await this.supabase
      .from("business_account_contacts")
      .update({
        is_primary: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkId);

    if (error) {
      console.error("Error setting primary contact:", error);
      throw new Error(`Failed to set primary contact: ${error.message}`);
    }

    // Fetch and return the updated contact
    const result = await this.getSupplierContacts(link.business_account_id);
    const updatedContact = result.contacts.find((c: any) => c.link_id === linkId);

    if (!updatedContact) {
      throw new Error("Failed to fetch updated contact");
    }

    return updatedContact;
  }
}

export const supplierService = new SupplierService();
