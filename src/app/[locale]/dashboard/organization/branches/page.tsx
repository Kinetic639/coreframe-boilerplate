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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Building2,
  Users,
  Package,
  Eye,
} from "lucide-react";
import { mockBranches, getTotalProductCountByBranch } from "@/lib/mock/branches";
import { getUsersByBranch } from "@/lib/mock/organization";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export default function BranchesPage() {
  const [searchQuery, setSearchQuery] = React.useState("");

  const branchesWithStats = React.useMemo(() => {
    return mockBranches.map((branch) => ({
      ...branch,
      userCount: getUsersByBranch(branch.id).length,
      productCount: getTotalProductCountByBranch(branch.id),
    }));
  }, []);

  const filteredBranches = React.useMemo(() => {
    return branchesWithStats.filter(
      (branch) =>
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.slug?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [branchesWithStats, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Oddziały organizacji</h1>
          <p className="text-muted-foreground">Zarządzanie oddziałami i ich lokalizacjami</p>
        </div>
        <Button variant="themed">
          <Plus className="mr-2 h-4 w-4" />
          Dodaj oddział
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
                placeholder="Szukaj oddziałów po nazwie lub slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 md:grid-cols-4"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączna liczba oddziałów</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockBranches.length}</div>
            <p className="text-xs text-muted-foreground">Aktywne oddziały</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branchesWithStats.reduce((sum, branch) => sum + branch.userCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Łącznie we wszystkich oddziałach</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branchesWithStats.reduce((sum, branch) => sum + branch.productCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Łącznie we wszystkich magazynach</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średnia</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                branchesWithStats.reduce((sum, branch) => sum + branch.productCount, 0) /
                  mockBranches.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">Produktów na oddział</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Branches Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lista oddziałów ({filteredBranches.length})
            </CardTitle>
            <CardDescription>
              Wszystkie oddziały organizacji z podstawowymi statystykami
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredBranches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa oddziału</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Użytkownicy</TableHead>
                    <TableHead>Produkty</TableHead>
                    <TableHead>Data utworzenia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => (
                    <TableRow key={branch.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--theme-color)_10%,white)]">
                            <Building2 className="h-4 w-4 text-[color-mix(in_srgb,var(--theme-color)_90%,black)]" />
                          </div>
                          <div>
                            <div className="font-medium">{branch.name}</div>
                            <div className="text-sm text-muted-foreground">
                              ID: {branch.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {branch.slug ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {branch.slug}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Brak</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{branch.userCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {branch.productCount.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(branch.created_at!).toLocaleDateString("pl-PL")}</div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(branch.created_at!), {
                              addSuffix: true,
                              locale: pl,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.deleted_at ? "destructive" : "default"}>
                          {branch.deleted_at ? "Nieaktywny" : "Aktywny"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-[color-mix(in_srgb,var(--theme-color)_10%,white)] hover:text-[color-mix(in_srgb,var(--theme-color)_90%,black)]"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Zobacz szczegóły
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edytuj oddział
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Usuń oddział
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <Building2 className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "Brak wyników" : "Brak oddziałów"}
                </h3>
                <p className="mb-4 text-muted-foreground">
                  {searchQuery
                    ? "Nie znaleziono oddziałów pasujących do wyszukiwania."
                    : "Nie utworzono jeszcze żadnych oddziałów."}
                </p>
                {!searchQuery && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj pierwszy oddział
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
