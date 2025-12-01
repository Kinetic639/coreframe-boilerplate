// =============================================
// Contacts Module - TypeScript Types
// =============================================

import { Database } from "@/types/supabase";

// Database types
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export type ContactAddress = Database["public"]["Tables"]["contact_addresses"]["Row"];
export type ContactAddressInsert = Database["public"]["Tables"]["contact_addresses"]["Insert"];
export type ContactAddressUpdate = Database["public"]["Tables"]["contact_addresses"]["Update"];

export type ContactCustomFieldDefinition =
  Database["public"]["Tables"]["contact_custom_field_definitions"]["Row"];
export type ContactCustomFieldValue =
  Database["public"]["Tables"]["contact_custom_field_values"]["Row"];

// Business Accounts (for linking)
export type BusinessAccount = Database["public"]["Tables"]["business_accounts"]["Row"];

// Enums
export type ContactType = "contact" | "lead" | "other";
export type Salutation = "Mr" | "Mrs" | "Ms" | "Dr" | "Prof" | "Mx";
export type AddressType = "billing" | "shipping" | "both";
export type VisibilityScope = "private" | "organization";

// Linked Business Account type (for display)
export interface LinkedBusinessAccount {
  id: string;
  name: string;
  partner_type: "vendor" | "customer";
  entity_type: "business" | "individual";
  email?: string;
  phone?: string;
  is_active: boolean;
}

// Extended types with relations
export interface ContactWithRelations extends Contact {
  addresses?: ContactAddress[];
  custom_field_values?: (ContactCustomFieldValue & {
    field_definition?: ContactCustomFieldDefinition;
  })[];
  linked_business_accounts?: LinkedBusinessAccount[];
}

// Form data types
export interface ContactFormData {
  // Entity info
  contact_type: ContactType;

  // Visibility scope
  visibility_scope: VisibilityScope;
  owner_user_id?: string;
  branch_id?: string;

  // Person fields (all contacts are people)
  salutation?: Salutation | null;
  first_name?: string;
  last_name?: string;
  display_name: string;

  // Contact info
  primary_email?: string;
  work_phone?: string;
  mobile_phone?: string;
  fax?: string;
  website?: string;

  // Additional
  notes?: string;
  tags?: string[];

  // Relations (for form)
  addresses?: ContactAddressFormData[];
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
  visibility_scope?: VisibilityScope;
  search?: string;
  tags?: string[];
}

// Constants
export const CONTACT_TYPES: { value: ContactType; label: string; labelPl: string }[] = [
  { value: "contact", label: "Contact", labelPl: "Kontakt" },
  { value: "lead", label: "Lead", labelPl: "Potencjalny klient" },
  { value: "other", label: "Other", labelPl: "Inny" },
];

export const VISIBILITY_SCOPES: {
  value: VisibilityScope;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
}[] = [
  {
    value: "private",
    label: "Private",
    labelPl: "Prywatne",
    description: "Only visible to you",
    descriptionPl: "Widoczne tylko dla Ciebie",
  },
  {
    value: "organization",
    label: "Organization",
    labelPl: "Organizacja",
    description: "Visible to all organization members",
    descriptionPl: "Widoczne dla wszystkich członków organizacji",
  },
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
