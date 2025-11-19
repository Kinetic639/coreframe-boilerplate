import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";
import { Database } from "../../../../supabase/types/types";

// Type aliases for cleaner usage
export type BusinessAccount = Database["public"]["Tables"]["business_accounts"]["Row"];
export type BusinessAccountInsert = Database["public"]["Tables"]["business_accounts"]["Insert"];
export type BusinessAccountUpdate = Database["public"]["Tables"]["business_accounts"]["Update"];
export type SupplierContact = Database["public"]["Tables"]["contacts"]["Row"];

// Backward compatibility aliases
export type Supplier = BusinessAccount;
export type SupplierInsert = BusinessAccountInsert;
export type SupplierUpdate = BusinessAccountUpdate;

// Custom type for supplier with contacts
export type SupplierWithContacts = Supplier & {
  contact?: SupplierContact | null;
  primary_contact?: SupplierContact | null;
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
      .select("*, contact:contact_id (*)", { count: "exact" })
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

    const suppliersWithContacts: SupplierWithContacts[] = (data || []).map((supplier) => {
      const { contact, ...rest } = supplier as Supplier & {
        contact?: SupplierContact | null;
      };

      return {
        ...rest,
        contact: contact || null,
        primary_contact: contact || null,
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
      .select("*, contact:contact_id (*)")
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

    const { contact, ...rest } = data as Supplier & { contact?: SupplierContact | null };

    return {
      ...rest,
      contact: contact || null,
      primary_contact: contact || null,
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

    const { data, error } = await this.supabase
      .from("business_accounts")
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
}

export const supplierService = new SupplierService();
