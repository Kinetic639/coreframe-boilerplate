"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LabelAssignmentDialog } from "@/modules/warehouse/components/labels/LabelAssignmentDialog";

export default function LabelAssignPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(true);

  const qrToken = searchParams.get("qr");
  const entityType = searchParams.get("type") as "product" | "location";
  const entityId = searchParams.get("entity");

  const handleDialogClose = () => {
    setDialogOpen(false);
    // Navigate back after short delay to allow dialog animation
    setTimeout(() => {
      router.push("/dashboard/warehouse/labels");
    }, 100);
  };

  if (!entityType || (entityType !== "product" && entityType !== "location")) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-red-600">Błąd parametrów</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">Nieprawidłowe parametry przypisania etykiety.</p>
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <QrCode className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle>Przypisanie etykiety</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Trwa otwieranie kreatora przypisania etykiety do{" "}
              {entityType === "product" ? "produktu" : "lokalizacji"}...
            </p>

            <div className="text-xs text-muted-foreground">
              {qrToken && (
                <p>
                  Token QR: <code className="rounded bg-muted px-1">{qrToken}</code>
                </p>
              )}
              {entityId && (
                <p>
                  ID elementu: <code className="rounded bg-muted px-1">{entityId}</code>
                </p>
              )}
            </div>

            <Button asChild variant="outline">
              <Link href="/dashboard/warehouse/labels">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Anuluj
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <LabelAssignmentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        entityType={entityType}
        entityId={entityId || undefined}
        qrToken={qrToken || undefined}
      />
    </div>
  );
}
