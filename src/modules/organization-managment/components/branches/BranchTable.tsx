"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Edit, MoreHorizontal, Package, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Tables } from "../../../../../supabase/types/types";
import BranchSearch from "./BranchSearch";
import BranchFormDialog from "./BranchFormDialog";
import BranchDeleteDialog from "./BranchDeleteDialog";
import { useAppStore } from "@/lib/stores/app-store";
import { fetchAvailableBranches } from "@/lib/api/branches";

type BranchWithStats = Tables<"branches"> & {
  userCount: number;
  productCount: number;
};

export default function BranchTable({ initialBranches }: { initialBranches: BranchWithStats[] }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [branches, setBranches] = React.useState<BranchWithStats[]>(initialBranches);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedBranch, setSelectedBranch] = React.useState<BranchWithStats | null>(null);
  const { activeOrgId, updateAvailableBranches } = useAppStore();

  // Update branches when initialBranches changes
  React.useEffect(() => {
    setBranches(initialBranches);
  }, [initialBranches]);

  const filteredBranches = React.useMemo(() => {
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.slug?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [branches, searchQuery]);

  const handleSuccess = async () => {
    // Refresh the branch table data by reloading the page
    window.location.reload();

    // Also refresh the branch selector data
    if (activeOrgId) {
      try {
        const updatedBranches = await fetchAvailableBranches(activeOrgId);
        updateAvailableBranches(updatedBranches);
      } catch (error) {
        console.error("Failed to refresh branch selector:", error);
      }
    }
  };

  const handleCreateBranch = () => {
    setSelectedBranch(null);
    setIsFormOpen(true);
  };

  const handleEditBranch = (branch: BranchWithStats) => {
    setSelectedBranch(branch);
    setIsFormOpen(true);
  };

  const handleDeleteBranch = (branch: BranchWithStats) => {
    setSelectedBranch(branch);
    setIsDeleteOpen(true);
  };

  return (
    <>
      <BranchSearch value={searchQuery} onChange={setSearchQuery} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Lista oddziałów ({filteredBranches.length})
              </CardTitle>
              <CardDescription>
                Wszystkie oddziały organizacji z podstawowymi statystykami
              </CardDescription>
            </div>

            <Button variant="themed" onClick={handleCreateBranch}>
              <Building2 className="mr-2 h-4 w-4" />
              Dodaj oddział
            </Button>
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
                            <DropdownMenuItem onClick={() => handleEditBranch(branch)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edytuj oddział
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteBranch(branch)}
                            >
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
                  <Button onClick={handleCreateBranch} variant="themed">
                    <Building2 className="mr-2 h-4 w-4" />
                    Dodaj pierwszy oddział
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <BranchFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        branch={selectedBranch}
        onSuccess={handleSuccess}
      />

      <BranchDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        branch={selectedBranch}
        onSuccess={handleSuccess}
      />
    </>
  );
}
