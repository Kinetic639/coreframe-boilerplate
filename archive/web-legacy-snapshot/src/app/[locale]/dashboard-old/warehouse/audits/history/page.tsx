"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Search,
  Eye,
  Download,
  User,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getAuditsByBranch } from "@/lib/mock/audit";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useAppContext } from "@/hooks/us-app-context";

export default function AuditHistoryPage() {
  const { activeBranchId } = useAppContext();
  const [searchQuery, setSearchQuery] = React.useState("");
  const audits = getAuditsByBranch(activeBranchId || "");

  const filteredAudits = React.useMemo(() => {
    return audits.filter((audit) => audit.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [audits, searchQuery]);

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      in_progress: "secondary",
      cancelled: "destructive",
      pending: "outline",
    } as const;

    const labels = {
      completed: "Zakończony",
      in_progress: "W trakcie",
      cancelled: "Anulowany",
      pending: "Oczekujący",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getValueChangeIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historia audytów</h1>
          <p className="text-muted-foreground">
            Przeglądaj poprzednie audyty magazynowe i ich wyniki
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Eksportuj raport
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Wyszukiwanie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Szukaj audytów po nazwie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Audits Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Lista audytów ({filteredAudits.length})
            </CardTitle>
            <CardDescription>
              Historia wszystkich przeprowadzonych audytów magazynowych
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAudits.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa audytu</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Produkty</TableHead>
                    <TableHead>Korekty</TableHead>
                    <TableHead>Zmiana wartości</TableHead>
                    <TableHead>Przeprowadzający</TableHead>
                    <TableHead className="w-[100px]">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudits.map((audit) => (
                    <TableRow key={audit.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{audit.name}</div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {audit.location_ids.length} lokalizacji
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(audit.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {new Date(audit.started_at || audit.created_at).toLocaleDateString(
                              "pl-PL"
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(audit.started_at || audit.created_at), {
                              addSuffix: true,
                              locale: pl,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {audit.checked_products} / {audit.total_products}
                          </div>
                          <div className="text-muted-foreground">
                            {Math.round((audit.checked_products / audit.total_products) * 100)}%
                            sprawdzonych
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{audit.corrections_count}</span>
                          {audit.corrections_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round((audit.corrections_count / audit.total_products) * 100)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getValueChangeIcon(audit.total_value_change)}
                          <span
                            className={`font-medium ${
                              audit.total_value_change > 0
                                ? "text-green-600"
                                : audit.total_value_change < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            {formatCurrency(Math.abs(audit.total_value_change))}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Jan Kowalski</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <History className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "Brak wyników" : "Brak audytów"}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Nie znaleziono audytów pasujących do wyszukiwania."
                    : "Nie przeprowadzono jeszcze żadnych audytów w tym oddziale."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
