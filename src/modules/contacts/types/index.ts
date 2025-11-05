// =============================================
// Contacts Module - TypeScript Types
// =============================================

import { Database } from "../../../../supabase/types/types";

// Database types
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export type ContactAddress = Database["public"]["Tables"]["contact_addresses"]["Row"];
export type ContactAddressInsert = Database["public"]["Tables"]["contact_addresses"]["Insert"];
export type ContactAddressUpdate = Database["public"]["Tables"]["contact_addresses"]["Update"];

export type ContactPerson = Database["public"]["Tables"]["contact_persons"]["Row"];
export type ContactPersonInsert = Database["public"]["Tables"]["contact_persons"]["Insert"];
export type ContactPersonUpdate = Database["public"]["Tables"]["contact_persons"]["Update"];

export type ContactCustomFieldDefinition =
  Database["public"]["Tables"]["contact_custom_field_definitions"]["Row"];
export type ContactCustomFieldValue =
  Database["public"]["Tables"]["contact_custom_field_values"]["Row"];

export type PriceList = Database["public"]["Tables"]["price_lists"]["Row"];
export type ContactDocument = Database["public"]["Tables"]["contact_documents"]["Row"];

// Enums
export type ContactType = "customer" | "vendor" | "lead" | "employee" | "other";
export type EntityType = "business" | "individual";
export type Salutation = "Mr" | "Mrs" | "Ms" | "Dr" | "Prof" | "Mx";
export type AddressType = "billing" | "shipping" | "both";

// Extended types with relations
export interface ContactWithRelations extends Contact {
  addresses?: ContactAddress[];
  persons?: ContactPerson[];
  custom_field_values?: (ContactCustomFieldValue & {
    field_definition?: ContactCustomFieldDefinition;
  })[];
  price_list?: PriceList | null;
  documents?: ContactDocument[];
}

// Form data types
export interface ContactFormData {
  // Entity info
  contact_type: ContactType;
  entity_type: EntityType;

  // Individual fields
  salutation?: Salutation | null;
  first_name?: string;
  last_name?: string;

  // Business fields
  company_name?: string;
  display_name: string;

  // Contact info
  primary_email?: string;
  work_phone?: string;
  mobile_phone?: string;
  fax?: string;
  website?: string;

  // Preferences
  language_code?: string;
  currency_code?: string;
  payment_terms?: string;

  // Financial
  credit_limit?: number;
  opening_balance?: number;
  tax_exempt?: boolean;
  tax_registration_number?: string;
  tax_rate?: number;
  company_id_number?: string;

  // Portal
  portal_enabled?: boolean;
  portal_language?: string;

  // Additional
  price_list_id?: string | null;
  notes?: string;
  tags?: string[];

  // Relations (for form)
  addresses?: ContactAddressFormData[];
  persons?: ContactPersonFormData[];
  custom_fields?: Record<string, any>;
}

export interface ContactAddressFormData {
  id?: string;
  address_type: AddressType;
  is_default?: boolean;
  attention_to?: string;
  country?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  phone?: string;
  fax_number?: string;
}

export interface ContactPersonFormData {
  id?: string;
  salutation?: Salutation | null;
  first_name: string;
  last_name: string;
  email?: string;
  work_phone?: string;
  mobile_phone?: string;
  designation?: string;
  department?: string;
  is_primary?: boolean;
  is_active?: boolean;
  notes?: string;
}

// API response types
export interface ContactsListResponse {
  contacts: ContactWithRelations[];
  total: number;
  page: number;
  page_size: number;
}

// Filter types
export interface ContactFilters {
  contact_type?: ContactType | ContactType[];
  entity_type?: EntityType;
  search?: string;
  tags?: string[];
  has_portal_access?: boolean;
  is_active?: boolean;
}

// Constants
export const CONTACT_TYPES: { value: ContactType; label: string; labelPl: string }[] = [
  { value: "customer", label: "Customer", labelPl: "Klient" },
  { value: "vendor", label: "Vendor", labelPl: "Dostawca" },
  { value: "lead", label: "Lead", labelPl: "Potencjalny klient" },
  { value: "employee", label: "Employee", labelPl: "Pracownik" },
  { value: "other", label: "Other", labelPl: "Inny" },
];

export const ENTITY_TYPES: { value: EntityType; label: string; labelPl: string }[] = [
  { value: "business", label: "Business", labelPl: "Firma" },
  { value: "individual", label: "Individual", labelPl: "Osoba prywatna" },
];

type SalutationKey = Lowercase<Salutation>;

export const SALUTATIONS: {
  value: Salutation;
  labelKey: `salutations.${SalutationKey}`;
}[] = [
  { value: "Mr", labelKey: "salutations.mr" },
  { value: "Mrs", labelKey: "salutations.mrs" },
  { value: "Ms", labelKey: "salutations.ms" },
  { value: "Dr", labelKey: "salutations.dr" },
  { value: "Prof", labelKey: "salutations.prof" },
  { value: "Mx", labelKey: "salutations.mx" },
];

export const ADDRESS_TYPES: { value: AddressType; label: string; labelPl: string }[] = [
  { value: "billing", label: "Billing", labelPl: "Fakturowy" },
  { value: "shipping", label: "Shipping", labelPl: "Dostawy" },
  { value: "both", label: "Both", labelPl: "Oba" },
];

export const CURRENCIES = [
  { value: "PLN", label: "PLN - Polish Zloty" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
];

export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on Receipt", labelPl: "Płatne przy odbiorze" },
  { value: "net_15", label: "Net 15", labelPl: "15 dni" },
  { value: "net_30", label: "Net 30", labelPl: "30 dni" },
  { value: "net_45", label: "Net 45", labelPl: "45 dni" },
  { value: "net_60", label: "Net 60", labelPl: "60 dni" },
];
