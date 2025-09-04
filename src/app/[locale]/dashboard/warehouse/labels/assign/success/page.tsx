"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink, ArrowLeft, Package, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";

interface EntityDetails {
  id: string;
  name: string;
  code?: string;
}

export default function AssignmentSuccessPage() {
  const searchParams = useSearchParams();
  const [entityDetails, setEntityDetails] = useState<EntityDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = searchParams.get("entity");
  const entityType = searchParams.get("type") as "product" | "location";

  const supabase = createClient();

  useEffect(() => {
    const loadEntityDetails = async () => {
      if (!entityId || !entityType) {
        setLoading(false);
        return;
      }

      try {
        if (entityType === "location") {
          const { data: location, error } = await supabase
            .from("locations")
            .select("id, name, code")
            .eq("id", entityId)
            .single();

          if (!error && location) {
            setEntityDetails(location);
          }
        } else if (entityType === "product") {
          const { data: product, error } = await supabase
            .from("products")
            .select("id, name, code")
            .eq("id", entityId)
            .single();

          if (!error && product) {
            setEntityDetails(product);
          }
        }
      } catch (error) {
        console.error("Error loading entity details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEntityDetails();
  }, [entityId, entityType, supabase]);

  if (!entityId || !entityType) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-red-600">Błąd parametrów</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">Brak informacji o przypisanym elemencie.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/warehouse/labels">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do etykiet
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Przypisanie zakończone pomyślnie!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Kod QR został pomyślnie przypisany do{" "}
              {entityType === "product" ? "produktu" : "lokalizacji"}.
            </p>

            {loading ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">Ładowanie szczegółów...</p>
              </div>
            ) : entityDetails ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="mb-2 flex items-center justify-center gap-2">
                  {entityType === "location" ? (
                    <MapPin className="h-5 w-5 text-green-700" />
                  ) : (
                    <Package className="h-5 w-5 text-green-700" />
                  )}
                  <span className="font-medium text-green-800">{entityDetails.name}</span>
                </div>
                {entityDetails.code && (
                  <p className="text-sm text-green-700">Kod: {entityDetails.code}</p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  {entityType === "product" ? "Produkt" : "Lokalizacja"} została zaktualizowana
                  pomyślnie.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {entityDetails && (
                <Button
                  className="w-full"
                  onClick={() => {
                    window.location.href = `/dashboard/warehouse/${entityType === "product" ? "products" : "locations"}/${entityDetails.id}`;
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Przejdź do szczegółów {entityType === "product" ? "produktu" : "lokalizacji"}
                </Button>
              )}

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/warehouse/labels">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do etykiet
                </Link>
              </Button>

              <Button asChild variant="ghost" className="w-full">
                <Link href="/dashboard">Przejdź do panelu głównego</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
