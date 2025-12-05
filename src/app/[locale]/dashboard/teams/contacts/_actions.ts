"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/utils/assert-auth";
import { ContactsService } from "@/server/services/contacts.service";
import {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
  linkContactToBusinessAccountSchema,
  type CreateContactInput,
  type UpdateContactInput,
  type ContactFilters,
  type LinkContactToBusinessAccountInput,
} from "@/server/schemas/contacts.schema";

// ==========================================
// CONTACTS ACTIONS
// ==========================================

/**
 * Get all contacts for the organization
 */
export async function getContactsAction(filters?: ContactFilters) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    // Validate filters if provided
    const validatedFilters = filters ? contactFiltersSchema.parse(filters) : {};

    const contacts = await ContactsService.getContacts(
      supabase,
      organizationId,
      user.id,
      validatedFilters
    );

    return { success: true, data: contacts };
  } catch (error) {
    console.error("[getContactsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch contacts",
    };
  }
}

/**
 * Get a single contact by ID
 */
export async function getContactAction(contactId: string) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    const contact = await ContactsService.getContact(supabase, contactId, organizationId, user.id);

    if (!contact) {
      return { success: false, error: "Contact not found" };
    }

    return { success: true, data: contact };
  } catch (error) {
    console.error("[getContactAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch contact",
    };
  }
}

/**
 * Create a new contact
 */
export async function createContactAction(
  input: Omit<CreateContactInput, "organization_id" | "created_by">
) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    // Validate input
    const validatedInput = createContactSchema.parse({
      ...input,
      organization_id: organizationId,
      created_by: user.id,
    });

    const contact = await ContactsService.createContact(supabase, validatedInput);

    // Revalidate contacts pages
    revalidatePath("/dashboard/teams/contacts");

    return { success: true, data: contact };
  } catch (error) {
    console.error("[createContactAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create contact",
    };
  }
}

/**
 * Update a contact
 */
export async function updateContactAction(contactId: string, input: UpdateContactInput) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    // Validate input
    const validatedInput = updateContactSchema.parse(input);

    const contact = await ContactsService.updateContact(
      supabase,
      contactId,
      organizationId,
      user.id,
      validatedInput
    );

    // Revalidate contacts pages
    revalidatePath("/dashboard/teams/contacts");
    revalidatePath(`/dashboard/teams/contacts/${contactId}`);

    return { success: true, data: contact };
  } catch (error) {
    console.error("[updateContactAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update contact",
    };
  }
}

/**
 * Delete a contact
 */
export async function deleteContactAction(contactId: string) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    await ContactsService.deleteContact(supabase, contactId, organizationId, user.id);

    // Revalidate contacts pages
    revalidatePath("/dashboard/teams/contacts");

    return { success: true };
  } catch (error) {
    console.error("[deleteContactAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete contact",
    };
  }
}

// ==========================================
// BUSINESS ACCOUNT LINKING ACTIONS
// ==========================================

/**
 * Link a contact to a business account
 */
export async function linkContactToBusinessAccountAction(
  input: Omit<LinkContactToBusinessAccountInput, "organization_id">
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = linkContactToBusinessAccountSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    await ContactsService.linkContactToBusinessAccount(supabase, validatedInput);

    // Revalidate business accounts pages
    revalidatePath("/dashboard/warehouse/business-accounts");

    return { success: true };
  } catch (error) {
    console.error("[linkContactToBusinessAccountAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link contact to business account",
    };
  }
}

/**
 * Unlink a contact from a business account
 */
export async function unlinkContactFromBusinessAccountAction(businessAccountId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    await ContactsService.unlinkContactFromBusinessAccount(
      supabase,
      businessAccountId,
      organizationId
    );

    // Revalidate business accounts pages
    revalidatePath("/dashboard/warehouse/business-accounts");

    return { success: true };
  } catch (error) {
    console.error("[unlinkContactFromBusinessAccountAction] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to unlink contact from business account",
    };
  }
}

/**
 * Get contact linked to a business account
 */
export async function getBusinessAccountContactAction(businessAccountId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const contact = await ContactsService.getBusinessAccountContacts(
      supabase,
      businessAccountId,
      organizationId
    );

    return { success: true, data: contact };
  } catch (error) {
    console.error("[getBusinessAccountContactAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch business account contact",
    };
  }
}
