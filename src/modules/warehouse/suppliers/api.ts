import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";
import {
  Supplier,
  SupplierContact,
  SupplierInsert,
  SupplierUpdate,
  SupplierContactInsert,
  SupplierContactUpdate,
  SupplierWithContacts,
} from "../../../../supabase/types/types";

// Use Supabase generated types as source of truth

export interface SupplierFilters {
  search?: string;
  active?: boolean;
  tags?: string[];
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

  async getSuppliers(filters: SupplierFilters = {}): Promise<SuppliersResponse> {
    const organizationId = this.getOrganizationId();

    let query = this.supabase
      .from("suppliers")
      .select(
        `
        *,
        supplier_contacts(
          id,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          position,
          department,
          is_primary,
          is_active,
          notes,
          created_at,
          updated_at
        )
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

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

    // Transform data to include primary_contact
    const suppliersWithContacts: SupplierWithContacts[] = (data || []).map((supplier: any) => ({
      ...supplier,
      primary_contact: supplier.supplier_contacts?.find(
        (contact: any) => contact.is_primary && !contact.deleted_at
      ),
    }));

    return {
      suppliers: suppliersWithContacts,
      total: count || 0,
    };
  }

  async getSupplierById(id: string): Promise<SupplierWithContacts | null> {
    const organizationId = this.getOrganizationId();

    const { data, error } = await this.supabase
      .from("suppliers")
      .select(
        `
        *,
        supplier_contacts(
          id,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          position,
          department,
          is_primary,
          is_active,
          notes,
          created_at,
          updated_at
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

    return {
      ...data,
      primary_contact: (data as any).supplier_contacts?.find(
        (contact: any) => contact.is_primary && !contact.deleted_at
      ),
    };
  }

  async createSupplier(supplier: SupplierInsert): Promise<Supplier> {
    const organizationId = this.getOrganizationId();

    const supplierData = {
      ...supplier,
      organization_id: organizationId,
    };

    const { data, error } = await this.supabase
      .from("suppliers")
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

    const { data, error } = await this.supabase
      .from("suppliers")
      .update({
        ...supplier,
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
      .from("suppliers")
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
      .from("suppliers")
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

  // Supplier Contacts Methods
  async getSupplierContacts(supplierId: string): Promise<SupplierContactsResponse> {
    const { data, error, count } = await this.supabase
      .from("supplier_contacts")
      .select("*", { count: "exact" })
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching supplier contacts:", error);
      throw new Error(`Failed to fetch supplier contacts: ${error.message}`);
    }

    return {
      contacts: data || [],
      total: count || 0,
    };
  }

  async createSupplierContact(contact: SupplierContactInsert): Promise<SupplierContact> {
    // If this contact is set as primary, remove primary from other contacts
    if (contact.is_primary) {
      await this.supabase
        .from("supplier_contacts")
        .update({ is_primary: false })
        .eq("supplier_id", contact.supplier_id)
        .neq("deleted_at", null);
    }

    const { data, error } = await this.supabase
      .from("supplier_contacts")
      .insert(contact)
      .select()
      .single();

    if (error) {
      console.error("Error creating supplier contact:", error);
      throw new Error(`Failed to create supplier contact: ${error.message}`);
    }

    return data;
  }

  async updateSupplierContact(
    id: string,
    contact: SupplierContactUpdate
  ): Promise<SupplierContact> {
    // If this contact is set as primary, remove primary from other contacts
    if (contact.is_primary) {
      const currentContact = await this.supabase
        .from("supplier_contacts")
        .select("supplier_id")
        .eq("id", id)
        .single();

      if (currentContact.data) {
        await this.supabase
          .from("supplier_contacts")
          .update({ is_primary: false })
          .eq("supplier_id", currentContact.data.supplier_id)
          .neq("id", id)
          .is("deleted_at", null);
      }
    }

    const { data, error } = await this.supabase
      .from("supplier_contacts")
      .update({
        ...contact,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating supplier contact:", error);
      throw new Error(`Failed to update supplier contact: ${error.message}`);
    }

    return data;
  }

  async deleteSupplierContact(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("supplier_contacts")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error deleting supplier contact:", error);
      throw new Error(`Failed to delete supplier contact: ${error.message}`);
    }
  }

  async setPrimaryContact(contactId: string): Promise<SupplierContact> {
    // First get the contact to find the supplier_id
    const { data: contactData, error: contactError } = await this.supabase
      .from("supplier_contacts")
      .select("supplier_id")
      .eq("id", contactId)
      .single();

    if (contactError || !contactData) {
      throw new Error("Contact not found");
    }

    // Remove primary from all other contacts for this supplier
    await this.supabase
      .from("supplier_contacts")
      .update({ is_primary: false })
      .eq("supplier_id", contactData.supplier_id)
      .is("deleted_at", null);

    // Set this contact as primary
    const { data, error } = await this.supabase
      .from("supplier_contacts")
      .update({
        is_primary: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      console.error("Error setting primary contact:", error);
      throw new Error(`Failed to set primary contact: ${error.message}`);
    }

    return data;
  }
}

export const supplierService = new SupplierService();

// Re-export types for backward compatibility
export type {
  Supplier,
  SupplierInsert,
  SupplierUpdate,
  SupplierContact,
  SupplierContactInsert,
  SupplierContactUpdate,
  SupplierWithContacts,
};
