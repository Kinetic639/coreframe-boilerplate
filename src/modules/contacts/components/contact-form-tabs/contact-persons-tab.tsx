"use client";

// =============================================
// Contact Form - Contact Persons Tab
// =============================================

import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactFormData, ContactPersonFormData, SALUTATIONS } from "../../types";
import { useTranslations } from "next-intl";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";

interface ContactPersonsTabProps {
  form: UseFormReturn<ContactFormData>;
}

export function ContactPersonsTab({ form }: ContactPersonsTabProps) {
  const t = useTranslations("contacts.form");
  const { watch, setValue } = form;

  const persons = watch("persons") || [];
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [personForm, setPersonForm] = useState<ContactPersonFormData>({
    salutation: null,
    first_name: "",
    last_name: "",
    email: "",
    work_phone: "",
    mobile_phone: "",
    designation: "",
    department: "",
    is_primary: false,
    is_active: true,
    notes: "",
  });

  const openAddDialog = () => {
    setPersonForm({
      salutation: null,
      first_name: "",
      last_name: "",
      email: "",
      work_phone: "",
      mobile_phone: "",
      designation: "",
      department: "",
      is_primary: persons.length === 0, // First person is primary by default
      is_active: true,
      notes: "",
    });
    setEditingIndex(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setPersonForm({ ...persons[index] });
    setEditingIndex(index);
    setIsDialogOpen(true);
  };

  const savePerson = () => {
    if (!personForm.first_name || !personForm.last_name) {
      return;
    }

    let updated = [...persons];

    // If setting as primary, unset other primary flags
    if (personForm.is_primary) {
      updated = updated.map((p) => ({ ...p, is_primary: false }));
    }

    if (editingIndex !== null) {
      updated[editingIndex] = personForm;
    } else {
      updated.push(personForm);
    }

    setValue("persons", updated);
    setIsDialogOpen(false);
  };

  const removePerson = (index: number) => {
    const updated = persons.filter((_, i) => i !== index);
    setValue("persons", updated);
  };

  const togglePrimary = (index: number) => {
    const updated = persons.map((p, i) => ({
      ...p,
      is_primary: i === index,
    }));
    setValue("persons", updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("fields.contactPersons")}</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("actions.addContactPerson")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null
                  ? t("dialogs.editContactPerson")
                  : t("dialogs.addContactPerson")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("dialogs.title")}</Label>
                  <Select
                    value={personForm.salutation || undefined}
                    onValueChange={(value) =>
                      setPersonForm({ ...personForm, salutation: value as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("placeholders.salutation")} />
                    </SelectTrigger>
                    <SelectContent>
                      {SALUTATIONS.map((sal) => (
                        <SelectItem key={sal.value} value={sal.value}>
                          {sal.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {t("fields.firstName")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={personForm.first_name}
                    onChange={(e) => setPersonForm({ ...personForm, first_name: e.target.value })}
                    placeholder={t("placeholders.firstName")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {t("fields.lastName")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={personForm.last_name}
                    onChange={(e) => setPersonForm({ ...personForm, last_name: e.target.value })}
                    placeholder={t("placeholders.lastName")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("fields.email")}</Label>
                  <Input
                    type="email"
                    value={personForm.email || ""}
                    onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })}
                    placeholder={t("placeholders.email")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("dialogs.workPhone")}</Label>
                  <Input
                    value={personForm.work_phone || ""}
                    onChange={(e) => setPersonForm({ ...personForm, work_phone: e.target.value })}
                    placeholder={t("placeholders.phone")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("fields.mobilePhone")}</Label>
                  <Input
                    value={personForm.mobile_phone || ""}
                    onChange={(e) => setPersonForm({ ...personForm, mobile_phone: e.target.value })}
                    placeholder={t("placeholders.phone")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("dialogs.designation")}</Label>
                  <Input
                    value={personForm.designation || ""}
                    onChange={(e) => setPersonForm({ ...personForm, designation: e.target.value })}
                    placeholder={t("placeholders.designation")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("dialogs.department")}</Label>
                  <Input
                    value={personForm.department || ""}
                    onChange={(e) => setPersonForm({ ...personForm, department: e.target.value })}
                    placeholder={t("placeholders.department")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("dialogs.notes")}</Label>
                <Input
                  value={personForm.notes || ""}
                  onChange={(e) => setPersonForm({ ...personForm, notes: e.target.value })}
                  placeholder={t("placeholders.notes")}
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={personForm.is_primary}
                    onCheckedChange={(checked) =>
                      setPersonForm({ ...personForm, is_primary: !!checked })
                    }
                  />
                  <Label className="font-normal">{t("dialogs.primaryContact")}</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={personForm.is_active}
                    onCheckedChange={(checked) =>
                      setPersonForm({ ...personForm, is_active: !!checked })
                    }
                  />
                  <Label className="font-normal">{t("dialogs.active")}</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("dialogs.cancel")}
                </Button>
                <Button type="button" onClick={savePerson}>
                  {editingIndex !== null ? t("dialogs.update") : t("dialogs.add")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {persons.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("messages.noContactPersons")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.name")}</TableHead>
              <TableHead>{t("fields.email")}</TableHead>
              <TableHead>{t("fields.workPhone")}</TableHead>
              <TableHead>{t("fields.designation")}</TableHead>
              <TableHead>{t("fields.primary")}</TableHead>
              <TableHead className="text-right">{t("fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {persons.map((person, index) => (
              <TableRow key={index}>
                <TableCell>
                  {person.salutation && `${person.salutation}. `}
                  {person.first_name} {person.last_name}
                </TableCell>
                <TableCell>{person.email || "-"}</TableCell>
                <TableCell>{person.work_phone || "-"}</TableCell>
                <TableCell>{person.designation || "-"}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={person.is_primary}
                    onCheckedChange={() => togglePrimary(index)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(index)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePerson(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
