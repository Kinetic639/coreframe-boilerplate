"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Package,
  MapPin,
  Calendar,
  User,
  Download,
} from "lucide-react";
import { useAuditStore } from "@/lib/stores/audit-store";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface AuditSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: () => void;
}

export function AuditSummaryDialog({ open, onOpenChange, onFinish }: AuditSummaryDialogProps) {
  const { currentAudit, auditItems, auditProgress } = useAuditStore();

  if (!currentAudit || !auditProgress) return null;

  const totalValueChange = auditItems.reduce((sum, item) => sum + item.value_change, 0);
  const noChanges = auditProgress.totalProducts - auditItems.length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(value);
  };

  const handleFinish = () => {
    onFinish();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Audyt zakończony
          </DialogTitle>
          <DialogDescription>
            Podsumowanie audytu magazynowego - {currentAudit.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {auditProgress.totalProducts}
                  </div>
                  <div className="text-sm text-muted-foreground">Sprawdzonych produktów</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{auditItems.length}</div>
                  <div className="text-sm text-muted-foreground">Korekt</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{noChanges}</div>
                  <div className="text-sm text-muted-foreground">Bez różnic</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      totalValueChange >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(totalValueChange)}
                  </div>
                  <div className="text-sm text-muted-foreground">Zmiana wartości</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audit Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informacje o audycie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Rozpoczęty:{" "}
                    {formatDistanceToNow(new Date(currentAudit.started_at!), {
                      addSuffix: true,
                      locale: pl,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Przeprowadzający: Jan Kowalski</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{currentAudit.location_ids.length} lokalizacji</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Dokładność:{" "}
                    {Math.round(
                      ((auditProgress.totalProducts - auditItems.length) /
                        auditProgress.totalProducts) *
                        100
                    )}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Changes Summary */}
          {auditItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Wykryte różnice ({auditItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Lokalizacja</TableHead>
                      <TableHead>Stan systemowy</TableHead>
                      <TableHead>Stan fizyczny</TableHead>
                      <TableHead>Różnica</TableHead>
                      <TableHead>Zmiana wartości</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.product_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.location_id}</Badge>
                        </TableCell>
                        <TableCell>{item.system_quantity}</TableCell>
                        <TableCell>{item.physical_quantity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.difference > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={`font-medium ${
                                item.difference > 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {item.difference > 0 ? "+" : ""}
                              {item.difference}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              item.value_change > 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(item.value_change)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* No Changes Message */}
          {auditItems.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="py-8 text-center">
                  <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
                  <h3 className="mb-2 text-lg font-medium">Doskonały wynik!</h3>
                  <p className="text-muted-foreground">
                    Wszystkie produkty miały zgodne stany systemowe i fizyczne. Nie wykryto żadnych
                    różnic.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Eksportuj raport
          </Button>
          <Button onClick={handleFinish}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Zakończ audyt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
