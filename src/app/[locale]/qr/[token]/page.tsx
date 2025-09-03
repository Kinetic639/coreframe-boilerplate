import { redirect } from "@/i18n/navigation";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Package, MapPin, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface QRPageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

async function getQRLabelData(token: string) {
  // Create a public Supabase client (no auth required for QR lookups)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // First check if the QR token exists and get its details
    const { data: qrLabel, error: qrError } = await supabase
      .from("qr_labels")
      .select("*")
      .eq("qr_token", token)
      .eq("is_active", true)
      .single();

    if (qrError) {
      console.error("QR label not found:", qrError);
      return { error: "QR_NOT_FOUND" };
    }

    if (!qrLabel) {
      return { error: "QR_NOT_FOUND" };
    }

    // Log the scan
    await supabase.from("qr_scan_logs").insert({
      qr_token: token,
      scan_type: "redirect",
      scanner_type: "manual",
      scan_result: "success",
      organization_id: qrLabel.organization_id,
      branch_id: qrLabel.branch_id,
    });

    // If the label is not assigned to any entity, return unassigned state
    if (!qrLabel.entity_id || !qrLabel.entity_type) {
      return {
        qrLabel,
        error: "QR_UNASSIGNED",
      };
    }

    // Get the assigned entity details
    let entityData = null;
    let entityError = null;

    if (qrLabel.entity_type === "product") {
      const { data: product, error: prodError } = await supabase
        .from("products")
        .select("id, name, description, code, sku")
        .eq("id", qrLabel.entity_id)
        .single();

      entityData = product;
      entityError = prodError;
    } else if (qrLabel.entity_type === "location") {
      const { data: location, error: locError } = await supabase
        .from("locations")
        .select("id, name, description, code, level")
        .eq("id", qrLabel.entity_id)
        .single();

      entityData = location;
      entityError = locError;
    }

    if (entityError || !entityData) {
      // Entity was deleted or doesn't exist
      return {
        qrLabel,
        error: "ENTITY_NOT_FOUND",
      };
    }

    return {
      qrLabel,
      entity: entityData,
      entityType: qrLabel.entity_type,
    };
  } catch (error) {
    console.error("Error processing QR scan:", error);
    return { error: "GENERAL_ERROR" };
  }
}

export default async function QRPage({ params }: QRPageProps) {
  const { token } = await params;
  const result = await getQRLabelData(token);

  // Handle different error states
  if (result.error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-red-600">
                {result.error === "QR_NOT_FOUND" && "Kod QR nie został znaleziony"}
                {result.error === "QR_UNASSIGNED" && "Kod QR nie został przypisany"}
                {result.error === "ENTITY_NOT_FOUND" && "Element nie istnieje"}
                {result.error === "GENERAL_ERROR" && "Wystąpił błąd"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                {result.error === "QR_NOT_FOUND" &&
                  "Nie można znaleźć etykiety o podanym kodzie QR. Sprawdź, czy kod jest poprawny."}
                {result.error === "QR_UNASSIGNED" &&
                  "Ten kod QR nie został jeszcze przypisany do żadnego produktu ani lokalizacji."}
                {result.error === "ENTITY_NOT_FOUND" &&
                  "Element przypisany do tego kodu QR już nie istnieje w systemie."}
                {result.error === "GENERAL_ERROR" &&
                  "Wystąpił nieoczekiwany błąd podczas przetwarzania kodu QR."}
              </p>

              {result.error === "QR_UNASSIGNED" && result.qrLabel && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-3 text-sm text-blue-800">
                    Czy chcesz przypisać ten kod QR do produktu lub lokalizacji?
                  </p>
                  <div className="space-y-2">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/dashboard/warehouse/labels/assign?qr=${token}&type=product`}>
                        <Package className="mr-2 h-4 w-4" />
                        Przypisz do produktu
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/dashboard/warehouse/labels/assign?qr=${token}&type=location`}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Przypisz do lokalizacji
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Powrót do panelu
                  </Link>
                </Button>
              </div>

              <div className="border-t pt-4 text-xs text-muted-foreground">
                Token: <code className="rounded bg-muted px-1 text-xs">{token}</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success case - redirect to appropriate page
  const { entity, entityType } = result;

  if (entityType === "product") {
    redirect(`/dashboard/warehouse/products/${entity.id}`);
  } else if (entityType === "location") {
    redirect(`/dashboard/warehouse/locations/${entity.id}`);
  }

  // Fallback - show success page with manual navigation
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <QrCode className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Kod QR zeskanowany pomyślnie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="mb-2 flex items-center justify-center gap-2">
                {entityType === "product" ? (
                  <Package className="h-5 w-5 text-green-700" />
                ) : (
                  <MapPin className="h-5 w-5 text-green-700" />
                )}
                <span className="font-medium text-green-800">{entity.name}</span>
              </div>
              <p className="text-sm text-green-700">
                {entity.description ||
                  `${entityType === "product" ? "Produkt" : "Lokalizacja"}: ${entity.code || "Brak kodu"}`}
              </p>
            </div>

            <Button asChild className="w-full">
              <Link
                href={`/dashboard/warehouse/${entityType === "product" ? "products" : "locations"}/${entity.id}`}
              >
                Przejdź do szczegółów
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Powrót do panelu
              </Link>
            </Button>

            <div className="border-t pt-4 text-xs text-muted-foreground">
              Token: <code className="rounded bg-muted px-1 text-xs">{token}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
