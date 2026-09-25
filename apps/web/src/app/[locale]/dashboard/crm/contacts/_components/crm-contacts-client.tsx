"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Upload, Users } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataView } from "@/components/data-view/data-view";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import {
  createCrmContactAction,
  deleteCrmContactAction,
  getCrmContactAvatarSignedUrlAction,
  getCrmContactDetailAction,
  listCrmContactsForDataViewAction,
  updateCrmContactAction,
  uploadCrmContactAvatarAction,
} from "@/app/actions/crm";
import type { CrmContactDetail, CrmContactListRow } from "@/server/services/crm-contacts.service";
import type { CrmContactVisibility } from "@/lib/validations/crm";

interface CrmContactsClientProps {
  orgId: string;
  initialData: PaginatedResult<CrmContactListRow>;
  memberOptions: ContactOrgMemberOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface ContactOrgMemberOption {
  userId: string;
  label: string;
  email: string | null;
}

const QUERY_KEY = ["crm-contacts"];

export function CrmContactsClient({
  orgId,
  initialData,
  memberOptions,
  canCreate,
  canUpdate,
  canDelete,
}: CrmContactsClientProps) {
  const t = useTranslations("modules.crm");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const listFetcher = useCallback(
    async (params: DataViewListParams) => {
      const result = await listCrmContactsForDataViewAction(params, orgId);
      if (result.success === false) throw new Error(result.error);
      return result.data;
    },
    [orgId]
  );

  const detailFetcher = useCallback(
    async (id: string) => {
      const result = await getCrmContactDetailAction(id, orgId);
      return result.success ? result.data : null;
    },
    [orgId]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        key: "visibility_scope",
        label: t("fields.visibility"),
        type: "select",
        options: [
          { value: "private", label: t("visibility.private") },
          { value: "branch", label: t("visibility.branch") },
          { value: "organization", label: t("visibility.organization") },
        ],
      },
    ],
    [t]
  );

  const columns = useMemo<DataViewColumnDef<CrmContactListRow>[]>(
    () => [
      {
        key: "display_name",
        header: t("fields.name"),
        accessor: (row) => <span className="font-medium">{row.display_name}</span>,
        sortable: true,
      },
      {
        key: "email",
        header: t("fields.email"),
        accessor: (row) => row.email || "—",
      },
      {
        key: "visibility_scope",
        header: t("fields.visibility"),
        accessor: (row) => (
          <Badge variant="outline">{t(`visibility.${row.visibility_scope}`)}</Badge>
        ),
        sortable: true,
      },
      {
        key: "job_title",
        header: t("fields.jobTitle"),
        accessor: (row) => row.job_title || "—",
      },
    ],
    [t]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-700" />
          <h1 className="text-lg font-semibold">{t("pages.contacts.title")}</h1>
        </div>
        {canCreate ? (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("actions.newContact")}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <DataView<CrmContactListRow, CrmContactDetail>
          entity="crm-contacts"
          scope={dataViewScope.organization(orgId)}
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
              <div className="truncate text-sm font-medium">{row.display_name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {t(`visibility.${row.visibility_scope}`)}
                </Badge>
                <span className="truncate">{row.email}</span>
              </div>
            </div>
          )}
          renderDetail={(detail) => (
            <CrmContactDetailPanel
              detail={detail}
              memberOptions={memberOptions}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onChanged={() => setRefreshToken((value) => value + 1)}
            />
          )}
        />
      </div>
      <CreateContactDialog
        open={createOpen}
        memberOptions={memberOptions}
        onOpenChange={setCreateOpen}
        onCreated={() => setRefreshToken((value) => value + 1)}
      />
    </div>
  );
}

