"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import {
  Building2,
  Edit,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";

// Form schema
const customContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

type CustomContactFormData = z.infer<typeof customContactSchema>;

interface CustomContact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function CustomContactsClient() {
  const t = useTranslations("modules.teams.items.contacts.pages.custom");
  const tForm = useTranslations("modules.teams.items.contacts.pages.form");

  const [contacts, setContacts] = useState<CustomContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomContactFormData>({
    resolver: zodResolver(customContactSchema),
  });

  // Load contacts
  const loadContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("custom_contacts")
        .select("*")
        .is("deleted_at", null)
        .order("first_name");

      if (error) {
        // Handle table not existing gracefully
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Custom contacts table does not exist yet. Please run database migrations.");
          setContacts([]);
          return;
        }
        throw error;
      }
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Save contact (create or update)
  const onSubmit = async (data: CustomContactFormData) => {
    try {
      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from("custom_contacts")
          .update({
            first_name: data.firstName,
            last_name: data.lastName || null,
            email: data.email || null,
            phone: data.phone || null,
            position: data.position || null,
            department: data.department || null,
            notes: data.notes || null,
          })
          .eq("id", editingContact.id);

        if (error) {
          if (error.code === "42P01" || error.message.includes("does not exist")) {
            toast.error("Database table not available. Please contact your administrator.");
            return;
          }
          throw error;
        }
        toast.success("Contact updated successfully");
      } else {
        // Create new contact
        const { error } = await supabase.from("custom_contacts").insert({
          first_name: data.firstName,
          last_name: data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,
          position: data.position || null,
          department: data.department || null,
          notes: data.notes || null,
        });

        if (error) {
          if (error.code === "42P01" || error.message.includes("does not exist")) {
            toast.error("Database table not available. Please contact your administrator.");
            return;
          }
          throw error;
        }
        toast.success("Contact created successfully");
      }

      await loadContacts();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
    }
  };

  // Delete contact
  const deleteContact = async () => {
    if (!deleteContactId) return;

    try {
      const { error } = await supabase
        .from("custom_contacts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleteContactId);

      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          toast.error("Database table not available. Please contact your administrator.");
          return;
        }
        throw error;
      }

      await loadContacts();
      toast.success("Contact deleted successfully");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    } finally {
      setDeleteContactId(null);
    }
  };

  // Handle dialog actions
  const handleOpenDialog = (contact?: CustomContact) => {
    if (contact) {
      setEditingContact(contact);
      reset({
        firstName: contact.first_name,
        lastName: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        position: contact.position || "",
        department: contact.department || "",
        notes: contact.notes || "",
      });
    } else {
      setEditingContact(null);
      reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        position: "",
        department: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
    reset();
  };

  // Filter contacts based on search
  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${contact.first_name} ${contact.last_name || ""}`.toLowerCase();
    const email = contact.email?.toLowerCase() || "";
    const department = contact.department?.toLowerCase() || "";

    return (
      fullName.includes(searchLower) ||
      email.includes(searchLower) ||
      department.includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addContact")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingContact ? t("editContact") : t("addContact")}</DialogTitle>
                <DialogDescription>
                  {editingContact
                    ? "Update contact information"
                    : "Add a new contact to your personal list"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{tForm("firstName")} *</Label>
                    <Input
                      id="firstName"
                      {...register("firstName")}
                      className={errors.firstName ? "border-destructive" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{tForm("lastName")}</Label>
                    <Input id="lastName" {...register("lastName")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{tForm("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{tForm("phone")}</Label>
                  <Input id="phone" {...register("phone")} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">{tForm("position")}</Label>
                    <Input id="position" {...register("position")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">{tForm("department")}</Label>
                    <Input id="department" {...register("department")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{tForm("notes")}</Label>
                  <Textarea
                    id="notes"
                    {...register("notes")}
                    rows={3}
                    placeholder="Additional notes about this contact..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {tForm("cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : tForm("save")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts Grid */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-4 h-12 w-12 animate-pulse opacity-50" />
            <p>Loading contacts...</p>
          </CardContent>
        </Card>
      ) : filteredContacts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => {
            const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
            const initials = fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={contact.id} className="group transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">{fullName}</CardTitle>
                          {contact.email && (
                            <CardDescription className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              {contact.email}
                            </CardDescription>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(contact)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t("editContact")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteContactId(contact.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("deleteContact")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {contact.position && (
                      <Badge variant="outline" className="text-xs">
                        {contact.position}
                      </Badge>
                    )}

                    {contact.department && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {contact.department}
                      </div>
                    )}

                    {contact.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </div>
                    )}

                    {contact.notes && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <UserPlus className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{searchTerm ? "No contacts found matching your search" : t("noContacts")}</p>
            {!searchTerm && (
              <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addContact")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteContact")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tForm("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteContact")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
