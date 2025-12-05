"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supplierService, type Supplier } from "../api";
import { contactsService } from "@/server/services/contacts.service";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { toast } from "react-toastify";
import { Building2, User, UserPlus, X, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// Form schema for supplier (vendor)
const supplierFormSchema = z.object({
  // Entity type - business or individual
  entity_type: z.enum(["business", "individual"]),

  // Business fields
  name: z.string().min(1, "Name is required"),
  company_registration_number: z.string().optional(),
  tax_number: z.string().optional(),

  // Individual fields
  first_name: z.string().optional(),
  last_name: z.string().optional(),

  // Contact info
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),

  // Address
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),

  // Contact persons (multiple, link to contacts table)
  contact_ids: z.array(z.string()).optional(),
  primary_contact_id: z.string().optional(),

  // Additional info
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface NewSupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
  onSuccess: () => void;
}

export function NewSupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: NewSupplierFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const isEditMode = !!supplier;

  const { activeOrgId } = useAppStore();
  const { user } = useUserStore();
  const userId = user?.id;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      entity_type: "business",
      name: "",
      company_registration_number: "",
      tax_number: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      website: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      postal_code: "",
      country: "",
      contact_ids: [],
      primary_contact_id: undefined,
      notes: "",
      is_active: true,
    },
  });

  const entityType = form.watch("entity_type");
  const selectedContactIds = form.watch("contact_ids") || [];

  // Reset form when supplier changes (for edit mode)
  React.useEffect(() => {
    if (supplier) {
      // Extract contact IDs from business_account_contacts
      const supplierWithContacts = supplier as any;
      const contactIds =
        supplierWithContacts.business_account_contacts
          ?.map((link: any) => link.contact?.id)
          .filter(Boolean) || [];
      const primaryContact = supplierWithContacts.business_account_contacts?.find(
        (link: any) => link.is_primary
      );

      form.reset({
        entity_type: (supplier.entity_type as "business" | "individual") || "business",
        name: supplier.name || "",
        company_registration_number: supplier.company_registration_number || "",
        tax_number: supplier.tax_number || "",
        first_name: supplier.first_name || "",
        last_name: supplier.last_name || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        website: supplier.website || "",
        address_line_1: supplier.address_line_1 || "",
        address_line_2: supplier.address_line_2 || "",
        city: supplier.city || "",
        postal_code: supplier.postal_code || "",
        country: supplier.country || "",
        contact_ids: contactIds,
        primary_contact_id: primaryContact?.contact?.id,
        notes: supplier.notes || "",
        is_active: supplier.is_active ?? true,
      });
    } else {
      // Reset to empty form for create mode
      form.reset({
        entity_type: "business",
        name: "",
        company_registration_number: "",
        tax_number: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        website: "",
        address_line_1: "",
        address_line_2: "",
        city: "",
        postal_code: "",
        country: "",
        contact_ids: [],
        primary_contact_id: undefined,
        notes: "",
        is_active: true,
      });
    }
  }, [supplier, form]);

  const loadContacts = React.useCallback(async () => {
    if (!activeOrgId || !userId) return;

    setLoadingContacts(true);
    try {
      const result = await contactsService.getContacts(
        activeOrgId,
        userId,
        { contact_type: "contact" }, // Only load general contacts
        1,
        1000 // Load many contacts
      );
      setContacts(result.contacts);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, [activeOrgId, userId]);

  // Load contacts when dialog opens
  React.useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open, loadContacts]);

  const filteredContacts = React.useMemo(() => {
    if (!searchTerm) return contacts;
    return contacts.filter(
      (contact: any) =>
        contact.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.primary_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contacts, searchTerm]);

  const selectedContacts = React.useMemo(() => {
    return contacts.filter((c: any) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  // Helper function to toggle contact selection
  const handleToggleContact = (contactId: string) => {
    const currentIds = form.getValues("contact_ids") || [];
    const newIds = currentIds.includes(contactId)
      ? currentIds.filter((id) => id !== contactId)
      : [...currentIds, contactId];

    form.setValue("contact_ids", newIds);

    // If removing a contact that is primary, clear primary
    if (!newIds.includes(contactId) && form.getValues("primary_contact_id") === contactId) {
      form.setValue("primary_contact_id", undefined);
    }
  };

  // Helper function to set primary contact
  const handleSetPrimary = (contactId: string) => {
    form.setValue("primary_contact_id", contactId);
  };

  // Helper function to remove contact
  const handleRemoveContact = (contactId: string) => {
    const currentIds = form.getValues("contact_ids") || [];
    form.setValue(
      "contact_ids",
      currentIds.filter((id) => id !== contactId)
    );

    // If removing the primary contact, clear it
    if (form.getValues("primary_contact_id") === contactId) {
      form.setValue("primary_contact_id", undefined);
    }
  };

  const onSubmit = async (data: SupplierFormValues) => {
    setIsSubmitting(true);
    try {
      // Extract contact data separately
      const { contact_ids, primary_contact_id, ...supplierData } = data;

      // Clean up data - convert empty strings to null for UUID fields
      const cleanedData = {
        ...supplierData,
        partner_type: "vendor", // CRITICAL: Explicitly set partner_type for suppliers
      };

      // Save or update supplier
      let savedSupplier;
      if (isEditMode && supplier) {
        savedSupplier = await supplierService.updateSupplier(supplier.id, cleanedData as any);
        toast.success("Supplier updated successfully");
      } else {
        savedSupplier = await supplierService.createSupplier(cleanedData as any);
        toast.success("Supplier created successfully");
      }

      // Handle contact links
      if (contact_ids && contact_ids.length > 0) {
        const supplierId = savedSupplier.id;

        // Get existing contact links if in edit mode
        const supplierWithContacts = supplier as any;
        const existingLinks = supplierWithContacts?.business_account_contacts || [];
        const existingContactIds = existingLinks
          .map((link: any) => link.contact?.id)
          .filter(Boolean);

        // Find contacts to add and remove
        const contactsToAdd = contact_ids.filter((id) => !existingContactIds.includes(id));
        const contactsToRemove = existingContactIds.filter((id) => !contact_ids.includes(id));

        // Remove old contact links
        for (const contactId of contactsToRemove) {
          const linkToRemove = existingLinks.find((link: any) => link.contact?.id === contactId);
          if (linkToRemove?.id) {
            await supplierService.deleteSupplierContact(linkToRemove.id);
          }
        }

        // Add new contact links
        for (const contactId of contactsToAdd) {
          await supplierService.createSupplierContact({
            business_account_id: supplierId,
            contact_id: contactId,
            is_primary: contactId === primary_contact_id,
          });
        }

        // Update primary contact if needed
        if (primary_contact_id) {
          // Find the link for the primary contact
          const primaryLink = isEditMode
            ? existingLinks.find((link: any) => link.contact?.id === primary_contact_id)
            : null;

          if (primaryLink?.id) {
            await supplierService.setPrimaryContact(primaryLink.id);
          } else if (contactsToAdd.includes(primary_contact_id)) {
            // Primary was just added, need to find its new link ID
            // The createSupplierContact above already set is_primary: true, so we're good
          }
        }
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update supplier information"
              : "Add a new supplier - business or individual"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Entity Type Selection */}
            <FormField
              control={form.control}
              name="entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="business">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>Business</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="individual">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Individual</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {entityType === "business" ? "Company or organization" : "Individual person"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs defaultValue="basic" className="w-full">
              <TabsList
                className={`grid w-full ${entityType === "business" ? "grid-cols-4" : "grid-cols-3"}`}
              >
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                {entityType === "business" && (
                  <TabsTrigger value="contact">Contact Person</TabsTrigger>
                )}
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                {entityType === "business" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Company name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="company_registration_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration Number</FormLabel>
                            <FormControl>
                              <Input placeholder="KRS/REGON" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tax_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Number (NIP)</FormLabel>
                            <FormControl>
                              <Input placeholder="XXX-XXX-XX-XX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormDescription>
                            How this supplier will be displayed in lists
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+48 XXX XXX XXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4">
                <FormField
                  control={form.control}
                  name="address_line_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_line_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Apartment, suite, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Warsaw" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="00-000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Poland" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Contact Person Tab - Only for Business */}
              {entityType === "business" && (
                <TabsContent value="contact" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Link Contact Persons</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Select one or more contacts and mark one as primary
                      </p>
                    </div>

                    {/* Selected Contacts Display */}
                    {selectedContacts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Selected Contacts ({selectedContacts.length})
                        </p>
                        {selectedContacts.map((contact: any) => (
                          <div
                            key={contact.id}
                            className="p-3 border rounded-lg bg-muted/50 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{contact.display_name}</p>
                                  {contact.primary_email && (
                                    <p className="text-sm text-muted-foreground">
                                      {contact.primary_email}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {form.watch("primary_contact_id") === contact.id ? (
                                  <Badge variant="default" className="bg-yellow-500">
                                    <Star className="h-3 w-3 mr-1" />
                                    Primary
                                  </Badge>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSetPrimary(contact.id)}
                                  >
                                    <Star className="h-3 w-3 mr-1" />
                                    Set as Primary
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveContact(contact.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contact Search and Multi-Selection */}
                    <div className="space-y-3">
                      <Input
                        placeholder="Search contacts by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />

                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        {loadingContacts ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Loading contacts...
                          </div>
                        ) : filteredContacts.length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-2">No contacts found</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.open("/dashboard/contacts", "_blank");
                              }}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Create New Contact
                            </Button>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {filteredContacts.map((contact: any) => {
                              const isSelected = selectedContactIds.includes(contact.id);
                              return (
                                <div
                                  key={contact.id}
                                  className="p-3 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleToggleContact(contact.id)}
                                    />
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{contact.display_name}</p>
                                      {contact.primary_email && (
                                        <p className="text-xs text-muted-foreground">
                                          {contact.primary_email}
                                        </p>
                                      )}
                                    </div>
                                    {contact.entity_type && (
                                      <Badge variant="outline" className="text-xs">
                                        {contact.entity_type}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            window.open("/dashboard/contacts", "_blank");
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create New Contact
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Additional Info Tab */}
              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this supplier"
                          className="resize-none"
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>Inactive suppliers are hidden from lists</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEditMode ? "Update Supplier" : "Create Supplier"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
