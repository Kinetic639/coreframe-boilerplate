"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PreviewableTable } from "@/components/ui/previewable-table";
import type { ColumnConfig } from "@/components/ui/advanced-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { ContactPreviewCard } from "@/modules/development/components/previewable-table/contact-preview-card";
import {
  type PreviewContact,
  previewContacts,
} from "@/modules/development/samples/previewable-table-data";

const contactColumns: ColumnConfig<PreviewContact>[] = [
  {
    key: "name",
    header: "Contact",
    sortable: true,
    filterType: "text",
    isPrimary: true,
    render: (value, row) => (
      <div className="space-y-1">
        <span className="font-medium">{value}</span>
        <span className="text-xs text-muted-foreground">{row.role}</span>
      </div>
    ),
  },
  {
    key: "company",
    header: "Company",
    filterType: "text",
    render: (value) => <span className="text-sm">{value}</span>,
  },
  {
    key: "email",
    header: "Email",
    filterType: "text",
    render: (value) => <span className="text-sm text-muted-foreground">{value}</span>,
  },
  {
    key: "phone",
    header: "Phone",
    render: (value) => <span className="text-sm">{value}</span>,
  },
  {
    key: "tags",
    header: "Tags",
    filterType: "multi-select",
    filterOptions: Array.from(new Set(previewContacts.flatMap((contact) => contact.tags))).map(
      (tag) => ({
        value: tag,
        label: tag,
      })
    ),
    render: (value: string[]) => (
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
            {tag}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "lastInteraction",
    header: "Last interaction",
    sortable: true,
    render: (value: string) => (
      <span className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(value), { addSuffix: true })}
      </span>
    ),
  },
];

interface PageProps {
  params: {
    locale: string;
    entityId?: string[];
  };
}

export default function ContactTablePreviewPage({ params }: PageProps) {
  const selectedId = params.entityId?.[0] ?? null;

  return (
    <PreviewableTable<PreviewContact>
      basePath="/dashboard/development/table-preview/contacts"
      selectedId={selectedId}
      data={previewContacts}
      columns={contactColumns}
      searchPlaceholder="Search contacts or companies"
      header={{
        title: "Contact preview layout",
        description:
          "Demonstration of the reusable layout configured for CRM records with inline profile preview.",
      }}
      renderDetail={(row, onClose) => <ContactPreviewCard contact={row} onClose={onClose} />}
      emptyMessage="No contacts found"
      responsive
      persistFiltersInUrl
      defaultSort={{ key: "lastInteraction", direction: "desc" }}
      navigationMode="replace"
      detailPathBuilder={(_, id) =>
        `/dashboard/development/table-preview/contacts/${id}?tab=timeline`
      }
      idleState={
        <Alert className="mb-4">
          <AlertTitle>Preview a contact</AlertTitle>
          <AlertDescription>
            Choose a person from the list to load their activity stream without leaving this
            workspace.
          </AlertDescription>
        </Alert>
      }
      notFoundState={
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Contact unavailable</AlertTitle>
          <AlertDescription>
            The requested contact no longer exists in this demo dataset. Pick another entry to
            continue.
          </AlertDescription>
        </Alert>
      }
    />
  );
}
