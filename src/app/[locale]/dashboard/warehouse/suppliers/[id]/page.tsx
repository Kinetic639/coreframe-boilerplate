import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/server";
import {
  Building,
  ArrowLeft,
  FileText,
  MapPin,
  Globe,
  CreditCard,
  Truck,
  Phone,
  Mail,
  User,
  Package,
} from "lucide-react";
import Link from "next/link";
import { SupplierWithContacts } from "@/modules/warehouse/suppliers/api";
import { SupplierDetailsActions } from "./supplier-details-actions";
import { SupplierProductsList } from "@/modules/warehouse/suppliers/components/supplier-products-list";

interface SupplierDetailsPageProps {
  params: Promise<{ id: string }>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 animate-pulse rounded bg-muted/50" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-96 animate-pulse rounded bg-muted/50" />
        <div className="h-96 animate-pulse rounded bg-muted/50" />
      </div>
    </div>
  );
}

async function SupplierDetailsContent({ supplierId }: { supplierId: string }) {
  const supabase = await createClient();

  // Fetch supplier with linked contact
  const { data: supplierData, error: supplierError } = await supabase
    .from("business_accounts")
    .select(
      `
      *,
      contact:contact_id (*)
    `
    )
    .eq("id", supplierId)
    .eq("partner_type", "vendor")
    .single();

  if (supplierError || !supplierData) {
    console.error("Error fetching supplier details:", supplierError);
    notFound();
  }

  // Transform data to match our type
  const { contact, ...rest } = supplierData as SupplierWithContacts & {
    contact?: SupplierWithContacts["contact"];
  };

  const supplier: SupplierWithContacts = {
    ...(rest as SupplierWithContacts),
    contact: contact || null,
    primary_contact: contact || null,
  };

  // Get total number of products from this supplier
  const { count: totalProducts } = await supabase
    .from("product_suppliers")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .is("deleted_at", null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouse/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do dostawców
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981] text-white">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
              {!supplier.is_active && <Badge variant="destructive">Nieaktywny</Badge>}
              {supplier.is_active && <Badge variant="outline">Aktywny</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Szczegóły dostawcy</p>
              {supplier.primary_contact && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {supplier.primary_contact.display_name ||
                    [supplier.primary_contact.first_name, supplier.primary_contact.last_name]
                      .filter(Boolean)
                      .join(" ")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <SupplierDetailsActions supplier={supplier} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informacje podstawowe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nazwa firmy</label>
                <p className="text-sm font-medium">{supplier.name}</p>
              </div>

              {supplier.website && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Strona internetowa
                  </label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {supplier.company_registration_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NIP/REGON</label>
                    <p className="font-mono text-sm">{supplier.company_registration_number}</p>
                  </div>
                )}
                {supplier.tax_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Numer VAT</label>
                    <p className="font-mono text-sm">{supplier.tax_number}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {supplier.payment_terms && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Warunki płatności
                    </label>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{supplier.payment_terms}</p>
                    </div>
                  </div>
                )}
                {supplier.delivery_terms && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Warunki dostawy
                    </label>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{supplier.delivery_terms}</p>
                    </div>
                  </div>
                )}
              </div>

              {supplier.tags && supplier.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tagi</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {supplier.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {supplier.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notatki</label>
                  <p className="rounded bg-muted/20 p-3 text-sm">{supplier.notes}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <label className="font-medium">Utworzono</label>
                  <p>{new Date(supplier.created_at!).toLocaleDateString("pl-PL")}</p>
                </div>
                <div>
                  <label className="font-medium">Zaktualizowano</label>
                  <p>{new Date(supplier.updated_at!).toLocaleDateString("pl-PL")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        {(supplier.address_line_1 || supplier.city || supplier.country) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Adres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {supplier.address_line_1 && <p className="text-sm">{supplier.address_line_1}</p>}
                {supplier.address_line_2 && <p className="text-sm">{supplier.address_line_2}</p>}
                <div className="flex items-center gap-2">
                  {supplier.postal_code && <span className="text-sm">{supplier.postal_code}</span>}
                  {supplier.city && <span className="text-sm">{supplier.city}</span>}
                </div>
                {supplier.state_province && <p className="text-sm">{supplier.state_province}</p>}
                {supplier.country && <p className="text-sm font-medium">{supplier.country}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics and Relations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Statystyki
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/20 p-4 text-center">
                <div className="text-2xl font-bold text-primary">{totalProducts || 0}</div>
                <div className="text-sm text-muted-foreground">Produktów</div>
              </div>
              <div className="rounded-lg bg-muted/20 p-4 text-center">
                <div className="text-sm font-medium text-muted-foreground">Powiązany kontakt</div>
                {supplier.primary_contact ? (
                  <div className="mt-2 text-sm">
                    <p className="font-semibold">
                      {supplier.primary_contact.display_name ||
                        [supplier.primary_contact.first_name, supplier.primary_contact.last_name]
                          .filter(Boolean)
                          .join(" ")}
                    </p>
                    {supplier.primary_contact.primary_email && (
                      <p className="text-xs text-muted-foreground">
                        {supplier.primary_contact.primary_email}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Brak kontaktu</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {supplier.primary_contact && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dane kontaktowe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-lg font-semibold">
                  {supplier.primary_contact.display_name ||
                    [supplier.primary_contact.first_name, supplier.primary_contact.last_name]
                      .filter(Boolean)
                      .join(" ")}
                </p>
                {supplier.primary_contact.tags && supplier.primary_contact.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {supplier.primary_contact.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {supplier.primary_contact.primary_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${supplier.primary_contact.primary_email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.primary_contact.primary_email}
                    </a>
                  </div>
                )}
                {supplier.primary_contact.work_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${supplier.primary_contact.work_phone}`}
                      className="hover:underline"
                    >
                      {supplier.primary_contact.work_phone}
                    </a>
                  </div>
                )}
                {supplier.primary_contact.mobile_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${supplier.primary_contact.mobile_phone}`}
                      className="hover:underline"
                    >
                      {supplier.primary_contact.mobile_phone}
                    </a>
                  </div>
                )}
              </div>

              {supplier.primary_contact.notes && (
                <p className="rounded bg-muted/20 p-3 text-sm text-muted-foreground">
                  {supplier.primary_contact.notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Products from this Supplier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produkty od tego dostawcy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierProductsList supplierId={supplierId} />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function SupplierDetailsPage({ params }: SupplierDetailsPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SupplierDetailsContent supplierId={id} />
    </Suspense>
  );
}
