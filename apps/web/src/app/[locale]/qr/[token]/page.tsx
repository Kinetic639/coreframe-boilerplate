import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolvePublicQrToken } from "@/server/qr/public-token-resolver";
import type { PublicQrTokenFailure } from "@/server/qr/public-token-resolver";

interface QRPageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

export default async function QRPage({ params }: QRPageProps) {
  const { token, locale } = await params;
  const result = await resolvePublicQrToken(token, { locale });

  if (result.ok) {
    redirect(result.redirectPath);
  }
  if (!result.ok) {
    const error = (result as PublicQrTokenFailure).error;

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-red-600">
                {error === "QR_NOT_FOUND" && "Kod QR nie został znaleziony"}
                {error === "QR_REVOKED" && "Kod QR został unieważniony"}
                {error === "QR_UNASSIGNED" && "Kod QR nie został przypisany"}
                {error === "UNSUPPORTED_TARGET_TYPE" && "Typ docelowy nie jest obsługiwany"}
                {error === "TARGET_NOT_FOUND" && "Docelowy element nie istnieje"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                {error === "QR_NOT_FOUND" &&
                  "Nie można znaleźć aktywnego kodu QR o podanym tokenie."}
                {error === "QR_REVOKED" &&
                  "Ten kod QR został unieważniony i nie wskazuje już żadnego celu."}
                {error === "QR_UNASSIGNED" &&
                  "Ten kod QR istnieje, ale nie został jeszcze przypisany do żadnego elementu."}
                {error === "UNSUPPORTED_TARGET_TYPE" &&
                  "Kod QR wskazuje na typ celu, którego ten resolver jeszcze nie obsługuje."}
                {error === "TARGET_NOT_FOUND" &&
                  "Kod QR został znaleziony, ale powiązany element docelowy nie istnieje albo nie jest już prawidłowy."}
              </p>

              {error === "QR_UNASSIGNED" ? (
                <Button asChild className="w-full">
                  <Link href="/dashboard/qr">Otwórz zarządzanie kodami QR</Link>
                </Button>
              ) : null}

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/warehouse">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do magazynu
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

  return null;
}
