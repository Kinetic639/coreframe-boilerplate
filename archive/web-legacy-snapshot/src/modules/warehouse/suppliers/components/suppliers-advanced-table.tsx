"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import { SupplierWithContacts } from "../api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Edit,
  Trash2,
  CreditCard,
  Truck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";

interface SuppliersAdvancedTableProps {
  suppliers: SupplierWithContacts[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (supplier: SupplierWithContacts) => void;
  onDelete?: (supplier: SupplierWithContacts) => void;
  onAdd?: () => void;
}

export function SuppliersAdvancedTable({
  suppliers,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onAdd,
}: SuppliersAdvancedTableProps) {
  const t = useTranslations("modules.warehouse");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine if this is showing clients or vendors based on the data
  const isClientView = suppliers.length > 0 && suppliers[0]?.partner_type === "customer";
  const partnerTypeLabel = isClientView ? t("partnerTypes.customer") : t("partnerTypes.vendor");

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: pl,
    });
  };

  const columns: ColumnConfig<SupplierWithContacts>[] = [
    {
      key: "name",
      header: "Dostawca",
      sortable: true,
      filterType: "text",
      isPrimary: true,
      showInMobile: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-[#10b981] text-white">
              {getInitials(value)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-sm text-muted-foreground">
              {row.primary_contact
                ? `${row.primary_contact.first_name} ${row.primary_contact.last_name}`
                : partnerTypeLabel}
            </div>
          </div>
        </div>
      ),
      renderSidebar: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted-foreground">
            {row.primary_contact
              ? `${row.primary_contact.first_name} ${row.primary_contact.last_name}`
              : partnerTypeLabel}
          </div>
        </div>
      ),
    },
    {
      key: "primary_contact",
      header: "Kontakt",
      filterType: "text",
      showInMobile: true,
      render: (value) => {
        const email = value?.email;
        const phone = value?.phone || value?.mobile;

        return (
          <div className="space-y-1">
            {email && (
              <div className="flex items-center gap-1 text-sm">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[200px] truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-1 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>{phone}</span>
              </div>
            )}
            {!email && !phone && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        );
      },
    },
    {
      key: "website",
      header: "Strona www",
      filterType: "text",
      render: (value) =>
        value ? (
          <div className="flex items-center gap-1 text-sm">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="max-w-[150px] truncate">{value}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      filterType: "boolean",
      showInMobile: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Building className="mr-1 h-3 w-3" />
            {value ? "Aktywny" : "Nieaktywny"}
          </Badge>
          {row.tags && row.tags.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {row.tags[0]}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Dodano",
      sortable: true,
      filterType: "date-range",
      render: (value) => <span className="text-sm text-muted-foreground">{formatDate(value)}</span>,
    },
    {
      key: "city",
      header: "Miasto",
      filterType: "text",
      render: (value) => value || "—",
    },
    {
      key: "country",
      header: "Kraj",
      filterType: "select",
      filterOptions: [
        { value: "Poland", label: "Polska" },
        { value: "Germany", label: "Niemcy" },
        { value: "United Kingdom", label: "Wielka Brytania" },
        { value: "USA", label: "USA" },
      ],
      render: (value) => value || "—",
    },
  ];

  // Custom detail panel renderer
  const renderDetail = (supplier: SupplierWithContacts) => (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-[#10b981] text-xl text-white">
              {getInitials(supplier.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-2xl font-bold">{supplier.name}</h3>
            <p className="text-sm text-muted-foreground">
              {supplier.primary_contact
                ? `${supplier.primary_contact.first_name} ${supplier.primary_contact.last_name}`
                : partnerTypeLabel}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(supplier)}>
              <Edit className="mr-2 h-4 w-4" />
              Edytuj
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(supplier)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Usuń
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Contact Information */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 font-semibold">
          <Phone className="h-4 w-4" />
          Informacje kontaktowe
        </h4>
        <div className="grid gap-3 text-sm">
          {supplier.primary_contact?.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                href={`mailto:${supplier.primary_contact.email}`}
                className="text-primary hover:underline"
              >
                {supplier.primary_contact.email}
              </a>
            </div>
          )}
          {(supplier.primary_contact?.phone || supplier.primary_contact?.mobile) && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{supplier.primary_contact?.phone || supplier.primary_contact?.mobile}</span>
            </div>
          )}
          {supplier.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {supplier.website}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      {(supplier.address_line_1 || supplier.city) && (
        <>
          <Separator />
          <div>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4" />
              Adres
            </h4>
            <div className="text-sm text-muted-foreground">
              {supplier.address_line_1 && <p>{supplier.address_line_1}</p>}
              {supplier.address_line_2 && <p>{supplier.address_line_2}</p>}
              {(supplier.city || supplier.postal_code) && (
                <p>
                  {supplier.postal_code} {supplier.city}
                </p>
              )}
              {supplier.state_province && <p>{supplier.state_province}</p>}
              {supplier.country && <p>{supplier.country}</p>}
            </div>
          </div>
        </>
      )}

      {/* Payment & Delivery Terms */}
      {(supplier.payment_terms || supplier.delivery_terms) && (
        <>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            {supplier.payment_terms && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="h-4 w-4" />
                  Warunki płatności
                </h4>
                <p className="text-sm text-muted-foreground">{supplier.payment_terms}</p>
              </div>
            )}
            {supplier.delivery_terms && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4" />
                  Warunki dostawy
                </h4>
                <p className="text-sm text-muted-foreground">{supplier.delivery_terms}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Company Details */}
      {(supplier.company_registration_number || supplier.tax_number) && (
        <>
          <Separator />
          <div>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4" />
              Dane firmowe
            </h4>
            <div className="grid gap-2 text-sm">
              {supplier.company_registration_number && (
                <div>
                  <span className="font-medium">NIP: </span>
                  <span className="text-muted-foreground">
                    {supplier.company_registration_number}
                  </span>
                </div>
              )}
              {supplier.tax_number && (
                <div>
                  <span className="font-medium">Numer podatkowy: </span>
                  <span className="text-muted-foreground">{supplier.tax_number}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      {supplier.notes && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 font-semibold">Notatki</h4>
            <p className="text-sm text-muted-foreground">{supplier.notes}</p>
          </div>
        </>
      )}

      {/* Tags */}
      {supplier.tags && supplier.tags.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 font-semibold">Tagi</h4>
            <div className="flex flex-wrap gap-2">
              {supplier.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* View Full Details Link */}
      <div className="pt-4">
        <Link href={`/dashboard/warehouse/suppliers/${supplier.id}`}>
          <Button variant="outline" className="w-full">
            Zobacz pełne szczegóły dostawcy
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <AdvancedDataTable
      data={suppliers}
      columns={columns}
      loading={loading}
      error={error}
      emptyMessage="Nie znaleziono dostawców"
      getRowId={(row) => row.id}
      renderDetail={renderDetail}
      selectable={false}
      showSearch={true}
      searchPlaceholder="Szukaj dostawców po nazwie, email, stronie..."
      responsive={true}
      onAdd={onAdd}
    />
  );
}