function CrmContactDetailPanel({
  detail,
  memberOptions,
  canUpdate,
  canDelete,
  onChanged,
}: {
  detail: CrmContactDetail;
  memberOptions: ContactOrgMemberOption[];
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("modules.crm");
  const [current, setCurrent] = useState(detail);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    display_name: detail.display_name,
    first_name: detail.first_name ?? "",
    last_name: detail.last_name ?? "",
    email: detail.email ?? "",
    phone: detail.phone ?? "",
    mobile: detail.mobile ?? "",
    job_title: detail.job_title ?? "",
    visibility_scope: detail.visibility_scope,
    linked_user_id: detail.linked_user_id ?? "",
    notes: detail.notes ?? "",
  });

  useEffect(() => {
    setCurrent(detail);
    setForm({
      display_name: detail.display_name,
      first_name: detail.first_name ?? "",
      last_name: detail.last_name ?? "",
      email: detail.email ?? "",
      phone: detail.phone ?? "",
      mobile: detail.mobile ?? "",
      job_title: detail.job_title ?? "",
      visibility_scope: detail.visibility_scope,
      linked_user_id: detail.linked_user_id ?? "",
      notes: detail.notes ?? "",
    });
    setAvatarUrl(null);
  }, [detail]);

  useEffect(() => {
    let cancelled = false;

    if (!current.avatar_storage_path) {
      setAvatarUrl(null);
      setAvatarLoading(false);
      return;
    }

    setAvatarLoading(true);
    void getCrmContactAvatarSignedUrlAction(current.id).then((result) => {
      if (cancelled) return;
      setAvatarUrl(result.success ? result.data.signedUrl : null);
      setAvatarLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [current.id, current.avatar_storage_path]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const saveContact = async () => {
    setSaving(true);
    const result = await updateCrmContactAction({
      id: current.id,
      display_name: form.display_name,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile: form.mobile || null,
      job_title: form.job_title || null,
      visibility_scope: form.visibility_scope,
      linked_user_id: form.linked_user_id || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent(result.data);
    setEditing(false);
    onChanged();
    toast.success(t("messages.contactUpdated"));
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.set("contact_id", current.id);
    formData.set("file", file);
    const result = await uploadCrmContactAvatarAction(formData);
    setUploadingAvatar(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrent((value) => ({
      ...value,
      avatar_storage_path: result.data.avatarStoragePath,
    }));
    setAvatarUrl(result.data.signedUrl);
    setAvatarLoading(false);
    toast.success(t("messages.avatarUploaded"));
  };

  const archiveContact = async () => {
    setArchiving(true);
    const result = await deleteCrmContactAction(current.id);
    setArchiving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onChanged();
    toast.success(t("messages.contactArchived"));
  };

  const linkedMember = current.linked_user_id
    ? memberOptions.find((member) => member.userId === current.linked_user_id)
    : null;

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : avatarLoading || uploadingAvatar ? (
              <div className="h-7 w-7 animate-pulse rounded-full bg-muted-foreground/20" />
            ) : (
              <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          {canUpdate ? (
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Upload className="h-4 w-4" />
              {uploadingAvatar ? t("actions.uploading") : t("actions.uploadAvatar")}
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={(event) => {
                  void uploadAvatar(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </Label>
          ) : null}
        </div>
        <Badge variant="outline">{t(`visibility.${current.visibility_scope}`)}</Badge>
        <h2 className="mt-2 text-xl font-semibold">{current.display_name}</h2>
        {current.linked_user_id ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("messages.linkedOrgUser")}
            {linkedMember ? `: ${linkedMember.label}` : ""}
          </p>
        ) : null}
      </div>
      {canUpdate ? (
        <section className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t("sections.contactDetails")}</h3>
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
                <ContactField
                  label={t("fields.name")}
                  value={form.display_name}
                  onChange={(value) => updateForm("display_name", value)}
                />
                <ContactField
                  label={t("fields.firstName")}
                  value={form.first_name}
                  onChange={(value) => updateForm("first_name", value)}
                />
                <ContactField
                  label={t("fields.lastName")}
                  value={form.last_name}
                  onChange={(value) => updateForm("last_name", value)}
                />
                <ContactField
                  label={t("fields.email")}
                  value={form.email}
                  onChange={(value) => updateForm("email", value)}
                />
                <ContactField
                  label={t("fields.phone")}
                  value={form.phone}
                  onChange={(value) => updateForm("phone", value)}
                />
                <ContactField
                  label={t("fields.mobile")}
                  value={form.mobile}
                  onChange={(value) => updateForm("mobile", value)}
                />
                <ContactField
                  label={t("fields.jobTitle")}
                  value={form.job_title}
                  onChange={(value) => updateForm("job_title", value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("fields.visibility")}</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.visibility_scope}
                  onChange={(event) => updateForm("visibility_scope", event.target.value)}
                >
                  {(["organization", "branch", "private"] as CrmContactVisibility[]).map((item) => (
                    <option key={item} value={item}>
                      {t(`visibility.${item}`)}
                    </option>
                  ))}
                </select>
              </div>
              {memberOptions.length ? (
                <div className="grid gap-2">
                  <Label>{t("fields.linkedUser")}</Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.linked_user_id}
                    onChange={(event) => updateForm("linked_user_id", event.target.value)}
                  >
                    <option value="">{t("fields.noLinkedUser")}</option>
                    {memberOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.email ? `${member.label} (${member.email})` : member.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>{t("fields.notes")}</Label>
                <Input
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={saveContact}
                disabled={saving || !form.display_name.trim()}
              >
                {saving ? t("actions.saving") : t("actions.save")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Info label={t("fields.email")} value={current.email} />
        <Info label={t("fields.phone")} value={current.phone} />
        <Info label={t("fields.mobile")} value={current.mobile} />
        <Info label={t("fields.jobTitle")} value={current.job_title} />
      </div>
      <section>
        <h3 className="text-sm font-semibold">{t("sections.linkedParties")}</h3>
        <div className="mt-2 space-y-2">
          {current.parties.length ? (
            current.parties.map((party) => (
              <div key={party.id} className="rounded border border-border p-3 text-sm">
                <div className="font-medium">{party.party_display_name}</div>
                <div className="text-muted-foreground">
                  {party.counterparty_number ? `${party.counterparty_number} · ` : ""}
                  {party.relationship_type}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("empty.noLinkedParties")}</p>
          )}
        </div>
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
            onClick={archiveContact}
            disabled={archiving}
          >
            {archiving ? t("actions.archiving") : t("actions.archive")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ContactField({
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

function CreateContactDialog({
  open,
  memberOptions,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  memberOptions: ContactOrgMemberOption[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("modules.crm");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState<CrmContactVisibility>("organization");
  const [linkedUserId, setLinkedUserId] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const result = await createCrmContactAction({
      display_name: displayName,
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      mobile: mobile || null,
      job_title: jobTitle || null,
      notes: notes || null,
      visibility_scope: visibility,
      linked_user_id: linkedUserId || null,
    });
    setPending(false);
    if (result.success === false) {
      toast.error(result.error);
      return;
    }
    toast.success(t("messages.contactCreated"));
    setDisplayName("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setMobile("");
    setJobTitle("");
    setNotes("");
    setVisibility("organization");
    setLinkedUserId("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.newContact")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t("fields.name")}</Label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("fields.firstName")}</Label>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("fields.lastName")}</Label>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("fields.mobile")}</Label>
              <Input value={mobile} onChange={(event) => setMobile(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("fields.jobTitle")}</Label>
              <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("fields.visibility")}</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as CrmContactVisibility)}
            >
              {(["organization", "branch", "private"] as CrmContactVisibility[]).map((item) => (
                <option key={item} value={item}>
                  {t(`visibility.${item}`)}
                </option>
              ))}
            </select>
          </div>
          {memberOptions.length ? (
            <div className="grid gap-2">
              <Label>{t("fields.linkedUser")}</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={linkedUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  setLinkedUserId(nextUserId);
                  const member = memberOptions.find((item) => item.userId === nextUserId);
                  if (member && !displayName.trim()) setDisplayName(member.label);
                  if (member?.email && !email.trim()) setEmail(member.email);
                }}
              >
                <option value="">{t("fields.noLinkedUser")}</option>
                {memberOptions.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.email ? `${member.label} (${member.email})` : member.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
