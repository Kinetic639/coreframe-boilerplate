import {
  supplierService,
  type Supplier,
  type SupplierInsert,
  type SupplierUpdate,
  type SupplierWithContacts,
  type SuppliersResponse,
  type SupplierFilters,
} from "../suppliers/api";

// Client is just a business_account with partner_type = 'customer'
export type Client = Supplier;
export type ClientInsert = SupplierInsert;
export type ClientUpdate = SupplierUpdate;
export type ClientWithContacts = SupplierWithContacts;

export interface ClientsResponse {
  clients: ClientWithContacts[];
  total: number;
}

export interface ClientFilters extends Omit<SupplierFilters, "partner_type"> {
  // Clients are always partner_type = 'customer'
}

class ClientService {
  async getClients(filters: ClientFilters = {}): Promise<ClientsResponse> {
    const response: SuppliersResponse = await supplierService.getSuppliers({
      ...filters,
      partner_type: "customer", // Force customer type for clients
    });

    return {
      clients: response.suppliers,
      total: response.total,
    };
  }

  async getClientById(id: string): Promise<ClientWithContacts | null> {
    return supplierService.getSupplierById(id);
  }

  async createClient(client: ClientInsert): Promise<Client> {
    return supplierService.createSupplier({
      ...client,
      partner_type: "customer", // Force customer type
    } as any);
  }

  async updateClient(id: string, client: ClientUpdate): Promise<Client> {
    return supplierService.updateSupplier(id, client);
  }

  async deleteClient(id: string): Promise<void> {
    return supplierService.deleteSupplier(id);
  }

  async restoreClient(id: string): Promise<Client> {
    return supplierService.restoreSupplier(id);
  }
}

export const clientService = new ClientService();
