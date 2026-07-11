"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Plus, Search, Upload } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import {
  addCrmPartyAddressAction,
  createCrmPartyAction,
  deleteCrmPartyAction,
  deleteCrmPartyAddressAction,
  getCrmPartyDetailAction,
  linkCrmPartyContactAction,
  listCrmPartiesForDataViewAction,
  listCrmContactsForDataViewAction,
  updateCrmPartyAction,
  unlinkCrmPartyContactAction,
  uploadCrmPartyLogoAction,
} from "@/app/actions/crm";
import type { CrmPartyDetail, CrmPartyListRow } from "@/server/services/crm-parties.service";
import type { CrmContactListRow } from "@/server/services/crm-contacts.service";
import type { CrmPartyRole } from "@/lib/validations/crm";

interface CrmPartiesClientProps {
  orgId: string;
  initialData: PaginatedResult<CrmPartyListRow>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const QUERY_KEY = ["crm-parties"];

export function CrmPartiesClient({
  orgId,
  initialData,
  canCreate,
  canUpdate,
  canDelete,
}: CrmPartiesClientProps) {
  const t = useTranslations("modules.crm");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const listFetcher = useCallback(
    async (params: DataViewListParams) => {
      const result = await listCrmPartiesForDataViewAction(params, orgId);
      if (result.success === false) throw new Error(result.error);
      return result.data;
    },
    [orgId]
  );

  const detailFetcher = useCallback(
    async (id: string) => {
      const result = await getCrmPartyDetailAction(id, orgId);
      return result.success ? result.data : null;
    },
    [orgId]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        key: "role",
        label: t("fields.role"),
        type: "select",
        options: [
          { value: "supplier", label: t("roles.supplier") },
          { value: "client", label: t("roles.client") },
          { value: "contractor", label: t("roles.contractor") },
          { value: "vendor", label: t("roles.vendor") },
          { value: "partner", label: t("roles.partner") },
        ],
      },
      {
        key: "status",
        label: t("fields.status"),
        type: "select",
        options: [
          { value: "active", label: t("status.active") },
          { value: "inactive", label: t("status.inactive") },
          { value: "archived", label: t("status.archived") },
        ],
      },
    ],
    [t]
  );

  const columns = useMemo<DataViewColumnDef<CrmPartyListRow>[]>(
    () => [
      {
        key: "counterparty_number",
        header: t("fields.counterpartyNumber"),
        accessor: (row) => <span className="font-mono text-sm">{row.counterparty_number}</span>,
        sortable: true,
      },
      {
        key: "display_name",
        header: t("fields.name"),
        accessor: (row) => <span className="font-medium">{row.display_name}</span>,
        sortable: true,
      },
      {
        key: "roles",
        header: t("fields.roles"),
        accessor: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {t(`roles.${role}`)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: "status",
        header: t("fields.status"),
        accessor: (row) => <Badge variant="outline">{t(`status.${row.status}`)}</Badge>,
        sortable: true,
      },
    ],
    [t]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-700" />
          <h1 className="text-lg font-semibold">{t("pages.parties.title")}</h1>
        </div>
        {canCreate ? (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("actions.newParty")}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <DataView<CrmPartyListRow, CrmPartyDetail>
          entity="crm-parties"
          columns={columns}
          filters={filters}
          initialData={initialData}
          queryKey={QUERY_KEY}
          refreshToken={refreshToken}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.id}
          renderCompactItem={(row) => (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {row.counterparty_number}
                </span>
                <span className="truncate text-sm font-medium">{row.display_name}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.roles.slice(0, 2).map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px]">
                    {t(`roles.${role}`)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          renderDetail={(detail) => (
            <CrmPartyDetailPanel
              detail={detail}
              orgId={orgId}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onChanged={() => setRefreshToken((value) => value + 1)}
            />
          )}
        />
      </div>
      <CreatePartyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setRefreshToken((value) => value + 1)}
      />
    </div>
  );
}

function CrmPartyDetailPanel({
  detail,
  orgId,
  canUpdate,
  canDelete,
  onChanged,
}: {
  detail: CrmPartyDetail;
  orgId: string;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("modules.crm");
  const [current, setCurrent] = useState(detail);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    display_name: detail.display_name,
    legal_name: detail.legal_name ?? "",
    tax_id: detail.tax_id ?? "",
    email: detail.email ?? "",
    phone: detail.phone ?? "",
    website: detail.website ?? "",
    status: detail.status,
    notes: detail.notes ?? "",
  });
  const [selectedRoles, setSelectedRoles] = useState<CrmPartyRole[]>(detail.roles);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<CrmContactListRow[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [relationshipType, setRelationshipType] = useState("primary");
  const [primaryContact, setPrimaryContact] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address_type: "registered",
    country: "",
    city: "",
    postal_code: "",
    street: "",
    building_number: "",
    unit_number: "",
    region: "",
    is_default: false,
  });

  useEffect(() => {
    setCurrent(detail);
    setForm({
      display_name: detail.display_name,
      legal_name: detail.legal_name ?? "",
      tax_id: detail.tax_id ?? "",
      email: detail.email ?? "",
      phone: detail.phone ?? "",
      website: detail.website ?? "",
      status: detail.status,
      notes: detail.notes ?? "",
    });
    setSelectedRoles(detail.roles);
    setLogoUrl(null);
  }, [detail]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const updateAddressForm = (key: keyof typeof addressForm, value: string | boolean) => {
    setAddressForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const toggleRole = (role: CrmPartyRole) => {
    setSelectedRoles((roles) => {
      if (roles.includes(role)) {
        const next = roles.filter((item) => item !== role);
        return next.length ? next : roles;
      }
      return [...roles, role];
    });
  };

  const saveParty = async () => {
    setSaving(true);
    const result = await updateCrmPartyAction({
      id: current.id,
      display_name: form.display_name,
      legal_name: form.legal_name || null,
      tax_id: form.tax_id || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      status: form.status,
      notes: form.notes || null,
      roles: selectedRoles,
    });
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    setEditing(false);
    onChanged();
    toast.success(t("messages.partyUpdated"));
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    const formDataUpload = new FormData();
    formDataUpload.set("party_id", current.id);
    formDataUpload.set("file", file);
    const result = await uploadCrmPartyLogoAction(formDataUpload);
    setUploadingLogo(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLogoUrl(result.data.signedUrl);
    toast.success(t("messages.logoUploaded"));
  };

  const searchContacts = async () => {
    const result = await listCrmContactsForDataViewAction(
      {
        search: contactSearch,
        page: 1,
        pageSize: 20,
        sort: null,
        filters: {},
      },
      orgId
    );
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setContactResults(result.data.rows);
    setSelectedContactId(result.data.rows[0]?.id ?? "");
  };

  const linkContact = async () => {
    if (!selectedContactId) return;
    const result = await linkCrmPartyContactAction({
      party_id: current.id,
      contact_id: selectedContactId,
      relationship_type: relationshipType as "primary",
      is_primary: primaryContact,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    setSelectedContactId("");
    setPrimaryContact(false);
    onChanged();
    toast.success(t("messages.contactLinked"));
  };

  const addAddress = async () => {
    const result = await addCrmPartyAddressAction({
      party_id: current.id,
      address_type: addressForm.address_type as "registered",
      is_default: addressForm.is_default,
      country: addressForm.country || null,
      city: addressForm.city || null,
      postal_code: addressForm.postal_code || null,
      street: addressForm.street || null,
      building_number: addressForm.building_number || null,
      unit_number: addressForm.unit_number || null,
      region: addressForm.region || null,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    setAddressForm({
      address_type: "registered",
      country: "",
      city: "",
      postal_code: "",
      street: "",
      building_number: "",
      unit_number: "",
      region: "",
      is_default: false,
    });
    onChanged();
    toast.success(t("messages.addressAdded"));
  };

  const unlinkContact = async (linkId: string) => {
    const result = await unlinkCrmPartyContactAction({ party_id: current.id, link_id: linkId });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    onChanged();
    toast.success(t("messages.contactUnlinked"));
  };

  const deleteAddress = async (addressId: string) => {
    const result = await deleteCrmPartyAddressAction({
      party_id: current.id,
      address_id: addressId,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    onChanged();
    toast.success(t("messages.addressDeleted"));
  };

  const archiveParty = async () => {
    setArchiving(true);
    const result = await deleteCrmPartyAction(current.id);
    setArchiving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent((value) => ({ ...value, status: "archived" }));
    onChanged();
    toast.success(t("messages.partyArchived"));
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <div className="text-sm text-muted-foreground">
          {t("fields.counterpartyNumber")} {current.counterparty_number}
        </div>
        <h2 className="mt-1 text-xl font-semibold">{current.display_name}</h2>
        <div className="mt-2 flex flex-wrap gap-1">
          {current.roles.map((role) => (
            <Badge key={role}>{t(`roles.${role}`)}</Badge>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-12 w-12 rounded border border-border object-contain"
            />
          ) : null}
          {canUpdate ? (
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Upload className="h-4 w-4" />
              {uploadingLogo ? t("actions.uploading") : t("actions.uploadLogo")}
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(event) => {
                  void uploadLogo(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </Label>
          ) : null}
        </div>
      </div>
      {canUpdate ? (
        <section className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t("sections.partyDetails")}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? t("actions.cancel") : t("actions.edit")}
            </Button>
          </div>
          {editing ? (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldInput
                  label={t("fields.name")}
                  value={form.display_name}
                  onChange={(value) => updateForm("display_name", value)}
                />
                <FieldInput
                  label={t("fields.legalName")}
                  value={form.legal_name}
                  onChange={(value) => updateForm("legal_name", value)}
                />
                <FieldInput
                  label={t("fields.taxId")}
                  value={form.tax_id}
                  onChange={(value) => updateForm("tax_id", value)}
                />
                <FieldInput
                  label={t("fields.email")}
                  value={form.email}
                  onChange={(value) => updateForm("email", value)}
                />
                <FieldInput
                  label={t("fields.phone")}
                  value={form.phone}
                  onChange={(value) => updateForm("phone", value)}
                />
                <FieldInput
                  label={t("fields.website")}
                  value={form.website}
                  onChange={(value) => updateForm("website", value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("fields.status")}</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                >
                  {(["active", "inactive", "archived"] as const).map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>{t("fields.roles")}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      "supplier",
                      "client",
                      "contractor",
                      "vendor",
                      "partner",
                      "receiver",
                      "payer",
                      "other",
                    ] as CrmPartyRole[]
                  ).map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      {t(`roles.${role}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("fields.notes")}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={saveParty}
                disabled={saving || !form.display_name.trim()}
              >
                {saving ? t("actions.saving") : t("actions.save")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Info label={t("fields.legalName")} value={current.legal_name} />
        <Info label={t("fields.taxId")} value={current.tax_id} />
        <Info label={t("fields.email")} value={current.email} />
        <Info label={t("fields.phone")} value={current.phone} />
        <Info label={t("fields.website")} value={current.website} />
        <Info label={t("fields.status")} value={t(`status.${current.status}`)} />
      </div>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("sections.contactPeople")}</h3>
        </div>
        <div className="mt-2 space-y-2">
          {current.contacts.length ? (
            current.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start justify-between gap-3 rounded border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{contact.contact_display_name}</div>
                  <div className="text-muted-foreground">{contact.contact_email}</div>
                </div>
                {canUpdate ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => unlinkContact(contact.id)}
                  >
                    {t("actions.unlink")}
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("empty.noContactPeople")}</p>
          )}
        </div>
        {canUpdate ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder={t("actions.searchContacts")}
              />
              <Button type="button" variant="outline" onClick={searchContacts}>
                <Search className="mr-2 h-4 w-4" />
                {t("actions.search")}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px_auto]">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
              >
                <option value="">{t("actions.selectContact")}</option>
                {contactResults.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.display_name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={relationshipType}
                onChange={(event) => setRelationshipType(event.target.value)}
              >
                {(
                  [
                    "primary",
                    "billing",
                    "sales",
                    "technical",
                    "owner",
                    "representative",
                    "other",
                  ] as const
                ).map((type) => (
                  <option key={type} value={type}>
                    {t(`relationshipTypes.${type}`)}
                  </option>
                ))}
              </select>
              <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
                <input
                  type="checkbox"
                  checked={primaryContact}
                  onChange={(event) => setPrimaryContact(event.target.checked)}
                />
                {t("fields.primary")}
              </label>
              <Button type="button" onClick={linkContact} disabled={!selectedContactId}>
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.linkContact")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <section>
        <h3 className="text-sm font-semibold">{t("sections.addresses")}</h3>
        <div className="mt-2 space-y-2">
          {current.addresses.length ? (
            current.addresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start justify-between gap-3 rounded border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{t(`addressTypes.${address.address_type}`)}</div>
                  <div className="text-muted-foreground">
                    {[address.street, address.building_number, address.postal_code, address.city]
                      .filter(Boolean)
                      .join(" ")}
                  </div>
                </div>
                {canUpdate ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAddress(address.id)}
                  >
                    {t("actions.remove")}
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("empty.noAddresses")}</p>
          )}
        </div>
        {canUpdate ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("fields.addressType")}</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={addressForm.address_type}
                  onChange={(event) => updateAddressForm("address_type", event.target.value)}
                >
                  {(["registered", "billing", "shipping", "correspondence", "other"] as const).map(
                    (type) => (
                      <option key={type} value={type}>
                        {t(`addressTypes.${type}`)}
                      </option>
                    )
                  )}
                </select>
              </div>
              <FieldInput
                label={t("fields.country")}
                value={addressForm.country}
                onChange={(value) => updateAddressForm("country", value)}
              />
              <FieldInput
                label={t("fields.city")}
                value={addressForm.city}
                onChange={(value) => updateAddressForm("city", value)}
              />
              <FieldInput
                label={t("fields.postalCode")}
                value={addressForm.postal_code}
                onChange={(value) => updateAddressForm("postal_code", value)}
              />
              <FieldInput
                label={t("fields.street")}
                value={addressForm.street}
                onChange={(value) => updateAddressForm("street", value)}
              />
              <FieldInput
                label={t("fields.buildingNumber")}
                value={addressForm.building_number}
                onChange={(value) => updateAddressForm("building_number", value)}
              />
              <FieldInput
                label={t("fields.unitNumber")}
                value={addressForm.unit_number}
                onChange={(value) => updateAddressForm("unit_number", value)}
              />
              <FieldInput
                label={t("fields.region")}
                value={addressForm.region}
                onChange={(value) => updateAddressForm("region", value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addressForm.is_default}
                onChange={(event) => updateAddressForm("is_default", event.target.checked)}
              />
              {t("fields.defaultAddress")}
            </label>
            <Button type="button" onClick={addAddress}>
              <Plus className="mr-2 h-4 w-4" />
              {t("actions.addAddress")}
            </Button>
          </div>
        ) : null}
      </section>
      <div className="mt-auto flex flex-col gap-2 border-t pt-4">
        <div className="flex gap-2 text-xs text-muted-foreground">
          {canUpdate ? t("permissions.canUpdate") : null}
          {canDelete ? t("permissions.canDelete") : null}
        </div>
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={archiveParty}
            disabled={archiving || current.status === "archived"}
          >
            {archiving ? t("actions.archiving") : t("actions.archive")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function CreatePartyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("modules.crm");
  const [partyKind, setPartyKind] = useState<"organization" | "individual">("organization");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [role, setRole] = useState<CrmPartyRole>("client");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const result = await createCrmPartyAction({
      party_kind: partyKind,
      display_name: displayName,
      legal_name: legalName || displayName,
      tax_id: taxId || null,
      email: email || null,
      phone: phone || null,
      website: website || null,
      notes: notes || null,
      roles: [role],
      status: "active",
    });
    setPending(false);
    if (result.success === false) {
      toast.error(result.error);
      return;
    }
    toast.success(t("messages.partyCreated"));
    setPartyKind("organization");
    setDisplayName("");
    setLegalName("");
    setTaxId("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setNotes("");
    setRole("client");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.newParty")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t("fields.partyKind")}</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={partyKind}
              onChange={(event) =>
                setPartyKind(event.target.value as "organization" | "individual")
              }
            >
              {(["organization", "individual"] as const).map((item) => (
                <option key={item} value={item}>
                  {t(`partyKinds.${item}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.name")}</Label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.legalName")}</Label>
            <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.taxId")}</Label>
            <Input value={taxId} onChange={(event) => setTaxId(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("fields.email")}</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("fields.phone")}</Label>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.website")}</Label>
            <Input value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.role")}</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as CrmPartyRole)}
            >
              {(["client", "supplier", "contractor", "vendor", "partner"] as CrmPartyRole[]).map(
                (item) => (
                  <option key={item} value={item}>
                    {t(`roles.${item}`)}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.notes")}</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <Button onClick={submit} disabled={pending || !displayName.trim()}>
            {pending ? t("actions.saving") : t("actions.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
