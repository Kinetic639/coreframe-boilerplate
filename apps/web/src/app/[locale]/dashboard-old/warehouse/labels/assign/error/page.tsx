"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function AssignmentErrorPage() {
  const searchParams = useSearchParams();
  const errorMessage =
    searchParams.get("message") || "Wystąpił nieoczekiwany błąd podczas przypisywania kodu QR.";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Błąd przypisania</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Nie udało się przypisać kodu QR. Spróbuj ponownie lub skontaktuj się z
              administratorem.
            </p>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                <strong>Szczegóły błędu:</strong>
                <br />
                {decodeURIComponent(errorMessage)}
              </p>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = "/dashboard-old/warehouse/labels/assign?retry=true";
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Spróbuj ponownie
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard-old/warehouse/labels">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do etykiet
                </Link>
              </Button>

              <Button asChild variant="ghost" className="w-full">
                <Link href="/dashboard-old">Przejdź do panelu głównego</Link>
              </Button>
            </div>

            <div className="border-t pt-4 text-xs text-muted-foreground">
              <p>Jeśli problem się powtarza, skontaktuj się z działem wsparcia.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
