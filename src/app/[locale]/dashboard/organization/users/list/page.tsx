"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Mail,
  Building2,
  Shield,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { useAppStore } from "@/lib/stores/app-store";

export default function UsersListPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [branchFilter, setBranchFilter] = React.useState<string>("all");

  const { users: organizationUsers, loading, error } = useOrganizationUsers();
  const { availableBranches } = useAppStore();

  const usersWithDetails = React.useMemo(() => {
    return organizationUsers;
  }, [organizationUsers]);

  const filteredUsers = React.useMemo(() => {
    return usersWithDetails.filter((user) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
        const matchesSearch = fullName.includes(query) || user.email.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter (simplified - using active/inactive based on status_id)
      if (statusFilter !== "all") {
        const isActive = user.status_id === "active" || !user.status_id; // Default to active if no status
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "inactive" && isActive) return false;
      }

      // Branch filter
      if (branchFilter !== "all" && user.default_branch_id !== branchFilter) {
        return false;
      }

      return true;
    });
  }, [usersWithDetails, searchQuery, statusFilter, branchFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Failed to load users"}</AlertDescription>
      </Alert>
    );
  }

  const getStatusBadge = (statusId: string | null) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    } as const;

    const labels = {
      active: "Aktywny",
      inactive: "Nieaktywny",
      suspended: "Zawieszony",
    };

    const status = statusId || "inactive";
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getUserInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName || "";
    const last = lastName || "";
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
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
          <h1 className="text-3xl font-bold tracking-tight">Lista użytkowników</h1>
          <p className="text-muted-foreground">
            Zarządzanie wszystkimi użytkownikami w organizacji
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj użytkownika
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtry i wyszukiwanie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Szukaj użytkowników po nazwie lub email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie statusy</SelectItem>
                    <SelectItem value="active">Aktywni</SelectItem>
                    <SelectItem value="inactive">Nieaktywni</SelectItem>
                    <SelectItem value="suspended">Zawieszeni</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Oddział</label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie oddziały</SelectItem>
                    {availableBranches.map((branch) => (
                      <SelectItem key={branch.branch_id} value={branch.branch_id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setBranchFilter("all");
                  }}
                >
                  Wyczyść filtry
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Znaleziono {filteredUsers.length} użytkowników z {usersWithDetails.length} w
              organizacji
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Użytkownicy ({filteredUsers.length})
            </CardTitle>
            <CardDescription>
              Lista wszystkich użytkowników w organizacji z ich rolami i oddziałami
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Oddział</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data dołączenia</TableHead>
                    <TableHead className="w-[100px]">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getUserInitials(user.first_name, user.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{user.role.name}</Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Brak roli</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.branch ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{user.branch.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Brak oddziału</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status_id)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(user.created_at!).toLocaleDateString("pl-PL")}</div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(user.created_at!), {
                              addSuffix: true,
                              locale: pl,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/dashboard/organization/users/${user.id}`)
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Zarządzaj użytkownikiem
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/dashboard/organization/users/${user.id}?tab=roles`)
                              }
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Zmień rolę
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/dashboard/organization/users/${user.id}?tab=profile`)
                              }
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              Edytuj profil
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status_id === "active" ? (
                              <DropdownMenuItem className="text-orange-600">
                                <UserX className="mr-2 h-4 w-4" />
                                Zawieś użytkownika
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-green-600">
                                <UserCheck className="mr-2 h-4 w-4" />
                                Aktywuj użytkownika
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Usuń użytkownika
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
                <Users className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery || statusFilter !== "all" || branchFilter !== "all"
                    ? "Brak wyników"
                    : "Brak użytkowników"}
                </h3>
                <p className="mb-4 text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || branchFilter !== "all"
                    ? "Nie znaleziono użytkowników pasujących do wybranych filtrów."
                    : "Nie dodano jeszcze żadnych użytkowników do organizacji."}
                </p>
                {!(searchQuery || statusFilter !== "all" || branchFilter !== "all") && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj pierwszego użytkownika
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
